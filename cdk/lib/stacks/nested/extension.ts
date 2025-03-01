import * as cdk from 'aws-cdk-lib';
import { RustExtension } from 'cargo-lambda-cdk';
import { Construct } from 'constructs';
import * as nodePath from 'node:path';
import { NodeLambdaConstruct } from '../../constructs';
import { Environment } from '../../types/environment';
import * as utils from '../../utils';
import { getStackPrefix } from '../../utils';
interface ExtensionStackProps extends cdk.NestedStackProps {
    environment: Environment;
}

export class ExtensionStack extends cdk.NestedStack {
    constructor(scope: Construct, id: string, props: ExtensionStackProps) {
        super(scope, id, props);

        const { environment } = props;
        const basePath = nodePath.join(__dirname, `${utils.constants.LAMBDA_EXTENSION_BASEPATH}`);

        /**
         * Lambda Extension
         */
        const extensionLayer = new RustExtension(this, 'RustExtension', {
            manifestPath: `${basePath}/rusty-lambda-extension`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            layerVersionName: getStackPrefix('rusty-lambda-extension', environment),
            bundling: {
                cargoLambdaFlags: [
                  '--target',
                  'aarch64-unknown-linux-gnu',
                  '--release',
                ],
            },
        });

        const nodejsLambda = new NodeLambdaConstruct(this, 'Node20ProcessFileLambda', {
            name: 'node-with-rust-extension',
            entry: 'node-with-rust-extension',
            environment,
            environmentVariables: {
                RUSTY_EXTENSION_PORT: '9876',
            },
            layers: [extensionLayer],
        });

        /**
         * Outputs
         */
        new cdk.CfnOutput(this, 'LambdaExtensionArn', {
            value: extensionLayer.layerVersionArn,
            exportName: getStackPrefix('lambda-extension-arn', environment),
        });

        new cdk.CfnOutput(this, 'NodejsWithRustExtensionLambdaArn', {
            value: nodejsLambda.lambda.functionArn,
            exportName: getStackPrefix('nodejs-with-rust-extension-lambda-arn', environment),
        });
    }
}