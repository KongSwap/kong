import { writable, type Writable } from 'svelte/store';
import type { Principal } from '@dfinity/principal';
  import type { ArchiveOptions, SocialLink } from '../../../../../src/declarations/token_backend/token_backend.did.js';

// This interface is for our local store, which is a simplified version of the canister's TokenInfo
export interface TokenInfo {
  name: string;
  ticker: string;
  decimals: number;
  logo: [] | [string];
  ledger_id: [] | [Principal];
  archive_options: [] | [ArchiveOptions];
  total_supply: bigint;
  transfer_fee: bigint;
  social_links: [] | [Array<SocialLink>];
}

function createTokenInfoStore() {
  const { subscribe, set }: Writable<TokenInfo> = writable<TokenInfo>({
    name: 'Loading...',
    ticker: 'KONG',
    decimals: 8,
    logo: [],
    ledger_id: [],
    archive_options: [],
    total_supply: BigInt(0),
    transfer_fee: BigInt(0),
    social_links: []
  });

  return {
    subscribe,
    setInfo: (
      name: string, 
      ticker: string, 
      decimals: number = 8, 
      logo: [] | [string] = [], 
      ledger_id: [] | [Principal] = [], 
      archive_options: [] | [ArchiveOptions] = [], 
      total_supply: bigint = BigInt(0),
      transfer_fee: bigint = BigInt(0),
      social_links: [] | [Array<SocialLink>] = []
    ) => {
      set({ 
        name, 
        ticker, 
        decimals, 
        logo, 
        ledger_id, 
        archive_options, 
        total_supply,
        transfer_fee,
        social_links
      });
    }
  };
}

export const tokenInfo = createTokenInfoStore(); 
