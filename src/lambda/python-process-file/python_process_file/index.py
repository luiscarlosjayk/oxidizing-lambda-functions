import os
import logging
import boto3
import pandas as pd
from collections import defaultdict

# Initialize logger
logger = logging.getLogger()
logger.setLevel("INFO")

# Environment variables
DB_TABLE = os.environ.get('DB_TABLE')
S3_BUCKET = os.environ.get('S3_BUCKET')
FILE_NAME = os.environ.get('FILE_NAME')

# Initialize AWS SDK clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

def handler(_, context):
    # Process the CSV data from S3 and calculate averages
    process_csv_data(S3_BUCKET, FILE_NAME, context.aws_request_id)

    return {
        'statusCode': 200,
        'body': 'Data processed and stored successfully!'
    }

def process_csv_data(bucket, key, request_id):
    # Reference the DynamoDB table
    table = dynamodb.Table(DB_TABLE)

    # Get the CSV file from S3
    s3_file_url = f"s3://{bucket}/{key}"

    # Placeholder lists to collect results from each chunk
    average_recovery_times = []
    most_frequent_treatments = []

    # Process each chunk to calculate averages and most frequent treatments
    chunk_size = 10000
    for chunk in pd.read_csv(s3_file_url, chunksize=chunk_size, iterator=True):  # Adjust chunksize as needed
        # Step 1: Calculate sum and count of 'Recovery Time' per (Hospital, Diagnosis)
        recovery_time_stats = chunk.groupby(['Hospital', 'Diagnosis'])['Recovery Time'].agg(['sum', 'count']).reset_index()
        average_recovery_times.append(recovery_time_stats)

        # Step 2: Find the most frequent 'Treatment' per (Hospital, Diagnosis)
        most_frequent = chunk.groupby(['Hospital', 'Diagnosis'])['Treatment'].agg(lambda x: x.value_counts().idxmax()).reset_index()
        most_frequent_treatments.append(most_frequent)

    # Step 3: Combine all chunk results into single DataFrames
    combined_recovery_times = pd.concat(average_recovery_times, ignore_index=True)
    combined_most_frequent = pd.concat(most_frequent_treatments, ignore_index=True)

    # Step 4: Calculate overall average recovery time per (Hospital, Diagnosis)
    # Sum all 'sum' and 'count' values, then calculate the average
    average_recovery = combined_recovery_times.groupby(['Hospital', 'Diagnosis']).agg({
        'sum': 'sum',    # Total sum of recovery times
        'count': 'sum'   # Total count of recovery times
    }).reset_index()

    # Calculate the average recovery time
    average_recovery['average_recovery_time'] = average_recovery['sum'] / average_recovery['count']

    # Step 5: Find the most frequent treatment across all chunks per (Hospital, Diagnosis)
    # Count occurrences of each treatment combination across chunks
    treatment_counts = combined_most_frequent.groupby(['Hospital', 'Diagnosis', 'Treatment']).size().reset_index(name='Count')

    # Find the most frequent treatment for each (Hospital, Diagnosis)
    most_frequent_overall = treatment_counts.sort_values(['Hospital', 'Diagnosis', 'Count'], ascending=[True, True, False]).drop_duplicates(subset=['Hospital', 'Diagnosis'])

    # Step 6: Merge the average recovery time with the most frequent treatment
    final_results = pd.merge(average_recovery[['Hospital', 'Diagnosis', 'average_recovery_time']], 
                            most_frequent_overall[['Hospital', 'Diagnosis', 'Treatment']], 
                            on=['Hospital', 'Diagnosis'], 
                            how='inner')

    # Rename columns for clarity
    final_results.rename(columns={'Treatment': 'most_frequent_treatment'}, inplace=True)
    
    # Step 7: Store results in DynamoDB
    for _, row in final_results.iterrows():
        hospital = row['Hospital']
        diagnosis = row['Diagnosis']
        avg_recovery_time = row['average_recovery_time']
        most_frequent_treatment = row['most_frequent_treatment']
        
        # Construct the sort key as per the given format
        sort_key = f"#diagnosis#{diagnosis}#hospital#{hospital}"
        
        # Store the item in DynamoDB
        table.put_item(Item={
            'PK': request_id,
            'SK': sort_key,
            'Hospital': hospital,
            'Diagnosis': diagnosis,
            'AverageRecoveryTime': str(avg_recovery_time),
            'MostUsedTreatment': most_frequent_treatment
        })
    
    