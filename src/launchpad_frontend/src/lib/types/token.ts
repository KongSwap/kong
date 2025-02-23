export interface Token {
  symbol: string;
  decimals: number;
  canister_id: string;
  address: string;
  fee_fixed: bigint;
  icrc1?: boolean;
  icrc2?: boolean;
} 
