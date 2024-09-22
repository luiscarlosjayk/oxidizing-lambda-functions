import { Duration } from "aws-cdk-lib";

export type EnvironmentRegion = "us-east-1" | "us-west-2";

export type Environment = {
  appName: string;
  region: EnvironmentRegion;
  provisionedConcurrencyEnabled: boolean;
  /**
   * 
   */
  numberOfRows: NUMBER_OF_ROWS;
  memorySize?: number;
  duration?: Duration;
};

/**
 * Enum representing the different CSV files containing medical records with varying number of rows.
 * Possible values are:
 * - TEN_THOUSAND
 * - ONE_MILLION
 */
export enum NUMBER_OF_ROWS {
  /**
   * CSV file containing ten thousand rows of medical records.
   * Value: "ten_thousand_rows_medical_records.csv"
   */
  TEN_THOUSAND = "ten_thousand_rows_medical_records.csv",

  /**
   * CSV file containing one million rows of medical records.
   * Value: "one_million_rows_medical_records.csv"
   */
  ONE_MILLION = "one_million_rows_medical_records.csv",
}
