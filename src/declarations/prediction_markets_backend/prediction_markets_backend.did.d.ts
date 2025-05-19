import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface BatchClaimResult {
  'claimed_amounts' : Array<[string, bigint]>,
  'transaction_ids' : Array<[bigint, bigint]>,
  'failure_count' : bigint,
  'results' : Array<ClaimResult>,
  'success_count' : bigint,
}
export interface Bet {
  'market_id' : bigint,
  'user' : Principal,
  'timestamp' : bigint,
  'amount' : bigint,
  'outcome_index' : bigint,
}
export interface BetDistributionDetail {
  'weighted_contribution' : [] | [number],
  'bet_amount' : bigint,
  'bonus_amount' : bigint,
  'time_weight' : [] | [number],
  'claim_id' : [] | [bigint],
  'total_payout' : bigint,
  'user' : Principal,
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

export interface ConsentInfo {
  'metadata' : ConsentMessageMetadata,
  'consent_message' : ConsentMessage,
}
export type ConsentMessage = {
    'LineDisplayMessage' : { 'pages' : Array<LineDisplayPage> }
  } |
  { 'GenericDisplayMessage' : string };
export interface ConsentMessageMetadata {
  'utc_offset_minutes' : [] | [number],
  'language' : string,
}
export interface ConsentMessageRequest {
  'arg' : Uint8Array | number[],
  'method' : string,
  'user_preferences' : ConsentMessageSpec,
}
export interface ConsentMessageSpec {
  'metadata' : ConsentMessageMetadata,
  'device_spec' : [] | [DisplayMessageType],
}
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
export type DisplayMessageType = { 'GenericDisplay' : null } |
  {
    'LineDisplay' : {
      'characters_per_line' : number,
      'lines_per_page' : number,
    }
  };
export interface Distribution {
  'bet_amount' : bigint,
  'winnings' : bigint,
  'user' : Principal,
  'outcome_index' : bigint,
}
export interface ErrorInfo { 'description' : string }

  'start' : bigint,
  'length' : bigint,
  'sort_option' : [] | [SortOption],
}

export interface GetMarketsByStatusResult {
  'total_active' : bigint,
  'total_resolved' : bigint,
  'total_expired_unresolved' : bigint,
  'markets_by_status' : MarketsByStatus,
}
export interface Icrc28TrustedOriginsResponse {
  'trusted_origins' : Array<string>,
}
export interface LineDisplayPage { 'lines' : Array<string> }
export interface Market {
  'id' : bigint,
  'bet_count_percentages' : Array<number>,
  'status' : MarketStatus,
  'outcome_pools' : Array<bigint>,
  'creator' : Principal,
  'featured' : boolean,
  'outcome_percentages' : Array<number>,
  'question' : string,
  'image_url' : [] | [string],
  'resolution_data' : [] | [string],
  'created_at' : bigint,
  'end_time' : bigint,
  'total_pool' : bigint,
  'outcomes' : Array<string>,
  'resolution_method' : ResolutionMethod,
  'category' : MarketCategory,
  'rules' : string,
  'resolved_by' : [] | [Principal],
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
export interface MarketResolutionDetails {
  'total_transfer_fees' : bigint,
  'total_winning_pool' : bigint,
  'total_market_pool' : bigint,
  'platform_fee_amount' : bigint,
  'token_id' : string,
  'token_symbol' : string,
  'failed_transactions' : Array<FailedTransactionInfo>,
  'market_id' : bigint,
  'total_weighted_contribution' : [] | [number],
  'platform_fee_percentage' : bigint,
  'used_time_weighting' : boolean,
  'distribution_details' : Array<BetDistributionDetail>,
  'resolution_timestamp' : bigint,
  'time_weight_alpha' : [] | [number],
  'winning_bet_count' : bigint,
  'winning_outcomes' : Array<bigint>,
  'distributable_profit' : bigint,
  'fee_transaction_id' : [] | [bigint],
  'total_profit' : bigint,
}
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
  { 'Closed' : Array<bigint> } |
  { 'Voided' : null };
export interface MarketsByStatus {
  'resolved' : Array<MarketResult>,
  'active' : Array<Market>,
  'expired_unresolved' : Array<Market>,
}
export interface ProcessDetails {
  'transaction_id' : [] | [bigint],
  'timestamp' : bigint,
}
export type RefundReason = { 'Disputed' : null } |
  { 'TransactionFailed' : null } |
  { 'Other' : string } |
  { 'VoidedMarket' : null };
export type ResolutionError = { 'MarketNotFound' : null } |
  { 'MarketStillOpen' : null } |
  { 'TransferError' : string } |
  { 'InvalidOutcome' : null } |
  { 'InvalidMethod' : null } |
  { 'AlreadyResolved' : null } |
  { 'Unauthorized' : null } |
  { 'UpdateFailed' : null } |
  { 'PayoutFailed' : null } |
  { 'VoidingFailed' : null };
export type ResolutionMethod = {
    'Oracle' : {
      'oracle_principals' : Array<Principal>,
      'required_confirmations' : bigint,
    }
  } |
  { 'Decentralized' : { 'quorum' : bigint } } |
  { 'Admin' : null };

  { 'Err' : ErrorInfo };
export type Result_2 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_3 = { 'Ok' : null } |
  { 'Err' : DelegationError };
export type Result_4 = { 'Ok' : null } |
  { 'Err' : BetError };

export type SortDirection = { 'Descending' : null } |
  { 'Ascending' : null };
export type SortOption = { 'TotalPool' : SortDirection } |
  { 'CreatedAt' : SortDirection };
export interface StatsResult {
  'total_bets' : bigint,
  'total_active_markets' : bigint,
  'total_markets' : bigint,
}
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
      [] | [string],
    ],

  'get_markets_by_status' : ActorMethod<
    [GetFeaturedMarketsArgs],
    GetMarketsByStatusResult
  >,

  'get_user_history' : ActorMethod<[Principal], UserHistory>,
  'get_user_pending_claims' : ActorMethod<[], Array<ClaimRecord>>,
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    Result_1
  >,
  'icrc28_trusted_origins' : ActorMethod<[], Icrc28TrustedOriginsResponse>,
  'icrc_34_delegate' : ActorMethod<[DelegationRequest], Result_2>,
  'icrc_34_get_delegation' : ActorMethod<[DelegationRequest], Result_2>,
  'icrc_34_revoke_delegation' : ActorMethod<
    [RevokeDelegationRequest],
    Result_3
  >,
  'is_admin' : ActorMethod<[Principal], boolean>,

}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
