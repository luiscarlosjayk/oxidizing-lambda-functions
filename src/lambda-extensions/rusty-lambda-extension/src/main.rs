use lambda_extension::{service_fn, tracing, Error, Extension};

mod config;
mod events_extension;
mod http_server;

use events_extension::events_processor;

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

    // Start the HTTP server in the background
    let _server_handle = http_server::start_server().await;
    tracing::info!("HTTP server started successfully");

    // Initialize and run the Lambda extension
    Extension::new()
        .with_events_processor(service_fn(events_processor))
        .run()
        .await
}
