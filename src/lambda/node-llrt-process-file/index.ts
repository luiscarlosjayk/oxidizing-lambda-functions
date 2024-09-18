import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import {
    S3Client,
    GetObjectCommand,
    GetObjectCommandInput,
    GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, BatchWriteItemCommand, BatchWriteItemCommandInput } from "@aws-sdk/client-dynamodb";
import * as udsv from "udsv";

type Row = {
    Hospital: string;
    Diagnosis: string;
    Treatment: string;
    "Recovery Time": string;
};

type GroupedData = Record<
string,
Record<
string,
{
    totalRecoveryTime: number;
    count: number;
    treatments: Record<
    string,
    number
    >;
}
>
>;

type Average = {
    Hospital: string;
    Diagnosis: string;
    AverageRecoveryTime: number;
    MostUsedTreatment: string;
};

const S3_BUCKET = process.env.S3_BUCKET;
const FILE_NAME = process.env.FILE_NAME;
const DB_TABLE = process.env.DB_TABLE;

const s3Client = new S3Client();
const dynamoDBClient = new DynamoDBClient();

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    console.log(`Node20 process file lambda invoked: ${context.awsRequestId}`);
    
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
        const sourceBucket = S3_BUCKET;
        const sourceFileName = FILE_NAME;
        const dynamoDBTable = DB_TABLE;
        const getObjectResponse = await getObjectFromBucket(sourceFileName, sourceBucket);
        const data = getObjectResponse.Body;
        
        if (!data?.transformToString) {
            throw TypeError("Expected Body to be a Readable stream");
        }
        
        const csvText = await data.transformToString();
        const averages = await processCSVData(csvText);
        
        console.log(JSON.stringify({
            msg: "Data",
            averages,
        }, null, 2));
        
        await writeDataToDB(averages, requestId, dynamoDBTable);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Ok",
            }),
        };
    } catch(err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal error",
            }),
        };
    }
}

async function processCSVData(data: string): Promise<Average[]> {
    const schema = udsv.inferSchema(data);
    const parser = udsv.initParser(schema);
    const parsedDataRows: Row[] = parser.typedObjs(data);
    
    const groupedData: GroupedData = {};
    
    return new Promise((resolve, reject) => {
        try {
            parsedDataRows.forEach((row) => {
                const {
                    Hospital: hospital,
                    Diagnosis: diagnosis,
                    Treatment: treatment,
                } = row;
                const recoveryTime = parseFloat(row["Recovery Time"]);
                
                if (!groupedData[hospital]) {
                    groupedData[hospital] = {};
                }
                
                if (!groupedData[hospital][diagnosis]) {
                    groupedData[hospital][diagnosis] = {
                        totalRecoveryTime: 0,
                        count: 0,
                        treatments: {},
                    };
                }
                
                if (!groupedData[hospital][diagnosis]["treatments"][treatment]) {
                    groupedData[hospital][diagnosis]["treatments"][treatment] = 0;
                }
                
                groupedData[hospital][diagnosis].totalRecoveryTime += recoveryTime;
                groupedData[hospital][diagnosis].count += 1;
                groupedData[hospital][diagnosis]["treatments"][treatment] += 1;
            });
            
            const averages: Average[] = [];
            
            for (const hospital in groupedData) {
                for (const diagnosis in groupedData[hospital]) {
                    const entry = groupedData[hospital][diagnosis];
                    const averageTime = parseFloat((entry.totalRecoveryTime / entry.count).toFixed(2));
                    const mostUsedTreatment = Object.entries(entry.treatments).reduce((prevTreatment, currentTreatment) => {
                        if (currentTreatment[1] > prevTreatment[1]) {
                            return currentTreatment;
                        }
                        
                        return prevTreatment;
                    });
                    
                    const average: Average = {
                        Hospital: hospital,
                        Diagnosis: diagnosis,
                        AverageRecoveryTime: averageTime,
                        MostUsedTreatment: mostUsedTreatment[0],
                    };
                    averages.push(average);
                }
            }
            
            return resolve(averages);
        } catch(err: unknown) {
            console.error(err);
            return reject(err);
        }
    });
}

async function getObjectFromBucket(filePath: string, bucket: string): Promise<GetObjectCommandOutput> {
    try {
        const input: GetObjectCommandInput = {
            Bucket: bucket,
            Key: filePath,
        };
        console.log(input);
        const command = new GetObjectCommand(input);
        
        return s3Client.send(command);
    } catch(err: unknown) {
        console.error(err);
        throw "getObjectFromBucket: Expected to get object from s3 bucket"
    }
}

async function writeDataToDB(averages: Average[], requestId: string, dynamoDBTable: string) {
    try {
        const partitionKey = requestId;
        const putRequests = averages.map((average) => {
            const sortKey = `#diagnosis#${average.Diagnosis}#hospital#${average.Hospital}`;
            
            const putRequest = {
                PutRequest: {
                    Item: {
                        PK: { S: partitionKey },
                        SK: { S: sortKey },
                        Hospital: { S: average.Hospital },
                        Diagnosis: { S: average.Diagnosis },
                        MostUsedTreatment: { S: average.MostUsedTreatment },
                        AverageRecoveryTime: { N: average.AverageRecoveryTime.toString() },
                    },
                }
            };
            
            return putRequest;
        });
        
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
    } catch(err: unknown) {
        console.error(err);
        throw "writeDataToDB: Expected to have written to dynamoDB table";
    }
}

function isNonEmptyString(input: unknown): input is string {
    return typeof input === "string" && input.length > 0;
}
