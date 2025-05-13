//! This is a standalone script for debugging market resolution
//! It bypasses the main test framework and can be run independently

use candid::{Nat, Principal, encode_args, decode_one};
use pocket_ic::{PocketIc, PocketIcBuilder};
use std::time::Duration;

// Import our debugging utilities directly to avoid module dependencies
mod resolution_debug_utils {
    use std::fmt;
    
    /// Print binary data in both hex and ASCII format for debugging
    pub fn print_binary_data(data: &[u8], label: &str) {
        println!("  === {} BINARY DATA ({} bytes) ===", label, data.len());
        
        // Limit output to first 200 bytes to avoid excessive output
        let display_bytes = std::cmp::min(data.len(), 200);
        
        // Print in groups of 16 bytes per line
        for i in (0..display_bytes).step_by(16) {
            // Print hex values
            let hex_line: String = data[i..std::cmp::min(i+16, display_bytes)]
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<Vec<String>>()
                .join(" ");
                
            // Create formatted hex output with padding
            let padded_hex = format!("{:<48}", hex_line);
            
            // Print ASCII representation (printable chars only)
            let ascii_line: String = data[i..std::cmp::min(i+16, display_bytes)]
                .iter()
                .map(|&b| if b >= 32 && b < 127 { b as char } else { '.' })
                .collect();
                
            println!("  {:04x}: {} | {}", i, padded_hex, ascii_line);
        }
        
        // If data is longer than what we displayed, note that
        if data.len() > display_bytes {
            println!("  ... ({} more bytes not shown)", data.len() - display_bytes);
        }
        println!();
    }

    /// Analyzes a market status response and extracts key information
    pub fn analyze_market_status(market_bytes: &[u8]) {
        println!("  ✅ Successfully queried market");
        println!("  → Market data: {} bytes", market_bytes.len());
        
        // Display raw bytes for inspection
        print_binary_data(market_bytes, "Market Status Response");
        
        // Convert to string representation to check for status patterns
        let market_str = format!("{:?}", market_bytes);
        
        // Check for specific status indicators
        println!("  → STATUS INDICATORS:");
        println!("    - Contains 'Closed': {}", market_str.contains("Closed"));
        println!("    - Contains 'Active': {}", market_str.contains("Active"));
        println!("    - Contains 'Pending': {}", market_str.contains("Pending"));
        println!("    - Contains 'Voided': {}", market_str.contains("Voided"));
        println!("    - Contains 'resolved_by': {}", market_str.contains("resolved_by"));
        
        // Try to determine market status
        if market_str.contains("Closed") {
            println!("  ✅ Market is CONFIRMED to be in Closed status!");
            
            // Attempt to see if outcome 0 is the winner
            if market_str.contains("Closed([0]") || 
               market_str.contains("Closed: [0]") || 
               market_str.contains("Closed\\\\[0\\\\]") ||
               market_str.contains("0vClosed") {
                println!("  ✅ CONFIRMED outcome 0 (Yes) is the winner");
            } else {
                println!("  ℹ️ Could not confirm if outcome 0 is winner, but market is Closed");
                
                // Try to find any outcome indices
                if let Some(idx) = market_str.find("Closed") {
                    println!("  ⚠️ Context around 'Closed': '{}'", 
                        &market_str[idx.saturating_sub(10)..std::cmp::min(market_str.len(), idx+20)]);
                }
            }
        } else if market_str.contains("Active") {
            println!("  ⚠️ Market appears to still be in Active status!");
        } else if market_str.contains("Pending") {
            println!("  ⚠️ Market appears to be in Pending status!");
        } else if market_str.contains("Voided") {
            println!("  ⚠️ Market appears to be in Voided status!");
        } else {
            println!("  ℹ️ Could not determine market status from response");
        }
        
        // Check if the market has a resolver field
        if market_str.contains("resolved_by") {
            println!("  ✅ Market has a resolver field (as expected after resolution)");
        }
    }

    /// Analyzes payout records from a binary response
    pub fn analyze_payout_records(raw_records: &[u8]) {
        println!("  ✅ Successfully retrieved payout records");
        println!("  → Payout records data: {} bytes", raw_records.len());
        
        if raw_records.is_empty() {
            println!("  ⚠️ EMPTY RECORDS: No payout records retrieved (empty array)");
            return;
        }
        
        // Enhanced debugging: Display raw binary data with both hex and ASCII representation
        print_binary_data(raw_records, "Payout Records");
        
        // Convert to string for pattern analysis
        let raw_str = format!("{:?}", raw_records);
        
        // Check for key payout indicators
        println!("  → PAYOUT RECORD FIELDS PRESENT:");
        println!("    - transaction_id: {}", raw_str.contains("transaction_id"));
        println!("    - payout_amount: {}", raw_str.contains("payout_amount"));
        println!("    - time_weight: {}", raw_str.contains("time_weight"));
        println!("    - user: {}", raw_str.contains("user"));
        println!("    - bet_amount: {}", raw_str.contains("bet_amount"));
        
        // Detailed transaction ID analysis
        if raw_str.contains("transaction_id") {
            // Try to find all instances of transaction_id and extract values
            println!("\n  → TRANSACTION ID ANALYSIS:");
            
            // Count different transaction statuses
            let some_txs = raw_str.matches("Some(").count();
            let null_txs = raw_str.matches("None").count();
            let txid_count = raw_str.matches("transaction_id").count();
            
            println!("    Total transaction_id fields: {}", txid_count);
            println!("    'Some(...)' values (completed): {}", some_txs);
            println!("    'None' values (pending/failed): {}", null_txs);
            
            if some_txs > 0 {
                println!("  ✅ COMPLETED TRANSACTIONS: Found {} transaction IDs with values", some_txs);
            } else {
                println!("  ⚠️ NO COMPLETED TRANSACTIONS: All transaction IDs are null/None");
                println!("    This suggests payouts were calculated but transfers not completed");
            }
            
            // Try to extract actual transaction IDs where present
            if some_txs > 0 && raw_str.contains("transaction_id") && raw_str.contains("Some(") {
                println!("  → SEARCHING FOR TRANSACTION VALUES...");
                // This is a simple heuristic attempt to find transaction values
                if let Some(idx) = raw_str.find("transaction_id") {
                    let ctx_start = idx.saturating_sub(10);
                    let ctx_end = std::cmp::min(raw_str.len(), idx + 100);
                    let context = &raw_str[ctx_start..ctx_end];
                    
                    println!("    Context around first transaction_id: '{}'", context);
                    
                    // Try to find a pattern like "Some(12345)"
                    if let Some(some_idx) = context.find("Some(") {
                        let value_start = some_idx + 5; // Skip "Some("
                        if let Some(value_end) = context[value_start..].find(')') {
                            let tx_value = &context[value_start..value_start+value_end];
                            println!("    First transaction value appears to be: {}", tx_value);
                        }
                    }
                }
            }
        } else {
            println!("  ⚠️ NO TRANSACTION_ID FIELDS: The response doesn't contain transaction_id fields");
            println!("    This may indicate a different response structure than expected");
        }
        
        // Try to count the number of records
        let record_markers = raw_str.matches("transaction_id").count();
        println!("\n  → ESTIMATED NUMBER OF RECORDS: ~{} records", record_markers);
        
        // Check for payout amounts to extract values
        if raw_str.contains("payout_amount") {
            println!("\n  → PAYOUT AMOUNT SEARCH:");
            
            // Try to extract some payout amount values
            if let Some(idx) = raw_str.find("payout_amount") {
                let ctx_start = idx.saturating_sub(5);
                let ctx_end = std::cmp::min(raw_str.len(), idx + 50);
                let context = &raw_str[ctx_start..ctx_end];
                
                println!("    Context around first payout_amount: '{}'", context);
            }
        }
    }

    /// Analyzes user history from a binary response
    pub fn analyze_user_history(history_bytes: &[u8], name: &str, market_id: &str) {
        println!("  ✅ Successfully retrieved user history for {}", name);
        println!("  → User history data: {} bytes", history_bytes.len());
        
        // Print the binary data in a readable format
        print_binary_data(history_bytes, &format!("{}'s User History", name));
        
        // Convert to string for pattern analysis
        let history_str = format!("{:?}", history_bytes);
        
        // Check for key user history indicators
        println!("  → USER HISTORY INDICATORS:");
        println!("    - Contains market_id: {}", history_str.contains("market_id"));
        println!("    - Contains total_payouts: {}", history_str.contains("total_payouts"));
        println!("    - Contains payout_count: {}", history_str.contains("payout_count"));
        
        // Check if user received payouts
        if history_str.contains("total_payouts") {
            // Try to extract total payout information
            if let Some(idx) = history_str.find("total_payouts") {
                let ctx_start = idx.saturating_sub(5);
                let ctx_end = std::cmp::min(history_str.len(), idx + 50);
                let context = &history_str[ctx_start..ctx_end];
                
                println!("    Context around total_payouts: '{}'", context);
                
                // Try to infer if user got paid
                if context.contains("0") && !context.contains("1") && !context.contains("2") {
                    println!("  ⚠️ Possible ZERO payout detected for {}", name);
                } else {
                    println!("  ✅ Likely NON-ZERO payout detected for {}", name);
                }
            }
        }
        
        // Check for specific market participation
        if history_str.contains(market_id) {
            println!("  ✅ User history contains reference to market ID {}", market_id);
        } else {
            println!("  ⚠️ User history does NOT contain reference to market ID {}", market_id);
        }
    }
}

// Main function
fn main() {
    println!("\n======= MARKET RESOLUTION DEBUGGING DEMO =======\n");
    println!("This standalone script demonstrates the market resolution debugging utilities.");
    println!("Use these utilities to debug and verify payouts for prediction markets.");
    
    println!("\n=== DEBUGGING UTILITY REFERENCE ===\n");
    println!("1. print_binary_data(data, label)");
    println!("   - Prints both hex and ASCII representation of binary data");
    println!("   - Helps visualize raw binary responses from canisters");
    println!("\n2. analyze_market_status(market_bytes)");
    println!("   - Analyzes binary response from get_market");
    println!("   - Checks for status indicators (Closed, Active, Voided)");
    println!("   - Helps determine if a market is properly resolved");
    println!("\n3. analyze_payout_records(raw_records)");
    println!("   - Analyzes binary response from get_market_payout_records");
    println!("   - Checks for transaction IDs, payout amounts, time weights");
    println!("   - Helps verify if payouts were calculated and processed");
    println!("\n4. analyze_user_history(history_bytes, name, market_id)");
    println!("   - Analyzes binary response from get_user_history");
    println!("   - Checks if a user received payouts for a specific market");
    println!("   - Helps verify if user history accurately reflects participation");
    
    println!("\n=== INTEGRATION EXAMPLE ===\n");
    println!("// After querying a market with get_market:");
    println!("match market_result {");
    println!("    Ok(market_bytes) => {");
    println!("        analyze_market_status(&market_bytes);");
    println!("    },");
    println!("    Err(err) => println!(\"Error: {}\", err);");
    println!("}");
    
    println!("\n// After querying payout records with get_market_payout_records:");
    println!("match payout_records_result {");
    println!("    Ok(raw_records) => {");
    println!("        analyze_payout_records(&raw_records);");
    println!("    },");
    println!("    Err(err) => println!(\"Error: {}\", err);");
    println!("}");
    
    println!("\n// After querying user history with get_user_history:");
    println!("match user_history_result {");
    println!("    Ok(history_bytes) => {");
    println!("        analyze_user_history(&history_bytes, \"User\", &market_id.to_string());");
    println!("    },");
    println!("    Err(err) => println!(\"Error: {}\", err);");
    println!("}");
    
    println!("\n=== TROUBLESHOOTING TIPS ===\n");
    println!("1. Market not resolved? Check for 'Closed' status in analyze_market_status");
    println!("2. Missing payouts? Check transaction_id fields in analyze_payout_records");
    println!("3. Verify that transaction IDs show as 'Some(value)' not 'None'");
    println!("4. For time-weighted payouts, ensure time_weight field is present");
    println!("5. User history should show market participation and non-zero total_payouts");
    
    println!("\n======= END OF MARKET RESOLUTION DEBUGGING DEMO =======\n");
}
