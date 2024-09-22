import { Construct } from "constructs";
import { Environment } from "../types";
import { getStackPrefix } from "../utils";
import { RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { ASSETS_BASEPATH } from "../utils/constants";

export interface S3BucketConstructProps {
    environment: Environment;
    name: string;
    /**
     * If this is set true, the content from the /assets folder will be uploaded during deployment
     *
     * @default true
     */
    withAssets?: boolean;
}

export class S3BucketConstruct extends Construct {
    bucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: S3BucketConstructProps) {
        super(scope, id);

        const environment = props.environment;
        const bucketName = getStackPrefix(props.name, environment);
        const withAssets = props.withAssets ?? true;
        
        this.bucket = new s3.Bucket(this, `Bucket${id}`, {
            bucketName,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });


        // This uploads files in the /assets directory to the bucket
        if (withAssets) {
            new s3deploy.BucketDeployment(this, "UploadAssetsDeployment", {
                sources: [s3deploy.Source.asset(ASSETS_BASEPATH)],
                destinationBucket: this.bucket,
            });
        }
    }
}
