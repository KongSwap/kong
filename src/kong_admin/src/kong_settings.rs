use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use super::kong_update::KongUpdate;

pub async fn update_kong_settings_on_kong_data<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new("./backups/kong_settings.json");
    let file = File::open(path)?;
    println!("processing: {:?}", path.file_name().unwrap());
    let mut reader = BufReader::new(file);
    let mut contents = String::new();
    reader.read_to_string(&mut contents)?;
    kong_update.update_kong_settings(&contents).await?;

    Ok(())
}
