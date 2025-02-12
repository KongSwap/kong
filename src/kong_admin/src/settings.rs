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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub db_updates_delay_secs: Option<u64>,
    pub database: Database,
}

pub fn read_settings() -> Result<Settings, Box<dyn std::error::Error>> {
    let file = File::open("./settings.json")?;
    let reader = std::io::BufReader::new(file);
    let settings: Settings = serde_json::from_reader(reader)?;
    Ok(settings)
}

#[allow(dead_code)]
pub fn write_settings(settings: &Settings) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::create("./settings.json")?;
    serde_json::to_writer_pretty(file, settings)?;
    Ok(())
}
