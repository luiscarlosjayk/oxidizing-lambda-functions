import { Duration } from "aws-cdk-lib";

export type EnvironmentRegion = "us-east-1" | "us-west-2";

export type Environment = {
  appName: string;
  region: EnvironmentRegion;
  provisionedConcurrencyEnabled: boolean;
  fileName: string;
  memorySize?: number;
  duration?: Duration;
};