declare global {
  interface TokenBalance {
    in_tokens: bigint;
    in_usd: string;
  }

  interface TokenBalances {
    default: bigint;
    subaccount?: bigint;
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
}


export {};
