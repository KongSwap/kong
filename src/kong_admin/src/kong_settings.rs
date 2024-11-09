use super::kong_data::KongData;
use std::fs::File;
use std::io::{BufReader, Read};

pub async fn archive_kong_settings(kong_data: &KongData) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/kong_settings.json")?;
    let mut reader = BufReader::new(file);
    let mut contents = String::new();
    reader.read_to_string(&mut contents)?;
    kong_data.archive_kong_settings(&contents).await?;

    Ok(())
}
