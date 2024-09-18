import type { Environment } from "../types";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { getStackPrefix } from "../utils";

export interface DynamoDBTableProps extends dynamodb.TableProps {
    tableName: string;
    environment: Environment;
}

export class DynamoDBTableConstruct extends Construct {
    table: dynamodb.Table;
    
    constructor(scope: Construct, id: string, props: DynamoDBTableProps) {
        super(scope, id);
        
        const tableProps = {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            tableClass: dynamodb.TableClass.STANDARD,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            ...props,
        };

        // Overrides the table name with a prefixed version
        tableProps.tableName = getStackPrefix(props.tableName, props.environment);
        this.table = new dynamodb.Table(this, `Table${id}`, tableProps);
    }
}
