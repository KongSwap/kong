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
      on_kong: boolean;
      pool_symbol: string;
      pools: any[];
      metrics: {
        total_supply: string;
        price: string;
        volume_24h: string;
        market_cap: string;
        updated_at: string;
        price_change_24h?: string;
        historical_price?: number;
        historical_timestamp?: number;
      };
      logo_url: string;
      total_24h_volume: string;
      price: number;
      tvl: number;
      balance: string;
      timestamp?: number;
      isFavorite?: boolean;
      formattedBalance?: string;
      formattedUsdValue?: string;
      marketCapRank?: number;
    }

    interface UserPoolBalance {
      amount_0: bigint;
      amount_1: bigint;
      balance: bigint;
      name: string;
      symbol: string;
      symbol_0: string;
      symbol_1: string;
      ts: bigint;
      usd_amount_0: number;
      usd_amount_1: number;
      usd_balance: number;
    }

    export interface Transaction {
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

    export interface AllowanceData {
      address: string;
      amount: bigint;
      spender: string;
      wallet_address: string;
      timestamp: number;
    }
  }
}

export {};
