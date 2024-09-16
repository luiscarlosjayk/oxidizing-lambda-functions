import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LambdaConstruct, LambdaConstructProps } from "./lambda-construct";
import * as nodePath from "node:path";
import * as utils from "../utils";
import * as pythonLambda from "@aws-cdk/aws-lambda-python-alpha";

export interface PythonLambdaConstructProps extends LambdaConstructProps {
    handler?: pythonLambda.PythonFunctionProps["handler"];
    index?: pythonLambda.PythonFunctionProps["index"];
};

export class PythonLambdaConstruct extends LambdaConstruct {
    constructor(scope: Construct, id: string, props: PythonLambdaConstructProps) {
        super(scope, id, props);

        const entry = nodePath.join(__dirname, `${utils.constants.LAMBDA_BASEPATH}/${props.entry}`);

        /**
         * Lamba Function
         */
        this.lambda = new pythonLambda.PythonFunction(this, `PythonFunction${id}`, {
            functionName: this.functionName,
            entry,
            index: props.index,
            handler: props.handler,
            runtime: lambda.Runtime.PYTHON_3_12,
            timeout: props.duration,
            environment: this.environmentVariables,
            memorySize: props.memorySize,
            reservedConcurrentExecutions: props.concurrency,
            layers: props.layers,
            logGroup: this.logGroup,
            role: this.role,
        });

        // Attachs permissions to resources like dynamoDB, s3Bucket, else
        this.grantPermissions(props);
    }
}
