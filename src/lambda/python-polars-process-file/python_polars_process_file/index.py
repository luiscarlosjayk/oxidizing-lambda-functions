import os
import logging
import boto3
import polars as pl

# Initialize logger
logger = logging.getLogger()
logger.setLevel("INFO")

# Environment variables
DB_TABLE = os.environ.get('DB_TABLE')
S3_BUCKET = os.environ.get('S3_BUCKET')
FILE_NAME = os.environ.get('FILE_NAME')

# Initialize AWS SDK clients
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

    # Construct the S3 path
    s3_path = f"s3://{bucket}/{key}"

    # Read the CSV file lazily with Polars
    lazy_df = pl.read_csv_batched(s3_path)

    # Define the chunk size
    chunk_size = 10_000

    # Iterate over the lazy DataFrame in chunks
    try:
        # Continuously fetch data in chunks until the DataFrame is exhausted
        chunk_count = 0
        while True:
            # Fetch a chunk of data lazily
            chunk = lazy_df.fetch(chunk_size)
            
            # Break the loop if no more data is available
            if chunk.is_empty():
                break
            
            # Process and store the chunk
            process_and_store_chunk(chunk, table, request_id)

            chunk_count += 1

        logger.info(f"CSV data processing completed for request ID: {request_id}, processed {chunk_count} chunks.")

    except Exception as e:
        logger.error(f"Error processing CSV data: {e}")
        raise

def process_and_store_chunk(chunk, table, request_id):
    # Perform grouping and aggregation on the chunk
    chunk_result = (
        chunk.lazy()
        .group_by(['Hospital', 'Diagnosis'])
        .agg([
            pl.col('Recovery Time').mean().alias('AverageRecoveryTime'),
            pl.col('Treatment').mode().alias('MostUsedTreatment')
        ])
        .collect()
    )

    # Convert the result to a list of dictionaries for easy iteration
    records = chunk_result.to_dicts()

    # Store results in DynamoDB
    with table.batch_writer() as batch:
        for record in records:
            sort_key = f"#diagnosis#{record['Diagnosis']}#hospital#{record['Hospital']}"
            batch.put_item(Item={
                'PK': request_id,
                'SK': sort_key,
                'Hospital': record['Hospital'],
                'Diagnosis': record['Diagnosis'],
                'AverageRecoveryTime': str(record['AverageRecoveryTime']),
                'MostUsedTreatment': record['MostUsedTreatment']
            })

    logger.info(f"Processed and stored {len(records)} records from a chunk")
