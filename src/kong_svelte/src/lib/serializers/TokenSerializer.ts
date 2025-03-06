// TokenSerializer.ts
// Serializer for token data

import { BaseSerializer } from './BaseSerializer';

export class TokenSerializer extends BaseSerializer {
  /**
   * Serializes a token metadata response
   * @param response - The raw token metadata response
   * @returns Formatted token metadata
   */
  static serializeTokenMetadata(response: unknown): FE.Token | null {
    try {
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid token metadata format');
      }
      
      const data = response as Record<string, unknown>;
      
      // Ensure token_id is a number
      let tokenId: number;
      if (typeof data.token_id === 'number') {
        tokenId = data.token_id;
      } else if (typeof data.token_id === 'string' && !isNaN(Number(data.token_id))) {
        tokenId = Number(data.token_id);
      } else {
        // Generate a default token ID if none exists
        tokenId = Date.now() % 10000 + 1000; // Simple way to generate a unique ID
      }
      
      // We need to ensure token_id is a number as required by the FE.Token interface
      return {
        canister_id: this.toString(data.canister_id),
        name: this.toString(data.name),
        symbol: this.toString(data.symbol),
        decimals: this.toNumber(data.decimals),
        address: this.toString(data.address || data.canister_id),
        fee: this.toNumber(data.fee),
        fee_fixed: this.toString(data.fee_fixed || data.fee),
        token: this.toString(data.token || data.canister_id),
        icrc1: this.toBoolean(data.icrc1),
        icrc2: this.toBoolean(data.icrc2),
        icrc3: this.toBoolean(data.icrc3),
        pool_symbol: this.toString(data.pool_symbol),
        pools: Array.isArray(data.pools) ? data.pools : [],
        timestamp: Date.now(),
        metrics: this.serializeTokenMetrics(data.metrics),
        balance: this.toString(data.balance || '0'),
        logo_url: this.toString(data.logo_url),
        token_type: this.toString(data.token_type || 'IC'),
        token_id: tokenId,
        chain: this.toString(data.chain || 'IC'),
        total_24h_volume: this.toString(data.total_24h_volume || '0')
      };
    } catch (error) {
      console.error('Error serializing token metadata:', error);
      return null;
    }
  }

  /**
   * Serializes token metrics data
   * @param metrics - The raw metrics data
   * @returns Formatted token metrics
   */
  private static serializeTokenMetrics(metrics: unknown): FE.TokenMetrics {
    if (!metrics || typeof metrics !== 'object') {
      return {
        price: '0',
        volume_24h: '0',
        total_supply: '0',
        market_cap: '0',
        tvl: '0',
        updated_at: new Date().toISOString(),
        price_change_24h: '0',
        previous_price: '0'
      };
    }
    
    const data = metrics as Record<string, unknown>;
    
    return {
      price: this.toString(data.price || '0'),
      volume_24h: this.toString(data.volume_24h || '0'),
      total_supply: this.toString(data.total_supply || '0'),
      market_cap: this.toString(data.market_cap || '0'),
      tvl: this.toString(data.tvl || '0'),
      updated_at: this.toString(data.updated_at || new Date().toISOString()),
      price_change_24h: this.toString(data.price_change_24h || '0'),
      previous_price: this.toString(data.previous_price || data.price || '0')
    };
  }

  /**
   * Serializes a list of tokens
   * @param tokens - Array of raw token data
   * @returns Array of formatted tokens
   */
  static serializeTokens(tokens: unknown[]): FE.Token[] {
    if (!Array.isArray(tokens)) {
      return [];
    }
    
    return tokens
      .map(token => this.serializeTokenMetadata(token))
      .filter((token): token is FE.Token => token !== null);
  }

  /**
   * Extracts logo URL from ICRC1 metadata
   * @param metadata - The ICRC1 metadata array
   * @returns Logo URL string or empty string if not found
   */
  static extractLogoFromMetadata(metadata: Array<[string, any]>): string {
    for (const [key, value] of metadata) {
      if (key === 'icrc1:logo' || key === 'icrc1_logo' || key === 'icrc1:icrc1_logo') {
        // The value is an object that contains the logo data
        if (typeof value === 'object' && value !== null) {
          // Access the Text value inside the object
          const logoValue = Object.values(value)[0];
          return typeof logoValue === 'string' ? logoValue : '';
        }
      }
    }
    return '';
  }

  /**
   * Serializes token balance data
   * @param balance - The raw balance data
   * @param price - The token price
   * @returns Formatted token balance
   */
  static serializeTokenBalance(balance: unknown, price: string | number): FE.TokenBalance {
    const tokenBalance = this.toBigInt(balance);
    const tokenPrice = this.toNumber(price);
    
    // Calculate USD value (simple multiplication)
    const usdValue = this.toNumber(tokenBalance) * tokenPrice;
    
    return {
      in_tokens: tokenBalance,
      in_usd: usdValue.toString()
    };
  }
} 