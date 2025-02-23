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
    static CERTIFICATION_TREE: RefCell<RbTree<String, CertHash>> = RefCell::new(RbTree::new());
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

pub fn init_asset_certification() {
    let mut tree = RbTree::new();
    
    // Hash each static file with normalized paths
    let files = [
        ("/index.html", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.html")).to_vec()),
        ("/index.js", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.js")).to_vec()),
        ("/index.css", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.css")).to_vec()),
        ("/vite.svg", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/vite.svg")).to_vec()),
        ("/.well-known/ic-domains", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.well-known/ic-domains")).to_vec()),
        ("/.well-known/ii-alternative-origins", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.well-known/ii-alternative-origins")).to_vec()),
        ("/.ic-assets.json5", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.ic-assets.json5")).to_vec()),
        ("/token_backend.did", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/token_backend.did")).to_vec()),
        ("/token_backend.did.js", include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/token_backend.did.js")).to_vec()),
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
}

fn get_static_file(path: &str) -> Option<(&'static [u8], &'static str)> {
    match path {
        "/index.html" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.html")), "text/html")),
        "/index.js" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.js")), "text/javascript")),
        "/index.css" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/index.css")), "text/css")),
        "/vite.svg" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/vite.svg")), "image/svg+xml")),
        "/.well-known/ic-domains" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.well-known/ic-domains")), "text/plain")),
        "/.well-known/ii-alternative-origins" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.well-known/ii-alternative-origins")), "application/json")),
        "/.ic-assets.json5" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/frontend-svelte/dist/.ic-assets.json5")), "application/json")),
        "/token_backend.did" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/token_backend.did")), "text/plain")),
        "/token_backend.did.js" => Some((include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/token_backend.did.js")), "text/javascript")),
        "/icrc-35" => Some((crate::standards::ICRC35_PAGE.as_bytes(), "text/html")),
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

        // For HTML content, inject the canister ID
        let body = if content_type == "text/html" {
            let html = String::from_utf8_lossy(content);
            let canister_id = ic_cdk::id().to_text();
            let script_tag = format!(
                r#"<script>window.__CANISTER_ID__ = "{}";</script>"#,
                canister_id
            );
            // Insert script tag before closing head tag
            let modified_html = html.replace("</head>", &format!("{}</head>", script_tag));
            ByteBuf::from(modified_html.into_bytes())
        } else {
            ByteBuf::from(content.to_vec())
        };

        headers.push(("Content-Length".to_string(), body.len().to_string()));

        HttpResponse {
            status_code: 200,
            headers,
            body,
        }
    } else {
        HttpResponse {
            status_code: 404,
            headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
            body: ByteBuf::from("Not Found"),
        }
    }
} 
