/// Debugging utilities for market resolution tests
/// These help analyze and visualize test results in a more readable format.

use candid::{Nat, Principal};

/// Prints binary data in both hex and ASCII representation for debugging
/// This is particularly useful for analyzing complex candid-encoded responses
pub fn print_binary_data(data: &[u8], label: &str) {
    println!("  === {} BINARY DATA ===", label);
    
    const BYTES_PER_LINE: usize = 16;
    
    for (i, chunk) in data.chunks(BYTES_PER_LINE).enumerate() {
        // Print hex representation
        let hex_str: String = chunk.iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<String>>()
            .join(" ");
            
        // Pad hex representation to align ASCII view
        let padding = " ".repeat(3 * (BYTES_PER_LINE - chunk.len()));
        
        // Print ASCII representation (printable chars only)
        let ascii_str: String = chunk.iter()
            .map(|&b| if b >= 32 && b <= 126 { b as char } else { '.' })
            .collect();
            
        println!("  {:04x}: {} {}| {}", i * BYTES_PER_LINE, hex_str, padding, ascii_str);
    }
    
    println!("  === END {} BINARY DATA ===", label);
}

/// Analyzes market status from a response
pub fn analyze_market_status(response: &[u8]) {
    // Convert to string for simple analysis
    let str_response = format!("{:?}", response);
    
    // Print status indicators
    println!("  → MARKET STATUS INDICATORS:");
    println!("    - Active: {}", str_response.contains("Active"));
    println!("    - PendingActivation: {}", str_response.contains("PendingActivation"));
    println!("    - ExpiredUnresolved: {}", str_response.contains("ExpiredUnresolved"));
    println!("    - Closed: {}", str_response.contains("Closed"));
    println!("    - Disputed: {}", str_response.contains("Disputed"));
    println!("    - Voided: {}", str_response.contains("Voided"));
}

/// Analyzes payout records from a response
pub fn analyze_payout_records(response: &[u8]) {
    // Convert to string for simple analysis
    let str_response = format!("{:?}", response);
    
    // Print payout field indicators
    println!("  → PAYOUT RECORD FIELDS:");
    println!("    - user: {}", str_response.contains("user"));
    println!("    - amount: {}", str_response.contains("amount")); 
    println!("    - transaction_id: {}", str_response.contains("transaction_id"));
    println!("    - time_weight: {}", str_response.contains("time_weight"));
}

/// Analyzes user history from a response
pub fn analyze_user_history(response: &[u8]) {
    // Convert to string for simple analysis  
    let str_response = format!("{:?}", response);
    
    println!("  → USER HISTORY INDICATORS:");
    println!("    - Market activity: {}", str_response.contains("market_id"));
    println!("    - Bets: {}", str_response.contains("bet"));
    println!("    - Payouts: {}", str_response.contains("payout"));
    
    // Look for time-weighted indicators
    if str_response.contains("time_weight") {
        println!("    ✅ Time-weighted payout info found!");
    }
}
