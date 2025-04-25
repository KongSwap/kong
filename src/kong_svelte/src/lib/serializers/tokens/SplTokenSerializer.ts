// SplTokenSerializer.ts
// Serializer for SPL token data

import { BaseSerializer } from '../BaseSerializer';
// Import necessary types, potentially FE types or define local ones if needed

// Define the input type for raw SPL token data
// This might come from a wallet provider or API
type RawSplTokenData = {
  amount: string;      // Raw amount (smallest unit)
  decimals: number;
  logo?: string;
  mint: string;        // Mint address
  name: string;
  symbol: string;
  usdValue?: number;    // Optional: USD value of the balance
  uiAmount?: number;   // Optional: User-friendly amount
  // Other potential fields from provider:
  // price?: number;
  // change24h?: number;
};

// Define the output format using Kong.Token
// We no longer need SerializedSplToken

export class SplTokenSerializer extends BaseSerializer {

  /**
   * Serializes a single raw SPL token data object into Kong.Token.
   * @param rawData - The raw SPL token data.
   * @returns Formatted Kong.Token or null if invalid.
   */
  static serializeSplToken(rawData: unknown): Kong.Token | null {
    try {
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid raw SPL token data format');
      }

      const data = rawData as RawSplTokenData;

      // Basic validation
      if (!data.mint || typeof data.mint !== 'string' || typeof data.decimals !== 'number') {
         console.error('Invalid essential SPL token data fields:', data);
         return null;
      }

      // Calculate price from usdValue and uiAmount if available
      const price = (data.uiAmount && data.usdValue && data.uiAmount > 0) ? (data.usdValue / data.uiAmount).toString() : '0';
      // Generate a simple ID (consider a more robust method like hashing the mint address)
      const tokenId = Math.abs(this.hashCode(data.mint)) % 1000000; // Simple hash -> ID

      // Ensure metrics object conforms to FE.TokenMetrics
      const metrics: FE.TokenMetrics = {
          price: this.toString(price),
          total_supply: '0', // Often needs a separate API call for SPL tokens
          volume_24h: '0',   // Placeholder
          market_cap: '0',   // Placeholder
          tvl: '0',          // Placeholder
          price_change_24h: '0', // Placeholder - would need price history
          updated_at: new Date().toISOString(),
      };

      return {
        id: tokenId,
        name: this.toString(data.name),
        symbol: this.toString(data.symbol),
        address: this.toString(data.mint), // Use mint address as address
        fee: 0,                           // SPL fees are paid in SOL, set token fee to 0
        fee_fixed: '0',
        decimals: this.toNumber(data.decimals),
        token_type: 'SPL',                // Explicitly set type
        chain: 'Solana',              // Explicitly set chain
        standards: [],                    // SPL doesn't have direct ICRC equivalents
        logo_url: this.toString(data.logo || ''),
        metrics: metrics,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error serializing SPL token:', error);
      return null;
    }
  }

  /**
   * Serializes a list of raw SPL token data objects into Kong.Token.
   * @param tokens - Array of raw SPL token data.
   * @returns Array of formatted Kong.Tokens.
   */
  static serializeSplTokens(tokens: unknown[]): Kong.Token[] {
    if (!Array.isArray(tokens)) {
      return [];
    }

    return tokens
      .map(token => this.serializeSplToken(token))
      .filter((token): token is Kong.Token => token !== null);
  }

  /**
   * Simple string hash function (djb2)
   * Used for generating a somewhat unique ID from the mint address.
   * Consider replacing with a more robust method if collisions are a concern.
   */
  private static hashCode(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash;
  }
}
