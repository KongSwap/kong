import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface MinerInfo {
  'owner' : Principal,
  'current_token' : [] | [Principal],
  'is_mining' : boolean,
}
export interface MinerInitArgs { 'owner' : Principal }
export type MinerType = { 'Premium' : null } |
  { 'Lite' : null } |
  { 'Normal' : null };
export interface MiningStats {
  'total_hashes' : bigint,
  'blocks_mined' : bigint,
  'total_rewards' : bigint,
  'last_hash_rate' : number,
  'start_time' : bigint,
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : MinerInfo } |
  { 'Err' : string };
export interface _SERVICE {
  'claim_rewards' : ActorMethod<[], Result>,
  'connect_token' : ActorMethod<[Principal], Result>,
  'disconnect_token' : ActorMethod<[], Result>,
  'get_info' : ActorMethod<[], Result_1>,
  'get_mining_stats' : ActorMethod<[], [] | [MiningStats]>,
  'start_mining' : ActorMethod<[], Result>,
  'stop_mining' : ActorMethod<[], Result>,
  'transform_miner' : ActorMethod<[MinerType], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
