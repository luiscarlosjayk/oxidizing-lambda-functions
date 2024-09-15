use aws_config::meta::region::RegionProviderChain;
use aws_sdk_dynamodb::{
    self as dynamodb,
    types::{AttributeValue, PutRequest, WriteRequest},
};
use aws_sdk_s3::{self as s3, operation::get_object::GetObjectOutput};
use lambda_http::{
    http::{header, StatusCode},
    run, service_fn,
    tower::ServiceBuilder,
    tracing, Body, Error, Request, RequestExt, Response,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Serialize, Debug)]
struct AverageRecord {
    hospital: String,
    diagnosis: String,
    average_recovery_time: f64,
    most_used_treatment: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct TableItem {
    #[serde(rename = "PK")]
    pk: String,
    #[serde(rename = "SK")]
    sk: String,
    #[serde(rename = "Hospital")]
    hospital: String,
    #[serde(rename = "Diagnosis")]
    diagnosis: String,
    #[serde(rename = "MostUsedTreatment")]
    most_used_treatment: String,
    #[serde(rename = "AverageRecoveryTime")]
    average_recovery_time: f64,
}

type GroupedData = HashMap<(String, String), (f64, usize, HashMap<String, usize>)>;

#[tracing::instrument(skip(event, s3_client, dynamodb_client))]

async fn function_handler(
    event: Request,
    s3_client: &s3::Client,
    dynamodb_client: &dynamodb::Client,
) -> Result<Response<Body>, Error> {
    // Extract request_id from event
    let lambda_http::request::RequestContext::ApiGatewayV1(request_context) =
        event.request_context();
    let request_id = request_context
        .request_id
        .ok_or(Error::from("Expected request_id to be set"))?;

    // Read environment variables
    let bucket_name =
        std::env::var("S3_BUCKET").expect("Expected environment variable S3_BUCKET to be set");
    let file_name =
        std::env::var("FILE_NAME").expect("Expected environment variable FILE_NAME to be set");
    let db_table =
        std::env::var("DB_TABLE").expect("Expected environment variable DB_TABLE to be set");

    // Process S3 File
    let averages = process_csv_data(&file_name, &bucket_name, s3_client).await?;

    // Store the averages in DynamoDB
    store_results_in_dynamodb(dynamodb_client, &db_table, averages, &request_id).await?;

    // tracing::info!("Averages: {:#?}", &averages);

    let resp = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime::TEXT_HTML.to_string())
        .body(Body::Empty)
        .map_err(Box::new)?;

    Ok(resp)
}

async fn process_csv_data(
    file_name: &str,
    bucket_name: &str,
    s3_client: &s3::Client,
) -> Result<Vec<AverageRecord>, Error> {
    // Gets the csv file from S3
    let get_object_response = get_object_from_bucket(file_name, bucket_name, s3_client).await?;

    // Collects the byte strem into a single buffer
    let bytes = get_object_response.body.collect().await?.into_bytes();

    // Parse the csv file
    let csv_reader = quick_csv::Csv::from_reader(&bytes[..]).has_header(true);

    // Initialize a HashMap to group data and calculate totals
    let mut grouped_data: GroupedData = HashMap::new();

    // Read and process each row
    for row_result in csv_reader.into_iter() {
        if let Ok((hospital, diagnosis, treatment, recovery_time)) = row_result
            .ok()
            .unwrap()
            .decode::<(String, String, String, f64)>()
        {
            // Update the HashMap with the new recovery time and treatment count
            let key = (hospital, diagnosis);
            let entry = grouped_data.entry(key).or_insert((0.0, 0, HashMap::new()));

            entry.0 += recovery_time;
            entry.1 += 1;
            *entry.2.entry(treatment).or_insert(0) += 1;
        } else {
            tracing::error!("Expected to be able to decode line from csv into Row struct");
        }
    }

    // Calculate averages and find the most common treatment
    let averages = grouped_data
        .into_iter()
        .map(|((hospital, diagnosis), (total_time, count, treatments))| {
            // Determine the most common treatment
            let most_used_treatment = treatments
                .into_iter()
                .max_by_key(|&(_, count)| count)
                .map(|(treatment, _)| treatment)
                .unwrap_or_else(|| "Unknown".to_string());

            AverageRecord {
                hospital,
                diagnosis,
                average_recovery_time: total_time / count as f64,
                most_used_treatment,
            }
        })
        .collect();

    Ok(averages)
}

async fn get_object_from_bucket(
    file_name: &str,
    bucket_name: &str,
    s3_client: &s3::Client,
) -> Result<GetObjectOutput, Error> {
    let get_object_output = s3_client
        .get_object()
        .bucket(bucket_name)
        .key(file_name)
        .send()
        .await
        .map_err(|err| {
            tracing::error!({ %err }, "Error while reading file from s3 bucket");
            Error::from("Error while reading file from s3 bucket")
        })?;

    Ok(get_object_output)
}

async fn store_results_in_dynamodb(
    dynamo_client: &dynamodb::Client,
    table_name: &str,
    averages: Vec<AverageRecord>,
    request_id: &str,
) -> Result<(), Error> {
    // Batch write the results to DynamoDB
    for chunk in averages.chunks(25) {
        let mut write_requests = vec![];

        for average in chunk {
            let sort_key = format!(
                "#diagnosis#{}#hospital#{}",
                average.diagnosis, average.hospital
            );
            let put_request_item = PutRequest::builder()
                .item("PK", AttributeValue::S(request_id.to_owned()))
                .item("SK", AttributeValue::S(sort_key))
                .item("Hospital", AttributeValue::S(average.hospital.clone()))
                .item("Diagnosis", AttributeValue::S(average.diagnosis.clone()))
                .item(
                    "MostUsedTreatment",
                    AttributeValue::S(average.most_used_treatment.clone()),
                )
                .item(
                    "AverageRecoveryTime",
                    AttributeValue::N(average.average_recovery_time.to_string()),
                )
                .build()
                .map_err(|err| {
                    tracing::error!({ %err, %average.hospital, %average.diagnosis }, "Expected to build put_request_item");
                    Error::from(err)
                })?;
            write_requests.push(
                WriteRequest::builder()
                    .put_request(put_request_item)
                    .build(),
            );
        }

        dynamo_client
            .batch_write_item()
            .request_items(table_name, write_requests)
            .send()
            .await?;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing::subscriber::fmt()
        .json()
        .with_max_level(tracing::Level::INFO)
        // This neds to be set to remove duplicated information from logs
        .with_current_span(false)
        // Diables timestamp because CloudWatch adds ingestion time
        .without_time()
        // Removes the name of the function from every log entry
        .with_target(false)
        .init();

    // Initialize AWS Configs
    let region_provider = RegionProviderChain::default_provider();
    let sdk_config = aws_config::from_env().region(region_provider).load().await;

    // Initialize AWS SDK Clients
    let s3_client = s3::Client::new(&sdk_config);
    let s3_client_ref = &s3_client;
    let dynamodb_client = dynamodb::Client::new(&sdk_config);
    let dynamodb_client_ref = &dynamodb_client;

    let func = service_fn(move |event| async move {
        function_handler(event, s3_client_ref, dynamodb_client_ref).await
    });
    let handler = ServiceBuilder::new().service(func);

    run(handler).await?;

    Ok(())
}
