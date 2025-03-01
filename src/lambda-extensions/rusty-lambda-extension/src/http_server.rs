use crate::config;
use axum::{extract::Query, response::IntoResponse, routing::get, Router};
use lambda_extension::tracing;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tokio::task::JoinHandle;

/// Simple handler that returns a string
async fn hello_handler() -> impl IntoResponse {
    "Hello from the Lambda Extension Server!".into_response()
}

/// Query parameters for the greeting endpoint
#[derive(Debug, Deserialize, Serialize)]
struct GreetingParams {
    name: Option<String>,
}

/// Handler for the greeting endpoint
async fn greeting_handler(Query(params): Query<GreetingParams>) -> impl IntoResponse {
    let name = params.name.unwrap_or_else(|| "World".to_string());
    tracing::info!("Greeting request received for name: {}", name);
    format!("Hello, {}! Welcome to the Lambda Extension Server.", name)
}

/// Start the HTTP server on a background task
pub async fn start_server() -> JoinHandle<()> {
    // Build our application with routes
    let app = Router::new()
        .route("/", get(hello_handler))
        .route("/greeting", get(greeting_handler));

    // Get the configured port
    let port = config::get_server_port();

    // Run the server on localhost with the configured port
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("Starting HTTP server on {}", addr);

    // Run the server in the background
    tokio::spawn(async move {
        if let Err(e) = axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app).await {
            tracing::error!("Server error: {}", e);
        }
    })
}
