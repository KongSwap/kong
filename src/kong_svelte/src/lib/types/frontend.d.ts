declare global {
  namespace FE {
    interface TokenBalance {
      in_tokens: bigint;
      in_usd: string;
    }

    interface Token {
      canister_id: string;
      address: string;
      name: string;
      symbol: string;
      fee: number;
      fee_fixed: string;
      decimals: number;
      token: string;
      token_type: string;
      token_id: number;
      chain: string;
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      pool_symbol: string;
      pools: any[];
      metrics: {
        total_supply: string;
        price: string;
        previous_price?: string;
        volume_24h: string;
        market_cap: string;
        formatted_market_cap?: string;
        tvl: string;
        updated_at: string;
        price_change_24h?: string;
        previous_price?: number;
        market_cap_rank?: number;
      };
      logo_url: string;
      total_24h_volume: string;
      balance: string;
      timestamp?: number;
      isFavorite?: boolean;
      formattedBalance?: string;
      formattedUsdValue?: string;
      volumeRank?: number;
    }

    interface TokenMetrics {
      price: string;
      volume_24h: string;
      total_supply: string;
      market_cap: string;
      tvl: string;
      updated_at: string;
      price_change_24h: string;
      previous_price: string;
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
