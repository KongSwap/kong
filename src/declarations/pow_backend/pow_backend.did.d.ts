import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type AllInfoResult = { 'Ok' : TokenAllInfo } |
  { 'Err' : string };
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
  'nonce' : bigint,
  'timestamp' : bigint,
}
export type BlockTimeResult = { 'Ok' : number } |
  { 'Err' : string };
export type ChainType = { 'BTC' : null } |
  { 'ICP' : null } |
  { 'SOL' : null } |
  { 'SUI' : null };
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
  'block_time_target' : bigint,
  'current_difficulty' : number,
  'next_halving_interval' : bigint,
  'current_block_reward' : bigint,
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : BlockTemplate } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : TokenInfo } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<SocialLink> } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_6 = { 'Ok' : BlockTemplate } |
  { 'Err' : SolutionError };
export interface SocialLink { 'url' : string, 'platform' : string }
export type SolutionError = { 'UnauthorizedMiner' : null } |
  { 'VerificationFailed' : null } |
  { 'NoBlockToMine' : null } |
  { 'DuplicateSolution' : null } |
  { 'Other' : string } |
  { 'StaleBlock' : null } |
  { 'InternalError' : string };
export interface SupportedStandard { 'url' : string, 'name' : string }
export interface TokenAllInfo {
  'decimals' : number,
  'ticker' : string,
  'average_block_time' : [] | [number],
  'transfer_fee' : bigint,
  'logo' : [] | [string],
  'name' : string,
  'canister_id' : Principal,
  'ledger_id' : [] | [Principal],
  'circulating_supply' : bigint,
  'total_supply' : bigint,
  'current_block_height' : bigint,
  'social_links' : [] | [Array<SocialLink>],
  'current_block_reward' : bigint,
}
export interface TokenInfo {
  'decimals' : number,
  'ticker' : string,
  'average_block_time' : [] | [number],
  'transfer_fee' : bigint,
  'chain' : ChainType,
  'logo' : [] | [string],
  'name' : string,
  'ledger_id' : [] | [Principal],
  'archive_options' : [] | [ArchiveOptions],
  'total_supply' : bigint,
  'current_block_height' : bigint,
  'social_links' : [] | [Array<SocialLink>],
  'current_block_reward' : bigint,
}
export interface TokenInitArgs {
  'decimals' : [] | [number],
  'initial_block_reward' : bigint,
  'ticker' : string,
  'block_time_target_seconds' : bigint,
  'transfer_fee' : [] | [bigint],
  'chain' : ChainType,
  'logo' : [] | [string],
  'name' : string,
  'archive_options' : [] | [ArchiveOptions],
  'halving_interval' : bigint,
  'total_supply' : bigint,
  'social_links' : [] | [Array<SocialLink>],
  'launchpad_id' : Principal,
}
export interface TokenMetrics {
  'circulating_supply' : bigint,
  'total_supply' : bigint,
}
export interface TrustedOriginsResponse { 'trusted_origins' : Array<string> }
export interface _SERVICE {
  'add_social_link' : ActorMethod<[string, string], Result>,
  'claim_rewards' : ActorMethod<[], Result_1>,
  'cleanup_expired_delegations' : ActorMethod<[], bigint>,
  'create_genesis_block' : ActorMethod<[], Result_2>,
  'debug_print_module_hash' : ActorMethod<[Principal], Result>,
  'deregister_miner' : ActorMethod<[], Result>,
  'get_all_info' : ActorMethod<[], AllInfoResult>,
  'get_auth_status' : ActorMethod<[], boolean>,
  'get_average_block_time' : ActorMethod<[[] | [bigint]], BlockTimeResult>,
  'get_block_height' : ActorMethod<[], bigint>,
  'get_block_time_target' : ActorMethod<[], bigint>,
  'get_current_block' : ActorMethod<[], [] | [BlockTemplate]>,
  'get_info' : ActorMethod<[], Result_3>,
  'get_metrics' : ActorMethod<[], MetricsResult>,
  'get_miner_leaderboard' : ActorMethod<[[] | [number]], Array<MinerInfo>>,
  'get_miner_stats' : ActorMethod<[Principal], [] | [MinerInfo]>,
  'get_miners' : ActorMethod<[], Array<MinerInfo>>,
  'get_mining_difficulty' : ActorMethod<[], number>,
  'get_mining_info' : ActorMethod<[], MiningInfo>,
  'get_pending_rewards' : ActorMethod<[], Array<[Principal, bigint]>>,
  'get_social_links' : ActorMethod<[], Result_4>,
  'icrc10_supported_standards' : ActorMethod<[], Array<SupportedStandard>>,
  'icrc1_version' : ActorMethod<[], string>,
  'icrc21_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    ConsentMessageResponse
  >,
  'icrc28_trusted_origins' : ActorMethod<[], TrustedOriginsResponse>,
  'icrc34_delegate' : ActorMethod<[DelegationRequest], Result_5>,
  'register_miner' : ActorMethod<[], Result>,
  'remove_social_link' : ActorMethod<[bigint], Result>,
  'start_token' : ActorMethod<[], Result>,
  'submit_solution' : ActorMethod<
    [bigint, Uint8Array | number[], Principal],
    Result_6
  >,
  'update_social_link' : ActorMethod<[bigint, string, string], Result>,
  'whoami' : ActorMethod<[], Principal>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
