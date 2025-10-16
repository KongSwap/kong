use serde::{Deserialize, Serialize};
use std::fs::File;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Database {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub ca_cert: Option<String>,
    pub db_name: String,
    #[serde(default = "default_max_connections")]
    pub max_connections: usize,
    #[serde(default = "default_connection_timeout_secs")]
    pub connection_timeout_secs: u64,
}

fn default_max_connections() -> usize {
    16
}

fn default_connection_timeout_secs() -> u64 {
    5
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    #[serde(default)]
    pub dfx_pem_file: Option<String>,
    #[serde(default = "default_db_updates_delay")]
    pub db_updates_delay_secs: Option<u64>,
    pub database: Database,
}

fn default_db_updates_delay() -> Option<u64> {
    Some(60)
}

/// Load settings from environment variables with KONG_ prefix
pub fn read_settings_from_env() -> Result<Settings, Box<dyn std::error::Error>> {
    use std::env;

    dotenvy::dotenv().ok(); // Load .env file if present, ignore if missing

    // Helper function to get required env var
    let get_env = |key: &str| -> Result<String, Box<dyn std::error::Error>> {
        env::var(key).map_err(|_| format!("Missing required environment variable: {}", key).into())
    };

    // Helper function to get optional env var
    let get_env_opt = |key: &str| -> Option<String> {
        env::var(key).ok()
    };

    // Helper function to parse env var with default
    let get_env_parsed = |key: &str, default: u64| -> u64 {
        env::var(key)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(default)
    };

    let get_env_parsed_usize = |key: &str, default: usize| -> usize {
        env::var(key)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(default)
    };

    // Parse database configuration
    let database = Database {
        host: get_env("KONG_DATABASE_HOST")?,
        port: get_env("KONG_DATABASE_PORT")?
            .parse()
            .map_err(|_| "Invalid KONG_DATABASE_PORT")?,
        user: get_env("KONG_DATABASE_USER")?,
        password: get_env("KONG_DATABASE_PASSWORD")?,
        ca_cert: get_env_opt("KONG_DATABASE_CA_CERT"),
        db_name: get_env("KONG_DATABASE_DB_NAME")?,
        max_connections: get_env_parsed_usize("KONG_DATABASE_MAX_CONNECTIONS", 16),
        connection_timeout_secs: get_env_parsed("KONG_DATABASE_CONNECTION_TIMEOUT_SECS", 5),
    };

    // Parse top-level settings
    let settings = Settings {
        dfx_pem_file: get_env_opt("KONG_DFX_PEM_FILE"),
        db_updates_delay_secs: get_env_opt("KONG_DB_UPDATES_DELAY_SECS")
            .and_then(|v| v.parse().ok())
            .or(Some(60)),
        database,
    };

    Ok(settings)
}

/// Load settings from JSON file (legacy support)
pub fn read_settings_from_file() -> Result<Settings, Box<dyn std::error::Error>> {
    let file = File::open("./settings.json")?;
    let reader = std::io::BufReader::new(file);
    let settings: Settings = serde_json::from_reader(reader)?;
    Ok(settings)
}

/// Load settings with fallback: env vars → JSON file
pub fn read_settings() -> Result<Settings, Box<dyn std::error::Error>> {
    // Try environment variables first
    match read_settings_from_env() {
        Ok(settings) => {
            tracing::info!("✓ Settings loaded from environment variables");
            Ok(settings)
        }
        Err(env_err) => {
            tracing::warn!("Environment variables incomplete: {}", env_err);
            tracing::info!("Falling back to settings.json");

            // Fallback to JSON file
            read_settings_from_file()
                .map_err(|file_err| {
                    format!(
                        "Failed to load settings from both sources:\n  - Env: {}\n  - File: {}",
                        env_err, file_err
                    ).into()
                })
        }
    }
}

#[allow(dead_code)]
pub fn write_settings(settings: &Settings) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::create("./settings.json")?;
    serde_json::to_writer_pretty(file, settings)?;
    Ok(())
}
