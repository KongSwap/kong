import { API_URL } from "$lib/api/index";

export async function fetchTransactions(
  canisterId: string | number, 
  page: number, 
  limit: number,
  options: { signal?: AbortSignal } = {}
): Promise<FE.Transaction[]> {
  // Handle both string and number IDs
  const idParam = typeof canisterId === 'string' ? canisterId : canisterId.toString();
  const url = `${API_URL}/api/tokens/${idParam}/transactions?page=${page}&limit=${limit}`;
  
  try {
    const response = await fetch(url, {
      signal: options.signal
    });
    
    // Get the response text first
    const responseText = await response.text();
    
    // Check for specific error messages
    if (responseText.includes("Token not")) {
      console.error('Token not found:', idParam);
      return []; // Return empty array instead of throwing
    }
    
    // If not OK and not a token error, throw with status
    if (!response.ok) {
      console.error('Transaction fetch error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      return []; // Return empty array for any error
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Invalid JSON response:', responseText);
      return []; // Return empty array for parse errors
    }
    
    // Validate and transform the response data
    if (!data || !Array.isArray(data.items)) {
      console.error('Invalid response structure:', data);
      return [];
    }

    // Filter out any transactions without required fields
    const transactions = data.items
      .filter(tx => tx.tx_id && (tx.ts || tx.timestamp))  // Check for either timestamp field
      .map(tx => ({
        ...tx,
        tx_id: tx.tx_id,
        timestamp: tx.ts || tx.timestamp // Use ts if available, fallback to timestamp
      }));

    return transactions;
  } catch (error) {
    // If the request was aborted, rethrow the error
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Transaction fetch error:', error);
    return []; // Return empty array for any other errors
  }
} 