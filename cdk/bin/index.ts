#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BackendStack } from "../lib/stacks/backend";
import { loadEnvFile } from "../lib/utils";
import environment from "../lib/config/environments";
import { getStackName } from "../lib/utils/prefix";

// Load .env file
if ("LOAD_ENVFILE" in process.env) {
    loadEnvFile();
}

const AWS_ACCOUNT = process.env.AWS_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
const AWS_REGION = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION;

const stackName = getStackName(environment);
const app = new cdk.App();

new BackendStack(app, "OxidizingLambdaFunctionsStack", {
    stackName,
    environment,
    env: {
        account: AWS_ACCOUNT,
        region: AWS_REGION,
    },
    tags: {
        STACK: stackName,
        APP: environment.appName,
    },
});

app.synth();
