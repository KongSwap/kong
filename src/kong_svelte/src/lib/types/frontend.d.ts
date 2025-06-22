declare global {
  interface TokenBalance {
    in_tokens: bigint;
    in_usd: string;
  }

  interface UserPoolBalance {
    id: string;
    address_0?: string;
    address_1?: string;
    amount_0: string;
    amount_1: string;
    balance: string;
    name: string;
    symbol: string;
    symbol_0?: string;
    symbol_1?: string;
    ts: string;
    usd_amount_0?: number;
    usd_amount_1?: number;
    usd_balance?: number;
    timestamp?: number;
  }

  interface Transaction {
    type: "send" | "receive";
    amount: string;
    token: string;
    to?: string;
    from?: string;
    date: string;
  }

  namespace Kong {
    interface Token {
      id: number; // Unique identifier for the token (same astoken_id on FE.IcrcToken)
      token_id?: number; // Identifier used in transaction API responses
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
      market_cap_rank?: string;
      is_verified?: boolean;
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

    interface LPToken {
      address: string;
      chain: string;
      decimals: number;
      fee: bigint;
      name: string;
      pool_id_of: number;
      pool_symbol: string;
      symbol: string;
      token: string;
      token_id: number;
      total_supply: bigint;
    }
  
  }
}

export {};
