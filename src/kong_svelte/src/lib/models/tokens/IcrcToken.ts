// IcrcTokenSerializer.ts
// Serializer for token data

import { BaseModel } from '../BaseModel';

export class IcrcToken extends BaseModel {
  /**
   * Formats ODIN token names and symbols by removing excessive bullet separators
   * @param value - The name or symbol to format
   * @returns Formatted string
   */
  private static formatOdinToken(value: string): string {
    // Check if this is an ODIN token with bullet separators
    if (value.includes('•') && value.includes('ODIN')) {
      // Split by bullet and keep only the first part and ODIN
      const parts = value.split('•');
      if (parts.length > 2) {
        // Return first part + ODIN (e.g., "GHOSTNODE•ODIN")
        return `${parts[0]}`;
      }
    }
    return value;
  }

  public static formatOdinSymbol(value: string): string {
    // Check if this is an ODIN token with bullet separators
    if (value.includes('•') && value.includes('ODIN')) {
      // Split by bullet and keep only the first part and ODIN
      const parts = value.split('•');
      if (parts.length > 2) {
        // Return first part + ODIN (e.g., "GHOSTNODE•ODIN")
        return `${parts[0]}`;
      }
    }
    return value;
  }

  /**
   * Serializes a token metadata response
   * @param response - The raw token metadata response
   * @returns Formatted token metadata as Kong.Token
   */
  static serializeTokenMetadata(response: unknown): Kong.Token | null {
    try {
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid token metadata format');
      }
      
      const data = response as Record<string, unknown>;
      
      // Determine standards based on boolean flags
      const standards: string[] = [];
      if (this.toBoolean(data.icrc1)) standards.push('ICRC-1');
      if (this.toBoolean(data.icrc2)) standards.push('ICRC-2');
      if (this.toBoolean(data.icrc3)) standards.push('ICRC-3');
      // Add other potential standards if needed

      return {
        id: Number(data.token_id),
        name: this.formatOdinToken(this.toString(data.name)),
        symbol: this.formatOdinSymbol(this.toString(data.symbol)),
        address: this.toString(data.address || data.canister_id), // Use canister_id as address
        fee: this.toNumber(data.fee),
        fee_fixed: this.toString(data.fee_fixed || data.fee).replace("_", ""),
        decimals: this.toNumber(data.decimals),
        token_type: 'IC', // Explicitly set for ICRC tokens
        chain: 'ICP', // Explicitly set for ICRC tokens
        standards: standards,
        logo_url: this.toString(data.logo_url),
        metrics: this.serializeTokenMetrics(data.metrics),
        timestamp: Date.now(),
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
        market_cap_rank: '-',
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
      market_cap_rank: this.toString(data.market_cap_rank || '-'),
      tvl: this.toString(data.tvl || '0'),
      updated_at: this.toString(data.updated_at || new Date().toISOString()),
      price_change_24h: this.toString(data.price_change_24h || '0'),
      is_verified: this.toBoolean(data.is_verified),
      previous_price: this.toString(data.previous_price || data.price || '0')
    };
  }

  /**
   * Serializes a list of tokens
   * @param tokens - Array of raw token data
   * @returns Array of formatted Kong.Token
   */
  static serializeTokens(tokens: unknown[]): Kong.Token[] {
    if (!Array.isArray(tokens)) {
      return [];
    }
    
    return tokens
      .map(token => this.serializeTokenMetadata(token))
      .filter((token): token is Kong.Token => token !== null);
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
   * @returns Formatted token balance (Consider removing if Kong.Token doesn't need balance)
   */
  static serializeTokenBalance(balance: unknown, price: string | number): TokenBalance {
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