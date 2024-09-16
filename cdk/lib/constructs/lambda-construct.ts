import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as utils from "../utils";
import { Construct } from "constructs";
import { Environment } from "../types";
import * as cdk from "aws-cdk-lib";
import * as nodejsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { S3BucketConstruct, DynamoDBTableConstruct } from ".";

export interface LambdaConstructProps {
    name: string;
    entry: string;
    duration?: cdk.Duration;
    memorySize?: number;
    environmentVariables?: {
        [key: string]: string;
    };
    concurrency?: number;
    layers?: lambda.ILayerVersion[];
    bundling?: nodejsLambda.BundlingOptions;
    policies?: iam.PolicyStatementProps[],
    environment: Environment;
    dynamoDB?: Record<string, DynamoDBTableConstruct>;
    s3Buckets?: Record<string, S3BucketConstruct>;
}

export class LambdaConstruct extends Construct {
    protected lambda: lambda.IFunction;
    readonly environment: Environment;
    readonly role: iam.Role;
    readonly logGroup: logs.LogGroup;
    readonly environmentVariables: Record<string, string>;
    readonly functionName: string;

    constructor(scope: Construct, id: string, props: LambdaConstructProps) {
        super(scope, id);

        this.environment = props.environment;
        this.functionName = utils.getStackPrefix(props.name, this.environment);
        
        /**
         * CloudWatch
         */
        this.logGroup = new logs.LogGroup(this, `LogGroup${id}`, {
            logGroupName: `/aws/lambda/${this.functionName}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_WEEK,
        });

        /**
         * IAM - Permissions
         */
        this.role = new iam.Role(this, `Role${id}`, {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal("lambda.amazonaws.com")
            ),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(`service-role/AWSLambdaVPCAccessExecutionRole`),
            ]
        });

        const defaultPolicyStatement = this.createDefaultLambdaPolicyStatementProps();

        const policyStatements = defaultPolicyStatement.concat(
            props.policies ?? [],
        );

        this.role.attachInlinePolicy(
            new iam.Policy(this, `Policy${id}`, {
              statements: policyStatements.map(
                ({ effect, resources, actions }) =>
                  new iam.PolicyStatement({
                    effect,
                    resources,
                    actions
                  })
              )
            })
        );

        /**
         * Environment Variables
         */
        this.environmentVariables = {
            ...props.environmentVariables,
        };

        // Attach DynamoDB tables ARNs as environment variables
        for (const key in props.dynamoDB) {
            this.environmentVariables[key] = props.dynamoDB[key].table.tableName;
        }

        // Attach S3 buckets ARNs as environment variables
        for (const key in props.s3Buckets) {
            this.environmentVariables[key] = props.s3Buckets[key].bucket.bucketName;
        }
    }

    protected grantPermissions(props: LambdaConstructProps) {
        if (!this.role) {
            throw TypeError("Expected this.role to be defined before calling grantPermissions method");
        }
        
        // Grant read and write permissions to DynamoDB table
        if (props.dynamoDB) {
            Object.values(props.dynamoDB).forEach((dynamoDB) => {
                dynamoDB.table.grantReadWriteData(this.role);
            });
        }

        // Grant read and write permissions to S3 Bucket
        if (props.s3Buckets) {
            Object.values(props.s3Buckets).forEach((s3Bucket) => {
                s3Bucket.bucket.grantReadWrite(this.role);
            });
        }
    }
    
    protected createDefaultLambdaPolicyStatementProps(): iam.PolicyStatementProps[] {
        return [
            {
                effect: iam.Effect.ALLOW,
                resources: ["*"],
                actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:DescribeLogGroups",
                    "logs:DescribeLogStreams",
                    "logs:PutLogEvents"
                ]
            },
            {
                effect: iam.Effect.ALLOW,
                resources: ["*"],
                actions: [
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:CreateNetworkInterface",
                    "ec2:DeleteNetworkInterface",
                    "ec2:DescribeInstances",
                    "ec2:AttachNetworkInterface"
                ]
            },
        ];
    }
    
    protected createDynamoDbTablePolicyStatementProps(dynamoDBTableConstructs?: DynamoDBTableConstruct[]): iam.PolicyStatementProps[] {
        if (!dynamoDBTableConstructs) {
            return [];
        }
        
        const dynamoDBTableArns = dynamoDBTableConstructs.map(table => table.table.tableArn);
        
        return dynamoDBTableArns.map(arn => utils.createDynamoDbTablePolicyStatementProps(arn));
    }
    
}