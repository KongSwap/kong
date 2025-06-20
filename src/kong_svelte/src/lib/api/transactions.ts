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

export interface CandleData {
  candle_start: number;
  open_price: string | number;
  high_price: string | number;
  low_price: string | number;
  close_price: string | number;
  volume: string | number;
}

export const fetchChartData = async (
  payTokenId: number,
  receiveTokenId: number,
  startTimestamp: number,
  endTimestamp: number,
  resolution: string
): Promise<CandleData[]> => {
  // Convert timestamps to ISO format
  const startTime = new Date(startTimestamp * 1000).toISOString();
  const endTime = new Date(endTimestamp * 1000).toISOString();
  
  const intervalMap: Record<string, string> = {
    '1m': '1',
    '5': '5',
    '15': '15',
    '30': '30',
    '60': '1h',
    '240': '4h',
    '1D': '1d',
    'D': '1d',
    '1W': '1w',
    'W': '1w'
  };
  const interval = intervalMap[resolution] || '1d';
  const url = `${API_URL}/api/swaps/ohlc?pay_token_id=${payTokenId}&receive_token_id=${receiveTokenId}&start_time=${startTime}&end_time=${endTime}&interval=${interval}`;
    
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("[API] Response status:", response.status);
    console.log("[API] Response data sample:", data?.slice(0, 2));
    
    if (!response.ok) {
      console.error('[API] Chart data error:', { status: response.status, data });
      return [];
    }
    
    // Parse and transform the data
    if (Array.isArray(data)) {
      const processedData = data.map(candle => {
        // Parse the ISO string to UTC timestamp in milliseconds
        const timestamp = Date.parse(candle.candle_start);
        
        return {
          candle_start: timestamp, // Store as milliseconds timestamp
          open_price: candle.open_price,
          high_price: candle.high_price,
          low_price: candle.low_price,
          close_price: candle.close_price,
          volume: candle.volume || 0
        };
      });
      
      return processedData
        .filter(candle => !isNaN(candle.candle_start)) // Remove any invalid timestamps
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return [];
  }
};