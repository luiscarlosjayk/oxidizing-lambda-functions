import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    NodeLambdaConstruct,
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
        const dynamoDBTable = new DynamoDBTableConstruct(this, "DynamoDBTable", {
            tableName: "hospital-averages-table",
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
                "DB_TABLE": dynamoDBTable,
            },
        });
    }
}