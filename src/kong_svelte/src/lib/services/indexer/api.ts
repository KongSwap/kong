import { API_URL } from "$lib/api/index";

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
    
    if (!response.ok) {
      console.error('API error:', data);
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