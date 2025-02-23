use std::fs;
use std::path::Path;

fn main() {
    // Create frontend directory if it doesn't exist
    let frontend_dir = Path::new("frontend");
    if !frontend_dir.exists() {
        fs::create_dir_all(frontend_dir).expect("Failed to create frontend directory");
    }

    // Create .well-known directory if it doesn't exist
    let well_known_dir = frontend_dir.join(".well-known");
    if !well_known_dir.exists() {
        fs::create_dir_all(&well_known_dir).expect("Failed to create .well-known directory");
    }

    // Tell Cargo to rerun this build script if any of these files change
    println!("cargo:rerun-if-changed=frontend");
    println!("cargo:rerun-if-changed=frontend/.well-known");
    println!("cargo:rerun-if-changed=src/lib.rs");
    println!("cargo:rerun-if-changed=token_backend.did");
    println!("cargo:rerun-if-changed=token_backend.did.js");

    // Copy token_backend.did.js to frontend directory
    let source_path = Path::new("token_backend.did.js");
    let dest_path = Path::new("frontend/token_backend.did.js");
    
    if source_path.exists() {
        println!("Copying token_backend.did.js to frontend directory");
        fs::copy(source_path, dest_path).expect("Failed to copy token_backend.did.js to frontend directory");
    } else {
        println!("Warning: token_backend.did.js not found");
    }

    println!("cargo:rerun-if-changed=src/token_backend.did");
    
    // Read the candid file from multiple possible locations
    let did_content = fs::read_to_string("token_backend.did")
        .or_else(|_| fs::read_to_string("src/token_backend.did"))
        .or_else(|_| fs::read_to_string("src/token_backend/src/token_backend.did"))
        .expect("Failed to read token_backend.did from any location");
    
    // Extract query methods (simple parsing, can be made more robust)
    let mut query_methods = Vec::new();
    for line in did_content.lines() {
        if line.trim().ends_with("query;") || line.trim().ends_with("query,") {
            if let Some(method_name) = line
                .split(":")
                .next()
                .map(|s| s.trim())
            {
                query_methods.push(method_name.to_string());
            }
        }
    }
    
    // Generate Rust code
    let output = format!(
        "pub const QUERY_METHODS: &[&str] = &[{}];",
        query_methods
            .iter()
            .map(|m| format!("\"{}\"", m))
            .collect::<Vec<_>>()
            .join(", ")
    );
    
    // Write to generated file
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let out_path = Path::new(&out_dir).join("query_methods.rs");
    fs::write(&out_path, output)
        .expect("Failed to write query_methods.rs");
    
    println!("cargo:warning=Generated query methods: {:?}", query_methods);
} 
