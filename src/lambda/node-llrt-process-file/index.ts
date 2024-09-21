/**
 * LLRT currently does not support returning streams from SDK responses.
 * As a workaround I used the ContenRange parameter to read file from S3 in chunks.
 * See:
 * - https://docs.aws.amazon.com/code-library/latest/ug/s3_example_s3_Scenario_UsingLargeFiles_section.html
 * - (end of) https://github.com/awslabs/llrt?tab=readme-ov-file#using-aws-sdk-v3-with-llrt
 */
import { Context } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BatchWriteItemCommand, BatchWriteItemCommandInput, DynamoDBClient } from "@aws-sdk/client-dynamodb";

// Types
type AverageRecoveryTimesMapValueType = {
    sum: number;
    count: number;
    hospital: string;
    diagnosis: string;
    treatmentCounts: Record<string, number>;
}
type AverageRecoveryTimesMap = Map<string, AverageRecoveryTimesMapValueType>;
type BodyWithRange = {
    contentRange: string;
    body: string;
}

// AWS SDK clients
const s3Client = new S3Client();
const dynamoDBClient = new DynamoDBClient();

// Environment variables
const { DB_TABLE, S3_BUCKET, FILE_NAME } = process.env;

// Chunk Size
const ONE_MB = 1024 * 1024;
const CHUNK_SIZE: number = 10 * ONE_MB; // Process in chunks of 10MB

// Local testing
// const DB_TABLE = "oxidizing-lambda-functions-node-20-hospital-averages-table";
// const S3_BUCKET = "oxidizing-lambda-functions-assets-source";
// const FILE_NAME = "one_million_rows_medical_records.csv";
// const FILE_NAME = "one_hundred_medical_records.csv";

export async function handler(_: unknown, context: Context) {
    try {
        if (!isNonEmptyString(S3_BUCKET)) throw new Error("S3_BUCKET environment variable is invalid or missing.");
        if (!isNonEmptyString(FILE_NAME)) throw new Error("FILE_NAME environment variable is invalid or missing.");
        if (!isNonEmptyString(DB_TABLE)) throw new Error("DB_TABLE environment variable is invalid or missing.");
        
        // Read and process CSV data
        const averages = await processCsvData(S3_BUCKET, FILE_NAME);
        
        // Store results in DynamoDB table
        await storeResultsInDynamoDB(averages, context.awsRequestId, DB_TABLE);

        console.info("File processed successfully");
    } catch(err: unknown) {
        console.error(err);
        throw err;
    }
}

async function processCsvData(bucket: string, key: string): Promise<AverageRecoveryTimesMap> {
    // Aggregation storage
    const averageRecoveryTimes: AverageRecoveryTimesMap = new Map();
    
    // Helper flag to remove headers at first line
    let isFirstLine = true;

    // Download the file in chunks using Range headers: https://www.rfc-editor.org/rfc/rfc9110.html#name-range
    let rangeAndLength = { start: -1, end: -1, length: -1 };
    
    // Possible remaining incomplete line
    let leftOver = "";

    while (!isComplete(rangeAndLength)) {
        const { end } = rangeAndLength;
        const nextRange = { start: end + 1, end: end + CHUNK_SIZE };

        const { body, contentRange } = await getS3ObjectRange(
            bucket,
            key,
            nextRange.start,
            nextRange.end,
        );

        const chunkStr = leftOver + body;
        const lines = chunkStr.split(/\r?\n/);
        
        // Remove headers line
        if (isFirstLine) {
            lines.shift();
            isFirstLine = false;
        }

        // Removes and stores last possible partial line from the chunk
        leftOver = lines.pop() || "";

        processLines(lines, averageRecoveryTimes);
        
        // Updaes ContentRange for next chunk read from S3
        rangeAndLength = getRangeAndLength(contentRange);
    }

    // Flush-ish logic to handle last line if any
    if (leftOver) {
        processLines([leftOver], averageRecoveryTimes);
    }
    
    return averageRecoveryTimes;
}

function processLines(lines: string[], averageRecoveryTimes: AverageRecoveryTimesMap): void {
    lines.forEach((line) => {
        const columns = line.split(",");

        if (columns.length === 0) {
            return; // Skip empty lines
        }
        
        if (columns.length !== 4) {
            throw new Error(`Expected line to have four columns, instead found: ${columns.length} for line: ${columns}`);
        }
        
        const [hospital, diagnosis, treatment, recoveryTimeStr] = columns;
        const recoveryTime = parseInt(recoveryTimeStr, 10);
        
        if (isNaN(recoveryTime)) {
            throw new Error(`Invalid recoveryTime at line: ${line}`);
        }
        
        // Generate key for map storage
        const key = `${hospital}${diagnosis}`;
        const agg = averageRecoveryTimes.get(key);
        
        if (agg) {
            agg.count++;
            agg.sum += recoveryTime;
            
            const treatmentAggCount = agg.treatmentCounts[treatment] ?? 0;
            agg.treatmentCounts[treatment] = treatmentAggCount + 1;
        } else {
            // Initialize if doesn't exist
            averageRecoveryTimes.set(key, {
                hospital: hospital,
                diagnosis: diagnosis,
                count: 1,
                sum: recoveryTime,
                treatmentCounts: { [treatment]: 1 },
            });
        }
    });
}

// Helper functions to read the S3 object in chunks
async function getS3ObjectRange(bucket: string, key: string, start: number, end: number): Promise<BodyWithRange> {
    const contentRange = `bytes=${start}-${end}`;
    const command = new GetObjectCommand({ Bucket: bucket, Key: key, Range: contentRange });
    const { Body, ContentRange } = await s3Client.send(command);
    
    if (!Body?.transformToString) {
        throw new Error("Expected S3 Body response to have transformToString method defined");
    }

    if (typeof ContentRange !== "string") {
        throw new Error("Expected ContentRange to be a string");
    }
    
    const bodyWithRange = {
        contentRange: ContentRange,
        body: await Body.transformToString(),
    };
    
    return bodyWithRange;
}

function isComplete(range: { end: number; length: number; }) {
    return range.end === range.length - 1
};

function getRangeAndLength(contentRange: string) {
    const [range, length] = contentRange.split("/");
    const [start, end] = range.split("-");

    return {
        start: parseInt(start, 10),
        end: parseInt(end, 10),
        length: parseInt(length, 10),
    };
}

// Helper function to store aggregated results in DynamoDB
async function storeResultsInDynamoDB(aggregatedData: AverageRecoveryTimesMap, requestId: string, dynamoDBTable: string) {
    const putRequests = [];
    
    for (const aggregatedDataValue of aggregatedData.values()) {
        // Calculate average recovery time
        const averageRecoveryTime = aggregatedDataValue.sum / aggregatedDataValue.count;
        // Calculate the most frequent treatment used per hospita/diagnosis
        const mostFrequentTreatment = Object.entries(aggregatedDataValue.treatmentCounts).reduce((prevTreatment, currTreatment) => {
            return prevTreatment[1] > currTreatment[1] ? prevTreatment : currTreatment;
        });
        
        const sortKey = `#diagnosis#${aggregatedDataValue.diagnosis}#hospital#${aggregatedDataValue.hospital}`;
        const putRequest = {
            PutRequest: {
                Item: {
                    PK: { S: requestId },
                    SK: { S: sortKey },
                    Hospital: { S: aggregatedDataValue.hospital },
                    Diagnosis: { S: aggregatedDataValue.diagnosis },
                    MostUsedTreatment: { S: mostFrequentTreatment[0] },
                    AverageRecoveryTime: { N: averageRecoveryTime.toString() },
                },
            }
        };
        
        putRequests.push(putRequest);
    }
    
    // Perform batch writes in chunks of 25 items due to DynamoDB limits
    const chunkSize = 25;
    for(let i = 0; i < putRequests.length; i += chunkSize) {
        const chunk = putRequests.slice(i, i + chunkSize);
        const input: BatchWriteItemCommandInput = {
            RequestItems: {
                [dynamoDBTable]: chunk,
            },
        };
        const command = new BatchWriteItemCommand(input);
        
        await dynamoDBClient.send(command);
    }
}

// Helper functions
function isNonEmptyString(input: unknown): input is string {
    return typeof input === "string" && input.length > 0;
}
