# How to Deploy

This project is deployed using AWS CDK to deploy a CloudFormation stack written in Typescript.

And other tools like Docker, Poetry, npm and Cargo Lambda are used for locally bundling each different type of lambda function depending the language.

# Requirements

You will need already installed the following tools:

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [Docker](https://www.docker.com/products/docker-desktop)
- [Rust](https://www.rust-lang.org)
- [Cargo Lambda](https://www.cargo-lambda.info)
- [Poetry (Python)](https://python-poetry.org)
- [Node and npm](https://nodejs.org)

# How to Deploy

Assuming you already have bootstrapped the CDK in your AWS account and that you have a profile already configured prior to invoke the AWS CLI, you can follow these steps in order to do a deployment of the stack:

```bash
# bash
cd cdk
npm install
npm run cdk:deploy
```

# Cleanup

To clean all the resources deployed follow these steps:

```bash
# bash
cd cdk
npm install # If not done previously
npm run cdk:destroy
```

Also, get into the console and make sure in S3 and CloudWatch that all resources were removed, because sometimes they aren't completely deleted.
