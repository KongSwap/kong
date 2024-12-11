declare global {
  interface TokenBalance {
    in_tokens: bigint;
    in_usd: string;
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
    type: "send" | "receive";
    amount: string;
    token: string;
    to?: string;
    from?: string;
    date: string;
  }
}

export {};
