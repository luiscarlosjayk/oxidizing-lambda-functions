# Oxidizing Lambda Functions

This project is used to showcase benefits of using the Rust programming language in AWS lambda functions in comparison to other languages and runtimes.

Tools:

-   [Profiling functions with AWS Lambda Power Tuning](https://docs.aws.amazon.com/lambda/latest/operatorguide/profile-functions.html)

Check this for the talk on how to explain how lambda cold starts work:
https://www.apexon.com/blog/optimizing-aws-lambda-handling-cold-starts-for-serverless-heavy-applications/

# Lambda Strategies

## Python

### Python with Pandas:

#### One Million Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;FdGfR1VQC0cARKNGAIx4RqtkP0arpklGVUk/Rg==;9dyROYFNfjllApU5ByKqOVmxrjn5KAc6SyBVOg==

#### Ten Thousand Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;q27ZRatqWEWrmjhFqwooRVWdEUWrIhpFAPAaRQ==;c3PGN86JxTfvgCg4wRRmOLvohDgzsM44I54sOQ==

### Python with Polars:

#### One Million Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;VfFrRgCE80VVBYBFqyplRVWVR0WrCk9Fq0JDRQ==;jllXOChEXjgJtGk4mOGcOKAxtjiayAo5mplZOQ==

#### Ten Thousand Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;VfXIRavyPEWrmhpFAIgjRauKKkVVBSFFAHgvRQ==;l2u3NyN/rDeMHw04pOtfOEmrmzh659c404ZDOQ==

### Nodejs 20.x:

#### One Million Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;Vf9wRgCc70VV7WxFq2IsRatyB0VVvQpFAGAHRQ==;vfRbOHqzWjiNP1g4DhJsOCBWdziL/rk4qtIWOQ==

#### Ten Thousand Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;qyooRKsq2EOr6oNDqyqKQ6sql0MAgGRDAABfQw==;+o4ZNmiYRTaa8nA2AZy9NmdFCje5fBk3bXJ4Nw==

### Node LLRT:

Reference: https://medium.com/@o.hanhaliuk/aws-lambda-javascript-low-latency-runtime-llrt-benchmark-part-2-cd70c989e49c

#### One Million Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;wIGER1U0AkdV0oNGVdFVRlUpF0ZVYRZGVX0VRg==;pWSVOZfMkjl5oJQ5mM60OYBvqjmVCPk5EsBNOg==

#### Ten Thousand Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;ANCDRFUVCkQAQK1DAECVQ6vqjENVFZJDAACRQw==;AK6UNvfdmzbim8M2cNP8Nq33HjdLl3I3n47HNw==

### Rust

#### One Million Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;VemvRatCLUVV5b1EVQWlRFVljUSrSo1EVYWMRA==;IpOgN9AtnjfIaK03QA/iN/EkAThcgz04CKycOA==

#### Ten Thousand Rows

https://lambda-power-tuning.show/#AAEAAgAEAAYACMALiBM=;VdV/Q6sqYUOrqltDAIBLQ6sqZENV1U9Dq6pPQw==;b6VpNQxEzjUrykg236OLNvwA0TZ2aQs3PLxnNw==
