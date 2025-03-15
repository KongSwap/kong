export interface Claim {
  claim_id: bigint;
  status: string;
  chain: string;
  symbol: string;
  canister_id: string;
  amount: bigint;
  fee: bigint;
  to_address: string;
  desc: string;
  ts: bigint;
  logo_url?: string;
  decimals?: number;
} 