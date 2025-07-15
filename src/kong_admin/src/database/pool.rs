use deadpool_postgres::{Config, Pool, Runtime};
use deadpool::managed::QueueMode;
use openssl::ssl::{SslConnector, SslMethod};
use postgres_openssl::MakeTlsConnector;
use std::sync::Arc;
use tokio_postgres::NoTls;

use crate::settings::Settings;

pub type DbPool = Arc<Pool>;

pub async fn create_db_pool(settings: &Settings) -> Result<DbPool, Box<dyn std::error::Error>> {
    let db_host = &settings.database.host;
    let db_port = &settings.database.port;
    let db_user = &settings.database.user;
    let db_password = &settings.database.password;
    let db_name = &settings.database.db_name;

    // Create connection pool configuration
    let mut cfg = Config::new();
    cfg.host = Some(db_host.clone());
    cfg.port = Some(*db_port);
    cfg.user = Some(db_user.clone());
    cfg.password = Some(db_password.clone());
    cfg.dbname = Some(db_name.clone());

    // Configure pool settings for optimal batch processing performance
    cfg.pool = Some(deadpool_postgres::PoolConfig {
        max_size: 50,           // Increased from 32 to handle parallel processing (10 concurrent updates + overhead)
        timeouts: deadpool_postgres::Timeouts {
            wait: Some(std::time::Duration::from_secs(60)),    // Increased for long transactions
            create: Some(std::time::Duration::from_secs(30)),
            recycle: Some(std::time::Duration::from_secs(30)),
        },
        queue_mode: QueueMode::Fifo,
    });

    // Set up TLS if CA cert is configured
    let pool = if let Some(ca_cert) = &settings.database.ca_cert {
        let mut builder = SslConnector::builder(SslMethod::tls())
            .map_err(|e| format!("SSL error: {}", e))?;
        builder
            .set_ca_file(ca_cert)
            .map_err(|e| format!("CA file error: {}", e))?;
        let tls = MakeTlsConnector::new(builder.build());
        
        cfg.create_pool(Some(Runtime::Tokio1), tls)
            .map_err(|e| format!("Failed to create TLS connection pool: {}", e))?
    } else {
        cfg.create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| format!("Failed to create connection pool: {}", e))?
    };

    Ok(Arc::new(pool))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{DatabaseSettings, Settings};

    #[tokio::test]
    async fn test_pool_creation() {
        let settings = Settings {
            database: DatabaseSettings {
                host: "localhost".to_string(),
                port: 5432,
                user: "test".to_string(),
                password: "test".to_string(),
                db_name: "test".to_string(),
                ca_cert: None,
            },
            dfx_pem_file: None,
            db_updates_delay_secs: None,
        };

        // This test only verifies pool creation without connecting
        let result = create_db_pool(&settings).await;
        assert!(result.is_ok());
    }
}