use candid::CandidType;
use ic_cdk::api::set_certified_data;
use sha2::{Digest, Sha256};
use base64::engine::general_purpose::STANDARD as base64_engine;
use base64::Engine;
use ic_certified_map::{AsHashTree, Hash as CertHash, RbTree};
use serde::Serialize;
use ciborium;
use std::cell::RefCell;
use serde_bytes::ByteBuf;

thread_local! {
    // Store the certification tree
    static CERTIFICATION_TREE: RefCell<RbTree<String, CertHash>> = RefCell::new(RbTree::new());
    
    // Cache for dynamically generated content to avoid memory leaks
    static II_ORIGINS_CACHE: RefCell<Option<Vec<u8>>> = RefCell::new(None);
    static DEBUG_INFO_CACHE: RefCell<Option<Vec<u8>>> = RefCell::new(None);
    static DEBUG_HTML_CACHE: RefCell<Option<Vec<u8>>> = RefCell::new(None);
    
    // Track if certification needs to be updated
    static CERTIFICATION_NEEDS_UPDATE: RefCell<bool> = RefCell::new(true);
}

#[derive(CandidType, candid::Deserialize, Serialize)]
pub struct HeaderField(pub String, pub String);

#[derive(CandidType, candid::Deserialize, Serialize)]
pub struct HttpRequest {
    pub url: String,
    pub method: String,
    pub body: ByteBuf,
    pub headers: Vec<(String, String)>,
}

#[derive(CandidType, candid::Deserialize, Serialize)]
pub struct HttpResponse {
    pub body: ByteBuf,
    pub headers: Vec<(String, String)>,
    pub status_code: u16,
}

fn normalize_path(path: &str) -> String {
    if path == "/" {
        "/index.html".to_string()
    } else {
        path.to_string()
    }
}

fn witness(path: &str) -> String {
    CERTIFICATION_TREE.with(|tree| {
        let tree = tree.borrow();
        let witness = tree.witness(path.as_bytes());
        let tree = ic_certified_map::labeled(b"http_assets", witness);
        let mut data = Vec::new();
        ciborium::ser::into_writer(&tree, &mut data).unwrap();
        base64_engine.encode(data)
    })
}

// Generate the ii-alternative-origins file content dynamically with the current canister ID
fn generate_ii_alternative_origins() -> Vec<u8> {
    // Check if we have a cached version first
    let cached = II_ORIGINS_CACHE.with(|cache| cache.borrow().clone());
    
    if let Some(content) = cached {
        return content;
    }
    
    // If not cached, generate and cache it
    let canister_id = ic_cdk::id().to_text();
    let content = format!(
        r#"{{
  "alternativeOrigins": [
    "https://{0}.raw.icp0.io",
    "https://{0}.icp0.io",
    "http://localhost:4943"
  ]
}}"#,
        canister_id
    );
    let bytes = content.into_bytes();
    
    // Cache the result
    II_ORIGINS_CACHE.with(|cache| {
        *cache.borrow_mut() = Some(bytes.clone());
    });
    
    // Mark certification as needing update
    CERTIFICATION_NEEDS_UPDATE.with(|needs_update| {
        *needs_update.borrow_mut() = true;
    });
    
    bytes
}

// Mark certification as needing update (call this when canister ID changes or assets change)
pub fn mark_certification_needs_update() {
    CERTIFICATION_NEEDS_UPDATE.with(|needs_update| {
        *needs_update.borrow_mut() = true;
    });
    
    // Clear caches to force regeneration
    II_ORIGINS_CACHE.with(|cache| {
        *cache.borrow_mut() = None;
    });
    
    DEBUG_INFO_CACHE.with(|cache| {
        *cache.borrow_mut() = None;
    });
    
    DEBUG_HTML_CACHE.with(|cache| {
        *cache.borrow_mut() = None;
    });
}

pub fn init_asset_certification() {
    // Check if we need to update certification
    let needs_update = CERTIFICATION_NEEDS_UPDATE.with(|flag| *flag.borrow());
    
    if !needs_update {
        return; // Skip if no update needed
    }
    
    let mut tree = RbTree::new();
    
    // Generate the ii-alternative-origins content dynamically
    let ii_alternative_origins_content = generate_ii_alternative_origins();
    
    // Hash each static file with normalized paths
    let files = [
        ("/index.html", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.html")).to_vec()),
        ("/index.js", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.js")).to_vec()),
        ("/index.css", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.css")).to_vec()),
        ("/vite.svg", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/vite.svg")).to_vec()),
        ("/.well-known/ic-domains", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.well-known/ic-domains")).to_vec()),
        ("/.well-known/ii-alternative-origins", ii_alternative_origins_content),
        ("/.ic-assets.json5", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.ic-assets.json5")).to_vec()),
        ("/token_backend.did", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/token_backend.did")).to_vec()),
    ];

    for (path, content) in files.iter() {
        let hash = Sha256::digest(content);
        tree.insert(path.to_string(), hash.into());
    }

    // Set certified data with labeled hash
    let root_hash = tree.root_hash();
    let cert = ic_certified_map::labeled_hash(b"http_assets", &root_hash);
    set_certified_data(&cert);
    
    // Store tree
    CERTIFICATION_TREE.with(|t| {
        *t.borrow_mut() = tree;
    });
    
    // Mark certification as updated
    CERTIFICATION_NEEDS_UPDATE.with(|flag| {
        *flag.borrow_mut() = false;
    });
}

fn get_static_file(path: &str) -> Option<(Vec<u8>, &'static str)> {
    match path {
        "/index.html" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.html")).to_vec(), "text/html")),
        "/index.js" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.js")).to_vec(), "text/javascript")),
        "/index.css" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.css")).to_vec(), "text/css")),
        "/vite.svg" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/vite.svg")).to_vec(), "image/svg+xml")),
        "/.well-known/ic-domains" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.well-known/ic-domains")).to_vec(), "text/plain")),
        "/.well-known/ii-alternative-origins" => {
            // Get the cached or generate new content
            let content = generate_ii_alternative_origins();
            Some((content, "application/json"))
        },
        "/.ic-assets.json5" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.ic-assets.json5")).to_vec(), "application/json")),
        "/token_backend.did" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/token_backend.did")).to_vec(), "text/plain")),
        "/debug-canister-info" => {
            // Check if we have a cached version first
            let cached = DEBUG_INFO_CACHE.with(|cache| cache.borrow().clone());
            
            if let Some(content) = cached {
                return Some((content, "text/plain"));
            }
            
            // If not cached, generate and cache it
            let canister_id = ic_cdk::id().to_text();
            let debug_info = format!(
                "Current canister ID: {}\nExpected canister ID: {}",
                canister_id, canister_id
            );
            
            let bytes = debug_info.into_bytes();
            
            // Cache the result
            DEBUG_INFO_CACHE.with(|cache| {
                *cache.borrow_mut() = Some(bytes.clone());
            });
            
            Some((bytes, "text/plain"))
        },
        "/debug" => {
            // Check if we have a cached version first
            let cached = DEBUG_HTML_CACHE.with(|cache| cache.borrow().clone());
            
            if let Some(content) = cached {
                return Some((content, "text/html"));
            }
            
            // If not cached, generate and cache it
            let canister_id = ic_cdk::id().to_text();
            
            // Get certification status
            let certification_status = if let Some(_) = ic_cdk::api::data_certificate() {
                "Certification is available"
            } else {
                "Certification is NOT available"
            };
            
            // Get ii-alternative-origins content
            let ii_origins_bytes = generate_ii_alternative_origins();
            let ii_origins = String::from_utf8(ii_origins_bytes).unwrap_or_else(|_| "Error decoding UTF-8".to_string());
            
            let debug_html = format!(
                r#"<!DOCTYPE html>
                <html>
                <head>
                    <title>Debug Information</title>
                    <style>
                        body {{ font-family: Arial, sans-serif; margin: 20px; }}
                        h1 {{ color: #333; }}
                        .info {{ background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
                        .label {{ font-weight: bold; }}
                        pre {{ background: #eee; padding: 10px; border-radius: 5px; overflow-x: auto; }}
                    </style>
                </head>
                <body>
                    <h1>Canister Debug Information</h1>
                    
                    <div class="info">
                        <p><span class="label">Current Canister ID:</span> {}</p>
                        <p><span class="label">Expected Canister ID:</span> {}</p>
                        <p><span class="label">Certification Status:</span> {}</p>
                    </div>
                    
                    <h2>II Alternative Origins Content</h2>
                    <pre>{}</pre>
                    
                    <h2>Injected Variables</h2>
                    <p>The following variables are injected into HTML responses:</p>
                    <pre>
window.__CANISTER_ID__ = "{}";
window.canisterId = "{}";
window.canisterIdRoot = "{}";
                    </pre>
                    
                    <h2>Test Links</h2>
                    <ul>
                        <li><a href="/">Home Page</a></li>
                        <li><a href="/.well-known/ii-alternative-origins">View II Alternative Origins</a></li>
                    </ul>
                </body>
                </html>"#,
                canister_id,
                canister_id,
                certification_status,
                ii_origins,
                canister_id,
                canister_id,
                canister_id
            );
            
            let bytes = debug_html.into_bytes();
            
            // Cache the result
            DEBUG_HTML_CACHE.with(|cache| {
                *cache.borrow_mut() = Some(bytes.clone());
            });
            
            Some((bytes, "text/html"))
        },
        _ => None,
    }
}

#[ic_cdk::query]
pub fn http_request(req: HttpRequest) -> HttpResponse {
    let path = normalize_path(req.url.split('?').next().unwrap_or("/"));
    
    if let Some((content, content_type)) = get_static_file(&path) {
        let mut headers = vec![
            ("Content-Type".to_string(), content_type.to_string()),
            ("Cache-Control".to_string(), "max-age=604800".to_string()),
        ];

        // Add certification header
        if let Some(certificate) = ic_cdk::api::data_certificate() {
            headers.push((
                "IC-Certificate".to_string(),
                format!(
                    "certificate=:{}:, tree=:{}:",
                    base64_engine.encode(&certificate),
                    witness(&path)
                ),
            ));
        }

        // Get the current canister ID
        let canister_id = ic_cdk::id().to_text();
        
        // For HTML content, inject the canister ID
        let body = if content_type == "text/html" {
            let html = String::from_utf8_lossy(&content);
            let script_tag = format!(
                r#"<script>
                    window.__CANISTER_ID__ = "{}";
                    // Override any hardcoded canister IDs in the frontend
                    window.canisterId = "{}";
                    window.canisterIdRoot = "{}";
                </script>"#,
                canister_id, canister_id, canister_id
            );
            // Insert script tag before closing head tag
            let modified_html = html.replace("</head>", &format!("{}</head>", script_tag));
            ByteBuf::from(modified_html.into_bytes())
        } else {
            ByteBuf::from(content)
        };

        // Add CORS headers for the ii-alternative-origins file
        if path == "/.well-known/ii-alternative-origins" {
            headers.push(("Access-Control-Allow-Origin".to_string(), "*".to_string()));
            headers.push(("Access-Control-Allow-Methods".to_string(), "GET".to_string()));
            headers.push(("Access-Control-Allow-Headers".to_string(), "*".to_string()));
        }

        headers.push(("Content-Length".to_string(), body.len().to_string()));
        // Add X-Canister-ID header to all responses
        headers.push(("X-Canister-ID".to_string(), canister_id));

        HttpResponse {
            body,
            headers,
            status_code: 200,
        }
    } else {
        // Return 404 for files not found
        HttpResponse {
            body: ByteBuf::from("File not found".as_bytes().to_vec()),
            headers: vec![
                ("Content-Type".to_string(), "text/plain".to_string()),
                ("Content-Length".to_string(), "14".to_string()),
            ],
            status_code: 404,
        }
    }
}

// CORS preflight handler
#[ic_cdk::query]
pub fn http_request_streaming_callback(token: String) -> HttpResponse {
    HttpResponse {
        body: ByteBuf::new(),
        headers: vec![],
        status_code: 200,
    }
}
