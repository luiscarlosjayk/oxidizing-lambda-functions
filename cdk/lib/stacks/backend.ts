import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    NodeLambdaConstruct,
    NodeLlrtLambdaConstruct,
    RustLambdaConstruct,
    PythonLambdaConstruct,
    DynamoDBTableConstruct,
    S3BucketConstruct,
} from "../constructs";
import { Environment } from "../types";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

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
            withAssets: true,
        });

        /**
         * DynamoDB tables
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

        const pythonPandasDynamoDBTable = new DynamoDBTableConstruct(this, "PythonPandasDynamoDBTable", {
            tableName: "python-pandas-hospital-averages-table",
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

        const pythonPolarsDynamoDBTable = new DynamoDBTableConstruct(this, "PythonPolarsDynamoDBTable", {
            tableName: "python-polars-hospital-averages-table",
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
                FILE_NAME: environment.numberOfRows,
            },
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
                FILE_NAME: environment.numberOfRows,
            },
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
                FILE_NAME: environment.numberOfRows,
            },
            s3Buckets: {
                "S3_BUCKET": assetsSourceBucket,
            },
            dynamoDB: {
                "DB_TABLE": rustDynamoDBTable,
            },
        });

        // Python with Pandas
        new PythonLambdaConstruct(this, "PythonPandasProcessFileLambda", {
            name: "python-pandas-process-file",
            entry: "python-pandas-process-file",
            index: "python_pandas_process_file/index.py",
            environment,
            environmentVariables: {
                FILE_NAME: environment.numberOfRows,
            },
            s3Buckets: {
                "S3_BUCKET": assetsSourceBucket,
            },
            dynamoDB: {
                "DB_TABLE": pythonPandasDynamoDBTable,
            },
        });

        // Python with Polars
        new PythonLambdaConstruct(this, "PythonPolarsProcessFileLambda", {
            name: "python-polars-process-file",
            entry: "python-polars-process-file",
            index: "python_polars_process_file/index.py",
            environment,
            environmentVariables: {
                FILE_NAME: environment.numberOfRows,
            },
            s3Buckets: {
                "S3_BUCKET": assetsSourceBucket,
            },
            dynamoDB: {
                "DB_TABLE": pythonPolarsDynamoDBTable,
            },
        });
        
    }
}
