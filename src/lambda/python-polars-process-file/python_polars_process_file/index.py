import os
import logging
import boto3
import polars as pl
import tempfile

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

    # Step 1: Download the file from S3 to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
        temp_file_path = temp_file.name  # Get the path of the temporary file
        s3_client.download_fileobj(Bucket=bucket, Key=key, Fileobj=temp_file)

    # Placeholder lists to collect results from each batch
    average_recovery_times = []
    most_frequent_treatments = []

    # Step 2: Process the CSV in batches using Polars' read_csv_batched
    batch_size = 10000

    # Get the BatchedCsvReader object
    reader = pl.read_csv_batched(temp_file_path, batch_size=batch_size)

    # Step 3: Iterate over batches using next_batches
    while True:
        # Fetch the next batch (1 batch at a time)
        batches = reader.next_batches(1)  # Fetch 1 batch at a time
        if not batches:  # If no more batches, exit the loop
            break

        for batch in batches:
            # Step 4: Calculate sum and count of 'Recovery Time' per (Hospital, Diagnosis)
            recovery_time_stats = batch.group_by(['Hospital', 'Diagnosis']).agg([
                pl.col('Recovery Time').sum().alias('sum'),
                pl.col('Recovery Time').count().alias('count')
            ])
            average_recovery_times.append(recovery_time_stats)

            # Step 5: Find the most frequent 'Treatment' per (Hospital, Diagnosis)
            most_frequent = batch.group_by(['Hospital', 'Diagnosis']).agg([
                pl.col('Treatment').mode().alias('most_frequent_treatment')
            ])
            most_frequent_treatments.append(most_frequent)

    # Step 6: Combine all batch results into single DataFrames
    combined_recovery_times = pl.concat(average_recovery_times)
    combined_most_frequent = pl.concat(most_frequent_treatments)

    # Step 7: Calculate overall average recovery time per (Hospital, Diagnosis)
    # Sum all 'sum' and 'count' values, then calculate the average
    average_recovery = combined_recovery_times.group_by(['Hospital', 'Diagnosis']).agg([
        pl.col('sum').sum().alias('total_sum'),
        pl.col('count').sum().alias('total_count')
    ])

    # Calculate the average recovery time
    average_recovery = average_recovery.with_columns(
        (pl.col('total_sum') / pl.col('total_count')).alias('Average Recovery Time')
    )

    # Step 8: Find the most frequent treatment across all batches per (Hospital, Diagnosis)
    treatment_counts = combined_most_frequent.group_by(['Hospital', 'Diagnosis', 'most_frequent_treatment']).agg([
        pl.count().alias('Count')
    ])

    # Step 9: Sort by Hospital, Diagnosis, and Count in descending order for Count
    most_frequent_overall = treatment_counts.sort(
        by=['Hospital', 'Diagnosis', 'Count'], 
        descending=[False, False, True]
    )

    # Step 10: Remove duplicates, keeping the first occurrence per (Hospital, Diagnosis)
    most_frequent_overall = most_frequent_overall.unique(subset=['Hospital', 'Diagnosis'], keep='first')

    final_results = average_recovery.join(
        most_frequent_overall[['Hospital', 'Diagnosis', 'most_frequent_treatment']],
        on=['Hospital', 'Diagnosis'],
        how='inner'
    )

    # Step 11: Store results in DynamoDB
    for row in final_results.iter_rows(named=True):
        hospital = row['Hospital']
        diagnosis = row['Diagnosis']
        avg_recovery_time = row['Average Recovery Time']
        most_frequent_treatment = row['most_frequent_treatment']
        
        # Construct the sort key as per the given format
        sort_key = f"#diagnosis#{diagnosis}#hospital#{hospital}"
        
        # Store the item in DynamoDB
        table.put_item(Item={
            'PK': request_id,
            'SK': sort_key,
            'Hospital': hospital,
            'Diagnosis': diagnosis,
            'AverageRecoveryTime': str(avg_recovery_time),  # Convert to string if necessary for DynamoDB
            'MostUsedTreatment': most_frequent_treatment
        })

    # Remove the temporary file after use
    os.remove(temp_file_path)
