import { writable } from 'svelte/store';
import type { TokenInitArgs } from '../../../../declarations/token_backend/token_backend.did';

// Default values for token parameters
const defaultTokenParams: TokenInitArgs = {
  name: '',
  ticker: '',
  total_supply: BigInt(0),
  logo: [],
  decimals: [8], // Default to 8 decimals
  transfer_fee: [BigInt(10000)], // Default transfer fee
  archive_options: [], // Empty array for optional field
  initial_block_reward: BigInt(0),
  block_time_target_seconds: BigInt(5),
  halving_interval: BigInt(0),
  social_links: [],
};

function createTokenParamsStore() {
  const { subscribe, set, update } = writable<TokenInitArgs>(defaultTokenParams);

  return {
    subscribe,
    set,
    update,
    // Set individual fields
    setName: (name: string) => update(params => ({ ...params, name })),
    setTicker: (ticker: string) => update(params => ({ ...params, ticker })),
    setTotalSupply: (total_supply: bigint) => update(params => ({ ...params, total_supply })),
    setLogo: (logo: string | null) => update(params => ({ ...params, logo: logo ? [logo] : [] })),
    setDecimals: (decimals: number) => update(params => ({ ...params, decimals: [decimals] })),
    setTransferFee: (transfer_fee: bigint) => update(params => ({ ...params, transfer_fee: [transfer_fee] })),
    setInitialBlockReward: (initial_block_reward: bigint) => update(params => ({ ...params, initial_block_reward })),
    setBlockTimeTarget: (block_time_target_seconds: bigint) => update(params => ({ ...params, block_time_target_seconds })),
    setHalvingInterval: (halving_interval: bigint) => update(params => ({ ...params, halving_interval })),
    
    // Reset to default values
    reset: () => set(defaultTokenParams)
  };
}

export const tokenParams = createTokenParamsStore(); 
