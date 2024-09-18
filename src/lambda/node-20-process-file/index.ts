import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { inferSchema, initParser } from 'udsv';
import { Readable } from 'stream';
import { Context, APIGatewayProxyResult } from 'aws-lambda';

// Initialize AWS SDK clients
const s3Client = new S3Client();
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const DB_TABLE = process.env.DB_TABLE!;
const S3_BUCKET = process.env.S3_BUCKET!;
const FILE_NAME = process.env.FILE_NAME!;

interface CSVRecord {
    Hospital: string;
    Diagnosis: string;
    'Recovery Time': string;
    Treatment: string;
}

interface AggregatedData {
    Hospital: string;
    Diagnosis: string;
    totalRecoveryTime: number;
    count: number;
    treatments: Map<string, number>;
}

interface ProcessedResult {
    Hospital: string;
    Diagnosis: string;
    AverageRecoveryTime: string;
    MostUsedTreatment: string;
}

export const handler = async (event: any, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        await processCSVData(S3_BUCKET, FILE_NAME, context.awsRequestId);
        return {
            statusCode: 200,
            body: 'Data processed and stored successfully!'
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: 'Error processing data'
        };
    }
};

async function processCSVData(bucket: string, key: string, requestId: string): Promise<void> {
    // Get the CSV file from S3
    const { Body } = await s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key
    }));

    if (!Body) {
        throw new Error('Failed to retrieve file from S3');
    }

    const bodyContents = await streamToString(Body as Readable);
    const schema = inferSchema(bodyContents);
    const parser = initParser(schema);

    const dataAggregator = new Map<string, AggregatedData>();

    // Process the CSV data
    const records = parser(bodyContents);
    for (const record of records) {
        const typedRecord = record as CSVRecord;
        const groupKey = `${typedRecord.Hospital}|${typedRecord.Diagnosis}`;
        if (!dataAggregator.has(groupKey)) {
            dataAggregator.set(groupKey, {
                Hospital: typedRecord.Hospital,
                Diagnosis: typedRecord.Diagnosis,
                totalRecoveryTime: 0,
                count: 0,
                treatments: new Map()
            });
        }

        const group = dataAggregator.get(groupKey)!;
        group.totalRecoveryTime += parseFloat(typedRecord['Recovery Time']);
        group.count += 1;
        group.treatments.set(typedRecord.Treatment, (group.treatments.get(typedRecord.Treatment) || 0) + 1);
    }

    // Calculate final averages and most common treatments
    const results: ProcessedResult[] = Array.from(dataAggregator.values()).map(group => ({
        Hospital: group.Hospital,
        Diagnosis: group.Diagnosis,
        AverageRecoveryTime: (group.totalRecoveryTime / group.count).toFixed(2),
        MostUsedTreatment: Array.from(group.treatments.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0]
    }));

    // Store results in DynamoDB
    await storeResultsInDynamoDB(results, requestId);

    console.log(`Processed ${results.length} unique Hospital-Diagnosis combinations`);
}

async function storeResultsInDynamoDB(results: ProcessedResult[], requestId: string): Promise<void> {
    const batchSize = 25; // DynamoDB allows a maximum of 25 items per batch write
    for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        const params = {
            RequestItems: {
                [DB_TABLE]: batch.map(item => ({
                    PutRequest: {
                        Item: {
                            PK: requestId,
                            SK: `#diagnosis#${item.Diagnosis}#hospital#${item.Hospital}`,
                            Hospital: item.Hospital,
                            Diagnosis: item.Diagnosis,
                            AverageRecoveryTime: item.AverageRecoveryTime,
                            MostUsedTreatment: item.MostUsedTreatment
                        }
                    }
                }))
            }
        };

        await ddbDocClient.send(new BatchWriteCommand(params));
    }
}

// Helper function to convert a readable stream to a string
async function streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}
