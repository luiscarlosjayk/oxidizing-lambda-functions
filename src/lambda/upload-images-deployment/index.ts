import { CdkCustomResourceEvent, Context } from "aws-lambda";
import { PutObjectAclCommandOutput, PutObjectCommand, PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import { PathLike } from "node:fs";

enum Status {
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
}

type Response = {
    Status: Status;
    Reason: string;
    PhysicalResourceId: string;
    StackId: string;
    RequestId: string;
    LogicalResourceId: string;
}

const S3_BUCKET = process.env.S3_BUCKET;
const IMAGES_PATH = process.env.IMAGES_PATH || "images";

if (typeof S3_BUCKET !== "string" || S3_BUCKET.length === 0) {
    throw TypeError("S3_BUCKET environment variable is invalid or missing.");
}

if (typeof IMAGES_PATH !== "string" || S3_BUCKET.length === 0) {
    throw TypeError("IMAGES_PATH environment variable is invalid or missing.");
}

// Initialize S3 Client
const s3Client = new S3Client();

export async function handler(event: CdkCustomResourceEvent, context: Context): Promise<void> {
    console.log("UploadImagesDeploymentLambda invoked with event: ", event);
    
    try {
        await uploadFilesFromDirectory(IMAGES_PATH);
        await sendResponse(event.ResponseURL, formatResponse(Status.SUCCESS, event, context));
    } catch(err) {
        console.error(err);
        await sendResponse(event.ResponseURL, formatResponse(Status.FAILED, event, context));
    }
}

async function sendResponse(responseUrl: string, responseBody: Response): Promise<void> {
    try {
        const response = await fetch(responseUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "",
            },
            body: JSON.stringify(responseBody),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to send response: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error occurred while sending the response:", error);
        throw error;
    }
};

// References: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-lambda-function-code-cfnresponsemodule.html
function formatResponse(status: Status, event: CdkCustomResourceEvent, context: Context): Response {
    const stackId = event.StackId;
    const requestId = event.RequestId;
    const logicalResourceId = event.LogicalResourceId;
    const reason = `See the details in CloudWatch Log Stream: ${context.logStreamName}`;
    
    const output: Response = {
        Status: status,
        StackId: stackId,
        Reason: reason,
        RequestId: requestId,
        LogicalResourceId: logicalResourceId,
        PhysicalResourceId: "Custom::UploadImagesDeploymentCustomResource",
    };
    
    return output;
}

async function createUploadFilePromise(
    fileSourcePath: string,
    fileDestPath: string
): Promise<PutObjectAclCommandOutput> {
    const input: PutObjectCommandInput = {
        Bucket: S3_BUCKET,
        Key: fileSourcePath,
        Body: fileDestPath,
    };
    const command: PutObjectCommand = new PutObjectCommand(input);
    
    return s3Client.send(command);
}

async function uploadFilesFromDirectory(path: PathLike): Promise<PutObjectAclCommandOutput[]> {
    try {
        const files = await fs.readdir(path);
        const filesUploadPromises = files.map((file) => {
            const filePath = `./${path}/${file}`;
            return createUploadFilePromise(filePath, file);
        });
        
        return Promise.all(filesUploadPromises);
    } catch(err) {
        console.error(err);
        throw `Failed uploading files from directory: ${path}`;
    }
}
