import { Duration } from "aws-cdk-lib";
import type { Environment } from "../../types/environment";

const environment: Environment = {
    appName: "oxidizing-lambda-functions",
    region: "us-east-1",
    provisionedConcurrencyEnabled: false,
    fileName: "one_hundred_medical_records.csv",
    // fileName: "one_million_rows_medical_records.csv",
    memorySize: 512,
    duration: Duration.minutes(5),
};  

export default environment;
