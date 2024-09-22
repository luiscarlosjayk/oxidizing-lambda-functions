import { Context } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BatchWriteItemCommand, BatchWriteItemCommandInput, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Readable, pipeline, Transform, Writable } from "stream";
import { promisify } from "util";

// Types
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

// Local testing
// const DB_TABLE = "oxidizing-lambda-functions-node-20-hospital-averages-table";
// const S3_BUCKET = "oxidizing-lambda-functions-assets-source";
// const FILE_NAME = "one_million_rows_medical_records.csv";
// const FILE_NAME = "one_hundred_medical_records.csv";

export async function handler(_: unknown, context: Context) {
    console.time("handler");
    try {
        if (!isNonEmptyString(S3_BUCKET)) throw TypeError("S3_BUCKET environment variable is invalid or missing.");
        if (!isNonEmptyString(FILE_NAME)) throw TypeError("FILE_NAME environment variable is invalid or missing.");
        if (!isNonEmptyString(DB_TABLE)) throw TypeError("DB_TABLE environment variable is invalid or missing.");

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

// Process CSV data and calculate average recovery times
async function processCsvData(bucket: string, key: string): Promise<AverageRecoveryTimesMap> {
    const s3Stream = await getS3Stream(bucket, key);

    // Aggregation storage
    const averageRecoveryTimes: AverageRecoveryTimesMap = new Map();
    
    let leftOver = ""; // Possible remaining incomplete line
    let isFirstLine = true; // Helper flag to remove headers at first line
    const lineSplitter = new Transform({
        readableObjectMode: true,
        transform(chunk: string, _encoding, callback) {
            const chunkString = leftOver + chunk.toString();
            const lines = chunkString.split(/\r?\n/);
            
            // Remove headers line
            if (isFirstLine) {
                lines.shift();
                isFirstLine = false;
            }
            
            // Removes and stores last possible partial line from the chunk
            leftOver = lines.pop() || "";

            this.push(lines);
            callback();
        },
        // Handle last line if any
        flush(callback) {
            if (leftOver) {
                this.push([leftOver]); // Process the last remaining line
            }
            callback();
        },
    });

    const linesProcessor = new Writable({
        objectMode: true,
        write(lines: string[], _encoding, callback) {
            try {
                if (Array.isArray(lines)) {
                    processLines(lines, averageRecoveryTimes);
                } else {
                    callback(new Error(`Expected an array of lines, but got: ${typeof lines}`));
                }
            } catch (err: unknown) {
                console.error(`Failed to process lines: ${lines.join(", ")}`, err);
            }

            callback();
        },
    });
    
    await promisify(pipeline)(
        s3Stream,
        lineSplitter,
        linesProcessor,
    );

    return averageRecoveryTimes;
}

function processLines(lines: string[], averageRecoveryTimes: AverageRecoveryTimesMap): void {
    lines.forEach((line) =>{
        const columns = line.split(",");

        if (columns.length !== 4) {
            throw new Error(`Expected line to have four columns, instead found: ${columns.length}`);
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

// Helper function to get the S3 object as a stream
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
function isReadable(input: unknown): input is Readable {
    return input instanceof Readable;
}

function isNonEmptyString(input: unknown): input is string {
    return typeof input === "string" && input.length > 0;
}

function logMemoryUsage() {
    console.log("=================================");
    const used = process.memoryUsage();
    const heapUsed = used.heapUsed / 1024 / 1024;
    const heapTotal = used.heapTotal / 1024 / 1024;
    console.log(`The script uses approximately ${Math.round(heapUsed * 100) / 100} MB of a total ${Math.round(heapTotal)} MB`);
    console.timeEnd("handler");
    console.log("=================================");
}


// Local testing
function localTesting() {
    handler(null, {
        awsRequestId: "123",
        callbackWaitsForEmptyEventLoop: false,
        functionName: "",
        functionVersion: "",
        invokedFunctionArn: "",
        memoryLimitInMB: "",
        logGroupName: "",
        logStreamName: "",
        getRemainingTimeInMillis: function (): number {
            throw new Error("Function not implemented.");
        },
        done: function (error?: Error, result?: any): void {
            throw new Error("Function not implemented.");
        },
        fail: function (error: Error | string): void {
            throw new Error("Function not implemented.");
        },
        succeed: function (messageOrObject: any): void {
            throw new Error("Function not implemented.");
        }
    });
}
