use crate::config;
use lambda_extension::{tracing, Error, LambdaEvent, NextEvent};

/// Process events from the Lambda extension API.
///
/// This function is called when the Lambda extension receives an event from the Lambda API.
pub(crate) async fn events_processor(event: LambdaEvent) -> Result<(), Error> {
    match event.next {
        NextEvent::Shutdown(event) => {
            tracing::info!(event_type = "shutdown", ?event, "shutting down function");
        }
        NextEvent::Invoke(event) => {
            tracing::info!(event_type = "invoke", ?event, "invoking function");
            let port = config::get_server_port();
            tracing::info!("HTTP server is available at http://localhost:{}/", port);
            tracing::info!(
                "Try the greeting endpoint at http://localhost:{}/greeting?name=YourName",
                port
            );
        }
    }
    Ok(())
}
