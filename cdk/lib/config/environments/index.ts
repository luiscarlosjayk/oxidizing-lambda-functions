import { Duration } from "aws-cdk-lib";
import { Environment, NUMBER_OF_ROWS } from "../../types/environment";

const environment: Environment = {
    appName: "oxidizing-lambda-functions",
    region: "us-east-1",
    provisionedConcurrencyEnabled: false,
    numberOfRows: NUMBER_OF_ROWS.ONE_MILLION,
    memorySize: 512,
    duration: Duration.minutes(5),
};  

export default environment;
