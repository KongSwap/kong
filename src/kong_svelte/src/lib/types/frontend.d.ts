declare global {
  namespace Kong {
    interface Token {
      id: number; // Unique identifier for the token (same astoken_id on FE.IcrcToken)
      name: string;
      symbol: string;
      address: string; // Address of the token (canister_id for ICRC tokens, mint for SPL tokens)
      fee: number;
      fee_fixed: string;
      decimals: number;
      token_type: 'IC' | 'LP' | 'SPL';
      chain: 'ICP' | 'Solana';
      standards: string[];
      logo_url: string;
      metrics: FE.TokenMetrics;
      timestamp?: number;
    }
  }
  namespace FE {

    interface StatsToken extends Kong.Token {
      volumeRank?: number;
      tvlRank?: number;
      priceChangeRank?: number;
      marketCapRank?: number;
    }

    interface TokenMetrics {
      total_supply: string;
      price: string;
      previous_price?: string;
      volume_24h: string;
      market_cap: string;
      formatted_market_cap?: string;
      tvl: string;
      price_change_24h?: string;
      previous_price?: number;
      market_cap_rank?: number;
      updated_at: string;
    }

    interface Transaction {
      mid_price: number;
      pay_amount: number;
      pay_token_id: number;
      price: number;
      receive_amount: number;
      receive_token_id: number;
      timestamp?: string;
      ts?: string;
      tx_id?: string;
      user: {
        principal_id: string;
      };
    }

    interface AllowanceData {
      address: string;
      amount: bigint;
      spender: string;
      wallet_address: string;
      timestamp: number;
    }

    interface PoolTotal {
      id?: string;
      total_tvl: bigint;
      total_24h_volume: bigint;
      total_24h_lp_fee: bigint;
      total_24h_num_swaps: bigint;
      timestamp: number;
    }
  }
}

export {};
