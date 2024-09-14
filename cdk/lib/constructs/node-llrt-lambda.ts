import { Construct } from "constructs";
import * as llrtLambda from "cdk-lambda-llrt";
import type { DynamoDBTableConstruct, S3BucketConstruct } from "../constructs";
import type { Environment } from "../types";
import { LambdaConstruct } from "./lambda-construct";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as nodePath from "node:path";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as utils from "../utils";

export type NodeLlrtLambdaConstructProps = {
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
};

export class NodeLlrtLambdaConstruct extends LambdaConstruct {
    constructor(scope: Construct, id: string, props: NodeLlrtLambdaConstructProps) {
        super(scope, id);

        const environment = this.environment = props.environment;
        const functionName = utils.getStackPrefix(props.name, environment);
        const entry = nodePath.join(__dirname, `${utils.constants.LAMBDA_BASEPATH}/${props.entry}/index.ts`);

        /**
         * CloudWatch
         */
        const logGroup = new logs.LogGroup(this, `LogGroup${id}`, {
            logGroupName: `/aws/lambda/${functionName}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_WEEK,
        });

        /**
         * IAM - Permissions
         */
        const role = new iam.Role(this, `Role${id}`, {
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

        role.attachInlinePolicy(
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
        const environmentVariables = {
            ...props.environmentVariables,
        };

        // Attach DynamoDB tables ARNs as environment variables
        for (const key in props.dynamoDB) {
            environmentVariables[key] = props.dynamoDB[key].table.tableName;
        }

        // Attach S3 buckets ARNs as environment variables
        for (const key in props.s3Buckets) {
            environmentVariables[key] = props.s3Buckets[key].bucket.bucketName;
        }

        /**
         * Lamba Function
         */
        this.lambda = new llrtLambda.LlrtFunction(this, `Function${id}`, {
            functionName,
            entry,
            timeout: props.duration,
            environment: environmentVariables,
            memorySize: props.memorySize,
            reservedConcurrentExecutions: props.concurrency,
            // architecture: lambda.Architecture.ARM_64,
            layers: props.layers,
            bundling: {
                externalModules: [
                    "@aws-sdk/*",
                ],
                esbuildArgs: {
                    "--platform": "browser",
                },
                ...props.bundling,
                // forceDockerBundling: true, // Reference: https://constructs.dev/packages/cdk-lambda-llrt/v/0.0.11?lang=typescript
            },
            logGroup,
            role,
            // runtime: lambda.Runtime.NODEJS_20_X,
        });

        // Grant read and write permissions to DynamoDB table
        if (props.dynamoDB) {
            Object.values(props.dynamoDB).forEach((dynamoDB) => {
                dynamoDB.table.grantReadWriteData(role);
            });
        }

        // Grant read and write permissions to S3 Bucket
        if (props.s3Buckets) {
            Object.values(props.s3Buckets).forEach((s3Bucket) => {
                s3Bucket.bucket.grantReadWrite(role);
            });
        }
    }
}