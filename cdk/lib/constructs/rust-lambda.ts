import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RustFunction } from 'cargo-lambda-cdk';
import { Construct } from 'constructs';
import * as nodePath from 'node:path';
import { Environment } from '../types';
import * as utils from '../utils';
import { LambdaConstruct, LambdaConstructProps } from './lambda-construct';

export interface RustLambdaConstructProps extends LambdaConstructProps {};

export class RustLambdaConstruct extends LambdaConstruct {
    environment: Environment;

    constructor(scope: Construct, id: string, props: RustLambdaConstructProps) {
        super(scope, id, props);

        const manifestPath = nodePath.join(__dirname, `${utils.constants.LAMBDA_BASEPATH}/${props.entry}/Cargo.toml`);

        /**
         * Lambda Function
         */
        this.lambda = new RustFunction(this, `RustFunction${id}`, {
            functionName: this.functionName,
            manifestPath,
            timeout: props.duration ?? this.environment.duration,
            memorySize: props.memorySize ?? this.environment.memorySize,
            environment: this.environmentVariables,
            reservedConcurrentExecutions: props.concurrency,
            layers: props.layers,
            logGroup: this.logGroup,
            role: this.role,
            architecture: lambda.Architecture.ARM_64,
        });

        // Attachs permissions to resources like dynamoDB, s3Bucket, else
        this.grantPermissions(props);
    }
}
