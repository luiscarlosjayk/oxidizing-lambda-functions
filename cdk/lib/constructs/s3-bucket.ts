import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Environment } from "../types";
import { getStackPrefix } from "../utils";
import { RemovalPolicy } from "aws-cdk-lib";

export type S3BucketConstructProps = {
    environment: Environment;
    name: string;
}

export class S3BucketConstruct extends Construct {
    bucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: S3BucketConstructProps) {
        super(scope, id);

        const environment = props.environment;
        const bucketName = getStackPrefix(props.name, environment);
        
        this.bucket = new s3.Bucket(this, `Bucket${id}`, {
            bucketName,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
    }
}
