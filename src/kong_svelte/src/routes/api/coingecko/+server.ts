import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Extract the API path from the query parameter
    const ids = url.searchParams.get('ids');
    const vs_currencies = url.searchParams.get('vs_currencies');
    
    if (!ids || !vs_currencies) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Make the request to CoinGecko API
    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${ids}&vs_currencies=${vs_currencies}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Return the data with proper CORS headers
    return json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });
  } catch (error) {
    console.error('CoinGecko proxy error:', error);
    return json(
      { error: 'Failed to fetch price data' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};