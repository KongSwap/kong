import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface BlockTemplate {
  'height' : bigint,
  'difficulty' : number,
  'prev_hash' : Uint8Array | number[],
  'version' : number,
  'merkle_root' : Uint8Array | number[],
  'target' : Uint8Array | number[],
  'nonce' : bigint,
  'timestamp' : bigint,
}
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'status_code' : number,
}
export interface MinerInfo {
  'speed_percentage' : number,
  'current_token' : [] | [Principal],
  'chunk_size' : bigint,
  'is_mining' : boolean,
}
export interface MinerInitArgs {
  'pow_backend' : Principal,
  'owner' : Principal,
  'launchpad' : Principal,
}
export interface MiningResult {
  'miner' : Principal,
  'solution_hash' : Uint8Array | number[],
  'nonce' : bigint,
  'timestamp' : bigint,
  'block_height' : bigint,
}
export interface MiningStats {
  'total_hashes' : bigint,
  'blocks_mined' : bigint,
  'total_rewards' : bigint,
  'last_hash_rate' : number,
  'start_time' : bigint,
}
export type Result = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : MinerInfo } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export interface _SERVICE {
  'claim_rewards' : ActorMethod<[], Result>,
  'connect_token' : ActorMethod<[Principal], Result_1>,
  'disconnect_token' : ActorMethod<[], Result_1>,
  'find_solution_in_range' : ActorMethod<
    [BlockTemplate, bigint, bigint],
    [] | [MiningResult]
  >,
  'get_canister_id' : ActorMethod<[], Principal>,
  'get_info' : ActorMethod<[], Result_2>,
  'get_mining_stats' : ActorMethod<[], MiningStats>,
  'get_remaining_hashes' : ActorMethod<[], bigint>,
  'get_time_remaining_estimate' : ActorMethod<[], string>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'icrc1_version' : ActorMethod<[], string>,
  'set_chunk_size' : ActorMethod<[bigint], Result_1>,
  'set_max_chunk_duration' : ActorMethod<[bigint], Result_1>,
  'set_mining_speed' : ActorMethod<[number], Result_1>,
  'start_mining' : ActorMethod<[], Result_1>,
  'stop_mining' : ActorMethod<[], Result_1>,
  'top_up' : ActorMethod<[bigint], Result_3>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
