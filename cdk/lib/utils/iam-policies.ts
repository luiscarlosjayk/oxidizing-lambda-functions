import * as cdk from 'aws-cdk-lib';
import { FoundationModelIdentifier } from 'aws-cdk-lib/aws-bedrock';
import { Effect, type PolicyStatementProps } from 'aws-cdk-lib/aws-iam';

export function createSecretsManagerPolicyStatementProps(
    secretArn: string,
    actions?: string[],
    effect = Effect.ALLOW,
  ): PolicyStatementProps {
    actions ??= [ // Default actions if none are passed
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
    ];

    return {
        effect,
        resources: [secretArn],
        actions,
    };
}

export function createS3BucketPolicyStatementProps(
    bucketArn: string,
    actions?: string[],
    effect = Effect.ALLOW
): PolicyStatementProps {
    actions ??= [ // Default actions if none are passed
        's3:PutObject',
        's3:ListBucket',
        's3:GetObject',
    ];

    return {
        effect,
        resources: [`${bucketArn}/*`, bucketArn],
        actions,
    };
}

export function createDynamoDbTablePolicyStatementProps(
    tableArn: string,
    actions?: string[],
    effect = Effect.ALLOW
): PolicyStatementProps {
    actions??= [ // Default actions if none are passed
        'dynamodb:Scan',
        'dynamodb:Query',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
    ];

    return {
        effect,
        resources: [tableArn],
        actions,
    };
}

export function createDatabaseClusterPolicyStatementProps(
    dbClusterResourceIds: string[],
    account: string,
    region: string,
    dbUserName: string,
    actions?: string[],
    effect = Effect.ALLOW,
): PolicyStatementProps[] {
    actions??= [
        'rds-db:connect',
    ];
    const resources = dbClusterResourceIds.map(
        (dbClusterResourceId) => `arn:aws:rds-db:${region}:${account}:dbuser:${dbClusterResourceId}/${dbUserName}`
    );

    return [{
        effect,
        resources,
        actions,
    }];
}

export function createBedrockFoundationModelPolicyStatementProps(
    bedrockModelIdentifier: FoundationModelIdentifier | string,
    actions?: string[]
): PolicyStatementProps {
    actions??= [ // Default actions if none are passed
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
    ];
    const modelId = typeof bedrockModelIdentifier ==='string'
        ? bedrockModelIdentifier
        : bedrockModelIdentifier.modelId;

    return {
        effect: Effect.ALLOW,
        resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/${modelId}`,
        ],
        actions,
    };
}
