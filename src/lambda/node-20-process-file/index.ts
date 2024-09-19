import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BatchWriteItemCommand, BatchWriteItemCommandInput, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Readable } from "stream";
import { Context } from "aws-lambda";
import { createInterface } from "readline";

// Types
interface Row {
    hospital: string;
    diagnosis: string;
    treatment: string;
    recoveryTime: number;
}
type Column = keyof Row;
type AverageRecoveryTimesMapValueType = {
    sum: number;
    count: number;
    hospital: string;
    diagnosis: string;
    treatmentCounts: Record<string, number>;
}
type AverageRecoveryTimesMap = Map<string, AverageRecoveryTimesMapValueType>;

// AWS SDK clients
const s3Client = new S3Client();
const dynamoDBClient = new DynamoDBClient();

// Environment variables
const { DB_TABLE, S3_BUCKET, FILE_NAME } = process.env;

export async function handler(_: unknown, context: Context) {
    try {
        if (!isNonEmptyString(S3_BUCKET)) {
            throw TypeError("S3_BUCKET environment variable is invalid or missing.");
        }

        if (!isNonEmptyString(FILE_NAME)) {
            throw TypeError("FILE_NAME environment variable is invalid or missing.");
        }

        if (!isNonEmptyString(DB_TABLE)) {
            throw TypeError("DB_TABLE environment variable is invalid or missing.");
        }

        const requestId = context.awsRequestId;
        
        // Read and process CSV data
        const averages = await processCsvData(S3_BUCKET, FILE_NAME, requestId);

        // Store results in DynamoDB table
        // await storeResultsInDynamoDB(averages, context.awsRequestId, DB_TABLE);
        
        console.info("File processed successfully");
    } catch(err: unknown) {
        console.error(err);
        throw err;
    }
}

async function processCsvData(bucket: string, key: string, requestId: string): Promise<AverageRecoveryTimesMap> {
    // Create S3 stream for the file
    const s3Stream = await getS3Stream(bucket, key);
    
    // Aggregation storage
    const averageRecoveryTimes: AverageRecoveryTimesMap = new Map();
    
    return new Promise((resolve, reject) => {
        try {
            const rl = createInterface({
                input: s3Stream,
                crlfDelay: Infinity,
            })
            let lineNumber = 1;

            rl
                .on("line", (line: string) => {
                    lineNumber++;
                
                    // Skip the header line
                    if (lineNumber === 1) return;

                    // Split line into columns based on comma delimiter
                    const columns = line.split(',');

                    // Check for valid line format
                    if (columns.length !== 4) {
                        console.warn(`Skipping malformed row at line ${lineNumber}:`, line);
                        return;
                    }

                    // Extract data from columns
                    const [hospital, diagnosis, treatment, recoveryTimeStr] = columns;
                    const recoveryTime = parseInt(recoveryTimeStr, 10);

                    if (isNaN(recoveryTime)) {
                        console.warn(`Invalid recoveryTime at line ${lineNumber}:`, line);
                        return;
                    }

                    // Create a Row object
                    const chunk: Row = {
                        hospital,
                        diagnosis,
                        treatment,
                        recoveryTime
                    };

                    // console.log(`chunk from file (${lineNumber}):`, chunk);

                    // Generate key for map storage
                    const key = `${chunk.hospital}${chunk.diagnosis}`;
                    const agg = averageRecoveryTimes.get(key);

                    if (agg) {
                        agg.count++;
                        agg.sum += chunk.recoveryTime;

                        const treatmentAggCount = agg.treatmentCounts[chunk.treatment] ?? 0;
                        agg.treatmentCounts[chunk.treatment] = treatmentAggCount + 1;
                    } else {
                        // Initialize if doesn't exist
                        averageRecoveryTimes.set(key, {
                            hospital: chunk.hospital,
                            diagnosis: chunk.diagnosis,
                            count: 1,
                            sum: chunk.recoveryTime,
                            treatmentCounts: { [chunk.treatment]: 1 },
                        });
                    }
                })
                .on("close", () => {
                    const used = process.memoryUsage().heapUsed / 1024 / 1024;
                    console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
                    
                    // console.log("=================================");
                    // console.log(averageRecoveryTimes);
                    resolve(averageRecoveryTimes);
                })
                .on("error", (err: unknown) => {
                    console.error(err);
                    reject(err);
                });
        } catch(err: unknown) {
            console.error(err);
            reject(err);
        }
    });
}

// Helper function to get S3 stream
async function getS3Stream(bucket: string, key: string): Promise<Readable> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const { Body } = await s3Client.send(command);
    
    if (!isReadable(Body)) {
        throw TypeError("Expected Body to be a Readable stream");
    }
    
    return Body;
}

// Helper function to store aggregated results in DynamoDB
async function storeResultsInDynamoDB(aggregatedData: AverageRecoveryTimesMap, requestId: string, dynamoDBTable: string) {
    const putRequests = [];

    for (const aggregatedDataValue of aggregatedData.values()) {
        // Calculate average recovery time
        const averageRecoveryTime = aggregatedDataValue.sum / aggregatedDataValue.count;
        // Calculate the most frequent treatment used per hospita/diagnosis
        // const mostFrequentTreatment = Object.entries(aggregatedDataValue.treatmentCounts).reduce((prevTreatment, currTreatment) => {
        //     return prevTreatment[1] > currTreatment[1] ? prevTreatment : currTreatment;
        // });

        const sortKey = `#diagnosis#${aggregatedDataValue.diagnosis}#hospital#${aggregatedDataValue.hospital}`;
        const putRequest = {
            PutRequest: {
                Item: {
                    PK: { S: requestId },
                    SK: { S: sortKey },
                    Hospital: { S: aggregatedDataValue.hospital },
                    Diagnosis: { S: aggregatedDataValue.diagnosis },
                    // MostUsedTreatment: { S: mostFrequentTreatment[0] },
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

function isReadable(input: unknown): input is Readable {
    return input instanceof Readable;
}

function isNonEmptyString(input: unknown): input is string {
    return typeof input === "string" && input.length > 0;
}
