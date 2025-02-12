import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Bet {
  'market_id' : MarketId,
  'user' : Principal,
  'timestamp' : Timestamp,
  'amount' : bigint,
  'outcome_index' : bigint,
}
export type BetError = { 'MarketNotFound' : null } |
  { 'MarketClosed' : null } |
  { 'BetRecordingFailed' : null } |
  { 'TransferError' : string } |
  { 'MarketUpdateFailed' : null } |
  { 'InvalidOutcome' : null } |
  { 'InsufficientBalance' : null } |
  { 'BalanceUpdateFailed' : null };
export interface Delegation {
  'created' : bigint,
  'targets_list_hash' : Uint8Array | number[],
  'target' : Principal,
  'expiration' : [] | [bigint],
}
export type DelegationError = { 'NotFound' : null } |
  { 'Unauthorized' : null } |
  { 'InvalidRequest' : string } |
  { 'StorageError' : string } |
  { 'Expired' : null };
export interface DelegationRequest {
  'targets' : Array<Principal>,
  'expiration' : [] | [bigint],
}
export interface DelegationResponse { 'delegations' : Array<Delegation> }
export interface Distribution {
  'bet_amount' : bigint,
  'winnings' : bigint,
  'user' : Principal,
  'outcome_index' : bigint,
}
export interface GetFeeBalanceResult {
  'balance' : bigint,
  'admin_principal' : Principal,
}
export interface ICRC21ConsentMessageRequest {
  'method' : string,
  'canister' : Principal,
}
export interface ICRC21ConsentMessageResponse { 'consent_message' : string }
export interface Market {
  'id' : MarketId,
  'bet_count_percentages' : Array<number>,
  'status' : MarketStatus,
  'outcome_pools' : Array<bigint>,
  'creator' : Principal,
  'outcome_percentages' : Array<number>,
  'question' : string,
  'resolution_data' : [] | [string],
  'created_at' : Timestamp,
  'end_time' : Timestamp,
  'total_pool' : bigint,
  'outcomes' : Array<string>,
  'resolution_method' : ResolutionMethod,
  'category' : MarketCategory,
  'bet_counts' : Array<bigint>,
}
export type MarketCategory = { 'AI' : null } |
  { 'Memes' : null } |
  { 'Crypto' : null } |
  { 'Other' : null } |
  { 'Politics' : null } |
  { 'KongMadness' : null } |
  { 'Sports' : null };
export type MarketEndTime = { 'SpecificDate' : bigint } |
  { 'Duration' : bigint };
export type MarketId = bigint;
export interface MarketResult {
  'bet_count_percentages' : Array<number>,
  'outcome_pools' : Array<bigint>,
  'outcome_percentages' : Array<number>,
  'winning_pool' : bigint,
  'distributions' : Array<Distribution>,
  'total_pool' : bigint,
  'market' : Market,
  'winning_outcomes' : Array<bigint>,
  'bet_counts' : Array<bigint>,
}
export type MarketStatus = { 'Disputed' : null } |
  { 'Open' : null } |
  { 'Closed' : Array<bigint> };
export interface MarketsByStatus {
  'resolved' : Array<MarketResult>,
  'active' : Array<Market>,
  'expired_unresolved' : Array<Market>,
}
export type ResolutionError = { 'MarketNotFound' : null } |
  { 'MarketStillOpen' : null } |
  { 'InvalidOutcome' : null } |
  { 'InvalidMethod' : null } |
  { 'AlreadyResolved' : null } |
  { 'Unauthorized' : null } |
  { 'UpdateFailed' : null } |
  { 'PayoutFailed' : null };
export type ResolutionMethod = {
    'Oracle' : {
      'oracle_principals' : Array<Principal>,
      'required_confirmations' : bigint,
    }
  } |
  { 'Decentralized' : { 'quorum' : bigint } } |
  { 'Admin' : null };
export interface RevokeDelegationRequest { 'targets' : Array<Principal> }
export type Timestamp = bigint;
export interface UserBetInfo {
  'outcome_text' : string,
  'bet_amount' : bigint,
  'winnings' : [] | [bigint],
  'market' : Market,
  'outcome_index' : bigint,
}
export interface UserHistory {
  'pending_resolution' : Array<UserBetInfo>,
  'total_wagered' : bigint,
  'current_balance' : bigint,
  'total_won' : bigint,
  'active_bets' : Array<UserBetInfo>,
  'resolved_bets' : Array<UserBetInfo>,
}
export interface _SERVICE {
  'create_market' : ActorMethod<
    [
      string,
      MarketCategory,
      string,
      Array<string>,
      ResolutionMethod,
      MarketEndTime,
    ],
    { 'Ok' : MarketId } |
      { 'Err' : string }
  >,
  'get_all_markets' : ActorMethod<[], Array<Market>>,
  'get_balance' : ActorMethod<[Principal], bigint>,
  'get_fee_balance' : ActorMethod<[], GetFeeBalanceResult>,
  'get_market' : ActorMethod<[MarketId], [] | [Market]>,
  'get_market_bets' : ActorMethod<[MarketId], Array<Bet>>,
  'get_markets_by_status' : ActorMethod<[], MarketsByStatus>,
  'get_user_history' : ActorMethod<[Principal], UserHistory>,
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ICRC21ConsentMessageRequest],
    ICRC21ConsentMessageResponse
  >,
  'icrc_34_delegate' : ActorMethod<
    [DelegationRequest],
    { 'Ok' : DelegationResponse } |
      { 'Err' : DelegationError }
  >,
  'icrc_34_get_delegation' : ActorMethod<
    [DelegationRequest],
    { 'Ok' : DelegationResponse } |
      { 'Err' : DelegationError }
  >,
  'icrc_34_revoke_delegation' : ActorMethod<
    [RevokeDelegationRequest],
    { 'Ok' : null } |
      { 'Err' : DelegationError }
  >,
  'place_bet' : ActorMethod<
    [MarketId, bigint, bigint],
    { 'Ok' : null } |
      { 'Err' : BetError }
  >,
  'resolve_via_admin' : ActorMethod<
    [MarketId, Array<bigint>],
    { 'Ok' : null } |
      { 'Err' : ResolutionError }
  >,
  'resolve_via_oracle' : ActorMethod<
    [MarketId, Array<bigint>, Uint8Array | number[]],
    { 'Ok' : null } |
      { 'Err' : ResolutionError }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
