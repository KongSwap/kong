declare global {
  namespace BE {
    interface ICToken {
      symbol: string;
      fee: number;
      fee_fixed: bigint;
      decimals: number;
      token: string;
      token_id: number;
      chain: string;
      name: string;
      canister_id: string;
      address: string;  
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      pool_symbol: string;
      is_removed: boolean;
    }
  
    interface LPToken {
      address: string;
      chain: string;
      decimals: number;
      fee: bigint;
      name: string;
      is_removed: boolean;
      pool_id_of: number;
      pool_symbol: string;
      symbol: string;
      token: string;
      token_id: number;
      total_supply: bigint;
    }
  
    type Token = { IC?: ICToken, LP?: LPToken };
  }
}

export {};
