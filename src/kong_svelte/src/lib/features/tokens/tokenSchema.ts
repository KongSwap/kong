import { z } from 'zod';

// Define the schema for FE.TokenBalance
export const TokenBalanceSchema = z.object({
  in_tokens: z.bigint(),
  in_usd: z.string(),
});

// Define the schema for FE.Token
export const TokenSchema = z.object({
  canister_id: z.string(),
  name: z.string(),
  symbol: z.string(),
  fee: z.bigint(),
  decimals: z.number(),
  token: z.string(),
  token_id: z.number(),
  chain: z.string(),
  icrc1: z.boolean(),
  icrc2: z.boolean(),
  icrc3: z.boolean(),
  on_kong: z.boolean(),
  pool_symbol: z.string(),
  logo: z.string().optional(),
  total_24h_volume: z.bigint().optional(),
  price: z.number().optional(),
  tvl: z.number().optional(),
  balance: z.bigint().optional(),
});

// Define the schema for BE.ICToken
export const ICTokenSchema = z.object({
  fee: z.bigint(),
  decimals: z.number(),
  token: z.string(),
  token_id: z.number(),
  chain: z.string(),
  name: z.string(),
  canister_id: z.string(),
  icrc1: z.boolean(),
  icrc2: z.boolean(),
  icrc3: z.boolean(),
  pool_symbol: z.string(),
  symbol: z.string(),
  on_kong: z.boolean(),
});

// Define the schema for BE.LPToken
export const LPTokenSchema = z.object({
  address: z.string(),
  chain: z.string(),
  decimals: z.number(),
  fee: z.bigint(),
  name: z.string(),
  on_kong: z.boolean(),
  pool_id_of: z.number(),
  pool_symbol: z.string(),
  symbol: z.string(),
  token: z.string(),
  token_id: z.number(),
  total_supply: z.bigint(),
});

// Define the schema for BE.Token
export const BETokenSchema = z.union([
  z.object({ IC: ICTokenSchema }).required(),
  z.object({ LP: LPTokenSchema }).required(),
]);

// Define the schema for BE.Pool
export const PoolSchema = z.object({
  lp_token_symbol: z.string(),
  balance: z.bigint(),
  total_lp_fee: z.bigint(),
  name: z.string(),
  lp_fee_0: z.bigint(),
  lp_fee_1: z.bigint(),
  balance_0: z.bigint(),
  balance_1: z.bigint(),
  rolling_24h_volume: z.bigint(),
  rolling_24h_apy: z.number(),
  address_0: z.string(),
  address_1: z.string(),
  symbol_0: z.string(),
  symbol_1: z.string(),
  total_volume: z.bigint(),
  pool_id: z.number(),
  price: z.number(),
  chain_0: z.string(),
  chain_1: z.string(),
  lp_token_supply: z.bigint(),
  symbol: z.string(),
  lp_fee_bps: z.number(),
  on_kong: z.boolean(),
});

// Define the schema for BE.SwapTx
export const SwapTxSchema = z.object({
  ts: z.bigint(),
  receive_chain: z.string(),
  pay_amount: z.bigint(),
  receive_amount: z.bigint(),
  pay_symbol: z.string(),
  receive_symbol: z.string(),
  pool_symbol: z.string(),
  price: z.number(),
  pay_chain: z.string(),
  lp_fee: z.bigint(),
  gas_fee: z.bigint(),
});

// Define the schema for BE.User
export const UserSchema = z.object({
  account_id: z.string(),
  user_name: z.string(),
  fee_level_expires_at: z.bigint().optional(),
  referred_by: z.string().optional(),
  user_id: z.number(),
  fee_level: z.number(),
  principal_id: z.string(),
  referred_by_expires_at: z.bigint().optional(),
  campaign1_flags: z.array(z.boolean()),
  my_referral_code: z.string(),
});

// Define the schema for an array of BE.Token
export const BETokenArraySchema = z.array(BETokenSchema);

// Example usage
// const tokenData = { ... }; // some token data
// const parsedToken = TokenSchema.parse(tokenData);