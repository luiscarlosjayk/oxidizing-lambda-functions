import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    NodeLambdaConstruct,
    NodeLlrtLambdaConstruct,
    RustLambdaConstruct,
    DynamoDBTableConstruct,
    S3BucketConstruct,
} from "../constructs";
import { Environment } from "../types";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export interface BackendStackProps extends cdk.StackProps {
    environment: Environment;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        const environment = props.environment;

        /**
         * S3 Buckets
         */
        const assetsSourceBucket = new S3BucketConstruct(this, "AssetsSourceBucket", {
            name: "assets-source",
            environment,
        });

        /**
         * UploadImagesDeployment
         * 
         * This uploads files in the src/assets directory to the source bucket
         */
        new s3deploy.BucketDeployment(this, "UploadAssetsDeployment", {
            sources: [s3deploy.Source.asset("../src/assets")],
            destinationBucket: assetsSourceBucket.bucket,
        });

        /**
         * DynamoDB table
         */
        const nodeLlrtDynamoDBTable = new DynamoDBTableConstruct(this, "NodeLLRTDynamoDBTable", {
            tableName: "node-llrt-hospital-averages-table",
            environment,
            partitionKey: {
                name: "PK",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "SK",
                type: dynamodb.AttributeType.STRING,
            },
        });
        
        const node20DynamoDBTable = new DynamoDBTableConstruct(this, "Node20DynamoDBTable", {
            tableName: "node-20-hospital-averages-table",
            environment,
            partitionKey: {
                name: "PK",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "SK",
                type: dynamodb.AttributeType.STRING,
            },
        });

        const rustDynamoDBTable = new DynamoDBTableConstruct(this, "RustDynamoDBTable", {
            tableName: "rust-hospital-averages-table",
            environment,
            partitionKey: {
                name: "PK",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "SK",
                type: dynamodb.AttributeType.STRING,
            },
        });

        /**
         * Lambda functions
         */

        // Nodejs 20.X
        new NodeLambdaConstruct(this, "Node20ProcessFileLambda", {
            name: "node-20-process-file",
            entry: "node-20-process-file",
            environment,
            environmentVariables: {
                FILE_NAME: environment.fileName,
            },
            duration: cdk.Duration.minutes(1),
            s3Buckets: {
                "S3_BUCKET": assetsSourceBucket,
            },
            dynamoDB: {
                "DB_TABLE": node20DynamoDBTable,
            },
        });
        
        // Node LLRT
        new NodeLlrtLambdaConstruct(this, "NodeLLRTProcessFileLambda", {
            name: "node-llrt-process-file",
            entry: "node-llrt-process-file",
            environment,
            environmentVariables: {
                FILE_NAME: environment.fileName,
            },
            duration: cdk.Duration.minutes(1),
            s3Buckets: {
                "S3_BUCKET": assetsSourceBucket,
            },
            dynamoDB: {
                "DB_TABLE": nodeLlrtDynamoDBTable,
            },
        });

        // Rust
        new RustLambdaConstruct(this, "RustProcessFileLambda", {
            name: "rust-process-file",
            entry: "rust-process-file",
            environment,
            environmentVariables: {
                FILE_NAME: environment.fileName,
            },
            duration: cdk.Duration.minutes(1),
            s3Buckets: {
                "S3_BUCKET": assetsSourceBucket,
            },
            dynamoDB: {
                "DB_TABLE": rustDynamoDBTable,
            },
        });
        
    }
}