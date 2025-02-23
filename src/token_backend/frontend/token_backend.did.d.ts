import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ArchiveOptions {
  'num_blocks_to_archive' : bigint,
  'max_transactions_per_response' : [] | [bigint],
  'trigger_threshold' : bigint,
  'more_controller_ids' : [] | [Array<Principal>],
  'max_message_size_bytes' : [] | [bigint],
  'cycles_for_archive_creation' : [] | [bigint],
  'node_max_memory_size_bytes' : [] | [bigint],
  'controller_id' : Principal,
}
export interface BlockTemplate {
  'height' : bigint,
  'difficulty' : number,
  'prev_hash' : Uint8Array | number[],
  'version' : number,
  'merkle_root' : Uint8Array | number[],
  'target' : Uint8Array | number[],
  'events' : Array<Event>,
  'nonce' : bigint,
  'timestamp' : bigint,
}
export type BlockTimeResult = { 'Ok' : number } |
  { 'Err' : string };
export interface ConsentMessageRequest {
  'arg' : Uint8Array | number[],
  'method' : string,
  'consent_preferences' : ConsentPreferences,
}
export type ConsentMessageResponse = {
    'Ok' : { 'consent_message' : string, 'language' : string }
  } |
  { 'Err' : { 'error_message' : string, 'error_code' : number } };
export interface ConsentPreferences { 'language' : string }
export type DelegationError = {
    'InvalidExpiry' : {
      'max' : bigint,
      'provided' : bigint,
      'current' : bigint,
    }
  } |
  { 'Anonymous' : null } |
  { 'SystemError' : string } |
  { 'Unauthorized' : string } |
  { 'RateLimitExceeded' : { 'next_allowed' : bigint } } |
  {
    'InvalidDelegationId' : {
      'provided' : Uint8Array | number[],
      'expected' : Uint8Array | number[],
    }
  };
export interface DelegationRequest {
  'delegatee' : Principal,
  'expiry' : bigint,
}
export type DelegationResponse = {
    'Ok' : { 'expiry' : bigint, 'delegation_id' : Uint8Array | number[] }
  } |
  { 'Err' : { 'error_message' : string, 'error_code' : number } };
export interface Event {
  'timestamp' : bigint,
  'block_height' : bigint,
  'event_type' : EventType,
}
export interface EventBatch {
  'events' : Array<Event>,
  'timestamp' : bigint,
  'block_height' : bigint,
}
export type EventType = {
    'DifficultyAdjustment' : {
      'old_difficulty' : number,
      'new_difficulty' : number,
      'reason' : string,
    }
  } |
  {
    'VersionUpgrade' : { 'new_version' : string, 'features' : Array<string> }
  } |
  {
    'Achievement' : {
      'miner' : Principal,
      'name' : string,
      'description' : string,
    }
  } |
  { 'RewardHalving' : { 'block_height' : bigint, 'new_reward' : bigint } } |
  { 'SystemAnnouncement' : { 'message' : string, 'severity' : string } } |
  {
    'MiningMilestone' : {
      'miner' : Principal,
      'blocks_mined' : bigint,
      'achievement' : string,
    }
  } |
  {
    'LeaderboardUpdate' : {
      'miner' : Principal,
      'total_mined' : bigint,
      'position' : number,
    }
  } |
  {
    'MiningCompetition' : {
      'winner' : Principal,
      'prize' : bigint,
      'competition_id' : string,
    }
  };
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
export type MetricsResult = { 'Ok' : TokenMetrics } |
  { 'Err' : string };
export interface MinerInfo {
  'status' : MinerStatus,
  'principal' : Principal,
  'registration_time' : bigint,
  'stats' : MinerStats,
  'last_status_change' : bigint,
}
export interface MinerStats {
  'average_hashrate' : number,
  'blocks_mined' : bigint,
  'best_hashrate' : number,
  'first_block_timestamp' : [] | [bigint],
  'total_rewards' : bigint,
  'last_hashrate_update' : [] | [bigint],
  'total_hashes_processed' : bigint,
  'last_block_timestamp' : [] | [bigint],
  'hashrate_samples' : Array<[bigint, number]>,
  'current_hashrate' : number,
}
export type MinerStatus = { 'Inactive' : null } |
  { 'Active' : null };
export interface MiningInfo {
  'next_difficulty_adjustment' : bigint,
  'block_time_target' : bigint,
  'current_difficulty' : number,
  'current_block_reward' : bigint,
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : BlockTemplate } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : TokenInfo } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_5 = { 'Ok' : Principal } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : boolean } |
  { 'Err' : string };
export interface SupportedStandard { 'url' : string, 'name' : string }
export interface TokenInfo {
  'decimals' : number,
  'ticker' : string,
  'transfer_fee' : bigint,
  'logo' : [] | [string],
  'name' : string,
  'ledger_id' : [] | [Principal],
  'archive_options' : [] | [ArchiveOptions],
  'total_supply' : bigint,
}
export interface TokenInitArgs {
  'decimals' : [] | [number],
  'initial_block_reward' : bigint,
  'ticker' : string,
  'initial_difficulty' : number,
  'block_time_target_seconds' : bigint,
  'transfer_fee' : [] | [bigint],
  'logo' : [] | [string],
  'name' : string,
  'archive_options' : [] | [ArchiveOptions],
  'difficulty_adjustment_blocks' : bigint,
  'total_supply' : bigint,
}
export interface TokenMetrics {
  'circulating_supply' : bigint,
  'total_supply' : bigint,
}
export interface TrustedOriginsResponse { 'trusted_origins' : Array<string> }
export interface _SERVICE {
  'cleanup_expired_delegations' : ActorMethod<[], bigint>,
  'deregister_miner' : ActorMethod<[], Result>,
  'generate_new_block' : ActorMethod<[], Result_1>,
  'get_active_miners' : ActorMethod<[], Array<Principal>>,
  'get_auth_status' : ActorMethod<[], boolean>,
  'get_average_block_time' : ActorMethod<[[] | [number]], BlockTimeResult>,
  'get_block_time_target' : ActorMethod<[], bigint>,
  'get_current_block' : ActorMethod<[], [] | [BlockTemplate]>,
  'get_event_batches' : ActorMethod<[[] | [bigint]], Array<EventBatch>>,
  'get_info' : ActorMethod<[], Result_2>,
  'get_metrics' : ActorMethod<[], MetricsResult>,
  'get_miner_leaderboard' : ActorMethod<[[] | [number]], Array<MinerInfo>>,
  'get_miner_stats' : ActorMethod<[Principal], [] | [MinerInfo]>,
  'get_miners' : ActorMethod<[], Array<MinerInfo>>,
  'get_mining_difficulty' : ActorMethod<[], number>,
  'get_mining_info' : ActorMethod<[], MiningInfo>,
  'get_recent_events' : ActorMethod<[[] | [number]], Array<Event>>,
  'get_recent_events_from_batches' : ActorMethod<[[] | [number]], Array<Event>>,
  'get_target' : ActorMethod<[], Result_3>,
  'get_total_cycles_earned' : ActorMethod<[], bigint>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'icrc10_supported_standards' : ActorMethod<[], Array<SupportedStandard>>,
  'icrc21_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    ConsentMessageResponse
  >,
  'icrc28_trusted_origins' : ActorMethod<[], TrustedOriginsResponse>,
  'icrc34_delegate' : ActorMethod<[DelegationRequest], Result_4>,
  'register_miner' : ActorMethod<[], Result>,
  'set_block_time_target' : ActorMethod<[bigint], bigint>,
  'start_token' : ActorMethod<[], Result_5>,
  'submit_solution' : ActorMethod<
    [Principal, bigint, Uint8Array | number[], bigint],
    Result_6
  >,
  'whoami' : ActorMethod<[], Principal>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
