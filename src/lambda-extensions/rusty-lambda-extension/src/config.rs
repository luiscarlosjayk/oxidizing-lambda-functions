use lambda_extension::tracing;
use std::env;

/// Name of the environment variable that configures the HTTP server port
pub const PORT_ENV_VAR: &str = "RUSTY_EXTENSION_PORT";

/// Default port to use if the environment variable is not set
pub const DEFAULT_PORT: u16 = 8000;

/// Get the port from the environment variable or use the default
pub fn get_server_port() -> u16 {
    match env::var(PORT_ENV_VAR) {
        Ok(port_str) => port_str.parse::<u16>().unwrap_or_else(|_| {
            tracing::warn!(
                "Invalid {} value '{}', using default port {}",
                PORT_ENV_VAR,
                port_str,
                DEFAULT_PORT
            );
            DEFAULT_PORT
        }),
        Err(_) => {
            tracing::debug!(
                "{} not set, using default port {}",
                PORT_ENV_VAR,
                DEFAULT_PORT
            );
            DEFAULT_PORT
        }
    }
}
