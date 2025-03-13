import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface CycleMeasurement { 'balance' : bigint, 'timestamp' : bigint }
export interface CycleUsageStats {
  'current_balance' : bigint,
  'usage_last_15min' : [] | [bigint],
  'measurements' : Array<CycleMeasurement>,
  'estimated_remaining_time' : [] | [string],
  'usage_rate_per_hour' : [] | [number],
}
export interface MinerInfo {
  'speed_percentage' : number,
  'current_token' : [] | [Principal],
  'chunks_per_refresh' : bigint,
  'chunk_size' : bigint,
  'is_mining' : boolean,
}
export interface MiningStats {
  'total_hashes' : bigint,
  'blocks_mined' : bigint,
  'chunks_since_refresh' : bigint,
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
  'get_canister_id' : ActorMethod<[], Principal>,
  'get_cycle_usage' : ActorMethod<[], CycleUsageStats>,
  'get_info' : ActorMethod<[], Result_1>,
  'get_mining_stats' : ActorMethod<[], [] | [MiningStats]>,
  'set_chunk_size' : ActorMethod<[bigint], Result>,
  'set_mining_speed' : ActorMethod<[number], Result>,
  'set_template_refresh_interval' : ActorMethod<[bigint], Result>,
  'start_mining' : ActorMethod<[], Result>,
  'stop_mining' : ActorMethod<[], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
