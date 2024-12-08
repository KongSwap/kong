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
      };
      logo_url: string;
      total_24h_volume: string;
      price: number;
      tvl: number;
      balance: string;
      timestamp?: number;
      isFavorite?: boolean;
      usdValue?: number;
      formattedBalance?: string;
      formattedUsdValue?: string;
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

    interface Transaction {
      type: 'send' | 'receive';
      amount: string;
      token: string;
      to?: string;
      from?: string;
      date: string;
    }
  }
}

export {};
