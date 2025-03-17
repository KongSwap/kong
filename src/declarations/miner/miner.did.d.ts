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
export interface HttpHeader { 'value' : string, 'name' : string }
export interface HttpResponse {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<HttpHeader>,
}
export interface MinerInfo {
  'speed_percentage' : number,
  'icrc_version' : number,
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
export type Result_1 = { 'Ok' : Array<[Principal, Result]> } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : MinerInfo } |
  { 'Err' : string };
export interface TransformArgs {
  'context' : Uint8Array | number[],
  'response' : HttpResponse,
}
export interface _SERVICE {
  'check_api_config' : ActorMethod<[], [boolean, [] | [string]]>,
  'claim_all_rewards' : ActorMethod<[], Result_1>,
  'claim_rewards' : ActorMethod<[], Result>,
  'claim_token_rewards' : ActorMethod<[Principal], Result>,
  'connect_token' : ActorMethod<[Principal], Result>,
  'disable_api_notifications' : ActorMethod<[], Result>,
  'disconnect_token' : ActorMethod<[], Result>,
  'enable_api_notifications' : ActorMethod<[], Result>,
  'get_canister_id' : ActorMethod<[], Principal>,
  'get_cycle_usage' : ActorMethod<[], CycleUsageStats>,
  'get_info' : ActorMethod<[], Result_2>,
  'get_mining_stats' : ActorMethod<[], [] | [MiningStats]>,
  'get_token_rewards' : ActorMethod<[], Array<[Principal, bigint]>>,
  'icrc1_version' : ActorMethod<[], number>,
  'set_api_endpoint' : ActorMethod<[string, string], Result>,
  'set_chunk_size' : ActorMethod<[bigint], Result>,
  'set_chunks_per_refresh' : ActorMethod<[bigint], undefined>,
  'set_max_chunk_duration' : ActorMethod<[bigint], undefined>,
  'set_mining_speed' : ActorMethod<[number], Result>,
  'set_template_refresh_interval' : ActorMethod<[bigint], Result>,
  'start_mining' : ActorMethod<[], Result>,
  'stop_mining' : ActorMethod<[], Result>,
  'transform_http_response' : ActorMethod<[TransformArgs], HttpResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
