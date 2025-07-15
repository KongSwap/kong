use anyhow::{Context, Result};
use tokio_postgres::Client;

use super::pool::DbPool;

/// Read the last processed database update ID from the application_state table
pub async fn read_last_db_update_id(db_pool: &DbPool) -> Result<Option<u64>> {
    let client = db_pool.get().await.context("Failed to get database connection")?;
    // First, ensure the application_state table exists
    client.execute(
        "CREATE TABLE IF NOT EXISTS application_state (
            key VARCHAR(50) PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        &[]
    ).await.context("Failed to create application_state table")?;

    // Try to read the last_db_update_id
    let row = client
        .query_opt(
            "SELECT value FROM application_state WHERE key = 'last_db_update_id'",
            &[],
        )
        .await
        .context("Failed to query last_db_update_id")?;

    match row {
        Some(row) => {
            let value: String = row.get(0);
            let id = value.parse::<u64>()
                .context("Failed to parse last_db_update_id as u64")?;
            Ok(Some(id))
        }
        None => {
            // Initialize the value if it doesn't exist
            client.execute(
                "INSERT INTO application_state (key, value) VALUES ('last_db_update_id', '0') ON CONFLICT (key) DO NOTHING",
                &[]
            ).await.context("Failed to initialize last_db_update_id")?;
            Ok(None)
        }
    }
}

/// Update the last processed database update ID in the application_state table
pub async fn update_last_db_update_id(db_pool: &DbPool, db_update_id: u64) -> Result<()> {
    let client = db_pool.get().await.context("Failed to get database connection")?;
    let rows_updated = client
        .execute(
            "INSERT INTO application_state (key, value, updated_at) 
             VALUES ('last_db_update_id', $1, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE 
             SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
            &[&db_update_id.to_string()],
        )
        .await
        .context("Failed to update last_db_update_id")?;

    if rows_updated == 0 {
        anyhow::bail!("No rows were updated when setting last_db_update_id");
    }

    Ok(())
}

/// Read a generic value from the application_state table
#[allow(dead_code)]
pub async fn read_state(client: &Client, key: &str) -> Result<Option<String>> {
    let row = client
        .query_opt(
            "SELECT value FROM application_state WHERE key = $1",
            &[&key],
        )
        .await
        .context(format!("Failed to query state for key: {}", key))?;

    Ok(row.map(|r| r.get(0)))
}

/// Update a generic value in the application_state table
#[allow(dead_code)]
pub async fn update_state(client: &Client, key: &str, value: &str) -> Result<()> {
    client
        .execute(
            "INSERT INTO application_state (key, value, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE 
             SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
            &[&key, &value],
        )
        .await
        .context(format!("Failed to update state for key: {}", key))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_parse_db_update_id() {
        // Test parsing valid numbers
        assert_eq!("0".parse::<u64>().ok(), Some(0));
        assert_eq!("123456789".parse::<u64>().ok(), Some(123456789));
        
        // Test parsing invalid strings
        assert!("not_a_number".parse::<u64>().is_err());
        assert!("".parse::<u64>().is_err());
    }
}