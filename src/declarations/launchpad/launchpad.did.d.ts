import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type ChainType = { 'BTC' : null } |
  { 'ICP' : null } |
  { 'SOL' : null } |
  { 'SUI' : null };
export interface MinerInfo {
  'creator' : Principal,
  'canister_id' : Principal,
  'pow_backend_id' : Principal,
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : Principal } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<Uint8Array | number[]> } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : boolean } |
  { 'Err' : string };
export interface TokenInfo {
  'creator' : Principal,
  'ticker' : string,
  'name' : string,
  'canister_id' : Principal,
  'total_supply' : bigint,
}
export interface _SERVICE {
  'add_trusted_hash' : ActorMethod<[Uint8Array | number[]], Result>,
  'claim_kong' : ActorMethod<[bigint], Result_1>,
  'create_miner' : ActorMethod<[Principal, [] | [Principal]], Result_2>,
  'create_token' : ActorMethod<
    [
      string,
      string,
      bigint,
      [] | [string],
      [] | [number],
      [] | [bigint],
      bigint,
      bigint,
      bigint,
      ChainType,
      [] | [Principal],
    ],
    Result_2
  >,
  'get_top_up_quote' : ActorMethod<[bigint], Result_3>,
  'hashes_for_kong' : ActorMethod<[bigint], Result_3>,
  'list_miners' : ActorMethod<[], Array<MinerInfo>>,
  'list_tokens' : ActorMethod<[], Array<TokenInfo>>,
  'list_trusted_hashes' : ActorMethod<[], Result_4>,
  'remove_trusted_hash' : ActorMethod<[Uint8Array | number[]], Result_5>,
  'top_up_miner' : ActorMethod<[Principal, bigint], Result_3>,
  'validate_hash' : ActorMethod<[Uint8Array | number[]], boolean>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
