import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as nodePath from 'node:path';
import * as utils from '../utils';
import { LambdaConstruct, LambdaConstructProps } from './lambda-construct';

export interface Node20LambdaConstructProps extends LambdaConstructProps {};

export class NodeLambdaConstruct extends LambdaConstruct {
    public lambda: nodejsLambda.NodejsFunction;

    constructor(scope: Construct, id: string, props: Node20LambdaConstructProps) {
        super(scope, id, props);

        const entry = nodePath.join(__dirname, `${utils.constants.LAMBDA_BASEPATH}/${props.entry}/index.ts`);

        /**
         * Lamba Function
         */
        this.lambda = new nodejsLambda.NodejsFunction(this, `Node20Function${id}`, {
            functionName: this.functionName,
            entry,
            timeout: props.duration ?? this.environment.duration,
            memorySize: props.memorySize ?? this.environment.memorySize,
            environment: this.environmentVariables,
            reservedConcurrentExecutions: props.concurrency,
            architecture: lambda.Architecture.ARM_64,
            layers: props.layers,
            bundling: {
                externalModules: [
                    '@aws-sdk/*',
                ],
                ...props.bundling,
            },
            logGroup: this.logGroup,
            role: this.role,
            runtime: lambda.Runtime.NODEJS_20_X,
        });

        // Attachs permissions to resources like dynamoDB, s3Bucket, else
        this.grantPermissions(props);
    }
}
