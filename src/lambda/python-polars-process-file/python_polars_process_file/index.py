import os
import logging
import boto3
import polars
from collections import Counter
from io import StringIO

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
    averages = process_csv_data(S3_BUCKET, FILE_NAME)

    # Store the results in DynamoDB
    store_results_in_dynamodb(averages, context.aws_request_id)

    return {
        'statusCode': 200,
        'body': 'Data processed and stored successfully!'
    }


def process_csv_data(bucket, key):
    # Get the CSV file from S3
    response = s3_client.get_object(Bucket=bucket, Key=key)
    csv_data = response['Body'].read().decode('utf-8')

    # Read the CSV data into a Polars DataFrame
    df = polars.read_csv(StringIO(csv_data))

    # Group by Hospital and Diagnosis, calculating the average Recovery Time
    grouped = df.group_by(['Hospital', 'Diagnosis']).agg([
        polars.col('Recovery Time').mean().alias('AverageRecoveryTime'),
        polars.col('Treatment')
    ])

    # Prepare list to hold average records
    averages = []

    # Iterate over each group to calculate the most used treatment
    for group in grouped.iter_rows(named=True):
        hospital = group['Hospital']
        diagnosis = group['Diagnosis']
        avg_recovery_time = group['AverageRecoveryTime']

        # Extract the treatments related to this group
        treatments = df.filter((df['Hospital'] == hospital) & (df['Diagnosis'] == diagnosis))['Treatment']

        # Find the most used treatment
        most_used_treatment = Counter(treatments).most_common(1)[0][0]

        # Create the average record
        averages.append({
            'Hospital': hospital,
            'Diagnosis': diagnosis,
            'AverageRecoveryTime': avg_recovery_time,
            'MostUsedTreatment': most_used_treatment
        })

    return averages


def store_results_in_dynamodb(averages, request_id):
    # Reference the DynamoDB table
    table = dynamodb.Table(DB_TABLE)

    # Batch write the results to DynamoDB
    with table.batch_writer() as batch:
        for avg in averages:
            sort_key = "#diagnosis#{}#hospital#{}".format(avg['Diagnosis'], avg['Hospital'])

            batch.put_item(Item={
                'PK': request_id,
                'SK': sort_key,
                'Hospital': avg['Hospital'],
                'Diagnosis': avg['Diagnosis'],
                'AverageRecoveryTime': str(avg['AverageRecoveryTime']),
                'MostUsedTreatment': avg['MostUsedTreatment']
            })