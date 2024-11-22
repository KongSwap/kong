declare global {
  namespace FE {
    interface TokenBalance {
      in_tokens: bigint;
      in_usd: string;
    }

    interface Token {
      canister_id: string;
      name: string;
      symbol: string;
      fee: bigint;
      decimals: number;
      token: string;
      token_id: number;
      chain: string;
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      on_kong: boolean;
      pool_symbol: string;
      pools: BE.Pool[];
      logo?: string;
      total_24h_volume?: bigint;
      price?: number;
      tvl?: number;
      balance?: bigint;
      formattedBalance?: string;
      formattedUsdValue?: string;
      timestamp?: number;
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
