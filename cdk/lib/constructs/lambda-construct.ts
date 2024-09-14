import type { DynamoDBTableConstruct } from "../constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as utils from "../utils";
import { Construct } from "constructs";
import { Environment } from "../types";

export class LambdaConstruct extends Construct {
    lambda: lambda.IFunction;
    environment: Environment;
    
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