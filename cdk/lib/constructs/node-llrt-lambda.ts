import { Construct } from "constructs";
import * as llrtLambda from "cdk-lambda-llrt";
import { LambdaConstruct, LambdaConstructProps } from "./lambda-construct";
import * as nodePath from "node:path";
import * as utils from "../utils";

export interface NodeLlrtLambdaConstructProps extends LambdaConstructProps {};

export class NodeLlrtLambdaConstruct extends LambdaConstruct {
    constructor(scope: Construct, id: string, props: NodeLlrtLambdaConstructProps) {
        super(scope, id, props);

        const entry = nodePath.join(__dirname, `${utils.constants.LAMBDA_BASEPATH}/${props.entry}/index.ts`);

        /**
         * Lamba Function
         */
        this.lambda = new llrtLambda.LlrtFunction(this, `NodeLLRTFunction${id}`, {
            functionName: this.functionName,
            entry,
            timeout: props.duration ?? this.environment.duration,
            memorySize: props.memorySize ?? this.environment.memorySize,
            environment: this.environmentVariables,
            reservedConcurrentExecutions: props.concurrency,
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
            logGroup: this.logGroup,
            role: this.role,
        });

        // Attachs permissions to resources like dynamoDB, s3Bucket, else
        this.grantPermissions(props);
    }
}
