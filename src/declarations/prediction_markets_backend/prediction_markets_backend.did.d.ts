import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Bet {
  'token_id' : string,
  'market_id' : bigint,
  'user' : Principal,
  'timestamp' : bigint,
  'amount' : bigint,
  'outcome_index' : bigint,
}
export type BetError = { 'MarketNotFound' : null } |
  { 'InsufficientActivationBet' : null } |
  { 'MarketClosed' : null } |
  { 'BetRecordingFailed' : null } |
  { 'NotMarketCreator' : null } |
  { 'InvalidMarketStatus' : null } |
  { 'TransferError' : string } |
  { 'MarketUpdateFailed' : null } |
  { 'InvalidOutcome' : null } |
  { 'MarketNotActive' : null } |
  { 'InsufficientBalance' : null } |
  { 'BalanceUpdateFailed' : null };
export interface BetPayoutRecord {
  'transaction_id' : [] | [bigint],
  'bet_amount' : bigint,
  'bonus_amount' : [] | [bigint],
  'time_weight' : [] | [number],
  'platform_fee_amount' : [] | [bigint],
  'token_id' : string,
  'token_symbol' : string,
  'market_id' : bigint,
  'platform_fee_percentage' : bigint,
  'user' : Principal,
  'payout_amount' : bigint,
  'original_contribution_returned' : bigint,
  'timestamp' : bigint,
  'was_time_weighted' : boolean,
  'outcome_index' : bigint,
}
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
export interface EstimatedReturn {
  'bet_amount' : bigint,
  'uses_time_weighting' : boolean,
  'current_outcome_pool' : bigint,
  'estimated_platform_fee' : [] | [bigint],
  'current_market_pool' : bigint,
  'market_id' : bigint,
  'platform_fee_percentage' : [] | [bigint],
  'scenarios' : Array<EstimatedReturnScenario>,
  'time_weight_alpha' : [] | [number],
  'current_time' : bigint,
  'outcome_index' : bigint,
}
export interface EstimatedReturnScenario {
  'probability' : number,
  'max_return' : bigint,
  'time_weight' : [] | [number],
  'time_weighted' : boolean,
  'min_return' : bigint,
  'expected_return' : bigint,
  'scenario' : string,
}
export interface FailedTransaction {
  'resolved' : boolean,
  'token_id' : string,
  'retry_count' : number,
  'market_id' : [] | [bigint],
  'recipient' : Principal,
  'error' : string,
  'timestamp' : bigint,
  'amount' : bigint,
}
export interface GetAllMarketsArgs {
  'status_filter' : [] | [MarketStatus],
  'start' : bigint,
  'length' : bigint,
  'sort_option' : [] | [SortOption],
}
export interface GetAllMarketsResult {
  'markets' : Array<Market>,
  'total_count' : bigint,
}
export interface GetMarketsByCreatorArgs {
  'creator' : Principal,
  'start' : bigint,
  'length' : bigint,
  'sort_by_creation_time' : boolean,
}
export interface GetMarketsByCreatorResult {
  'total' : bigint,
  'markets' : Array<Market>,
}
export interface GetMarketsByStatusArgs { 'start' : bigint, 'length' : bigint }
export interface GetMarketsByStatusResult {
  'total_active' : bigint,
  'total_resolved' : bigint,
  'total_expired_unresolved' : bigint,
  'markets_by_status' : MarketsByStatus,
}
export interface Icrc28TrustedOriginsResponse {
  'trusted_origins' : Array<string>,
}
export interface LatestBets { 'bet' : Bet, 'market' : Market }
export interface LineDisplayPage { 'lines' : Array<string> }
export interface Market {
  'id' : bigint,
  'bet_count_percentages' : Array<number>,
  'status' : MarketStatus,
  'outcome_pools' : Array<bigint>,
  'uses_time_weighting' : boolean,
  'creator' : Principal,
  'outcome_percentages' : Array<number>,
  'question' : string,
  'token_id' : string,
  'image_url' : [] | [string],
  'resolution_data' : [] | [string],
  'created_at' : bigint,
  'end_time' : bigint,
  'total_pool' : bigint,
  'outcomes' : Array<string>,
  'resolution_method' : ResolutionMethod,
  'time_weight_alpha' : [] | [number],
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
  { 'Closed' : Array<bigint> } |
  { 'Active' : null } |
  { 'ExpiredUnresolved' : null } |
  { 'Voided' : null } |
  { 'PendingActivation' : null };
export interface MarketsByStatus {
  'resolved' : Array<MarketResult>,
  'active' : Array<Market>,
  'expired_unresolved' : Array<Market>,
}
export interface PlaceBetArgs {
  'token_id' : [] | [string],
  'market_id' : bigint,
  'amount' : bigint,
  'outcome_index' : bigint,
}
export interface ResolutionArgs {
  'market_id' : bigint,
  'winning_outcomes' : Array<bigint>,
}
export type ResolutionError = { 'MarketNotFound' : null } |
  { 'MarketStillOpen' : null } |
  { 'InvalidMarketStatus' : null } |
  { 'TransferError' : string } |
  { 'AwaitingAdminApproval' : null } |
  { 'InvalidOutcome' : null } |
  { 'InvalidMethod' : null } |
  { 'AlreadyResolved' : null } |
  { 'ResolutionMismatch' : null } |
  { 'Unauthorized' : null } |
  { 'AwaitingCreatorApproval' : null } |
  { 'UpdateFailed' : null } |
  { 'PayoutFailed' : null } |
  { 'VoidingFailed' : null } |
  { 'ResolutionDisagreement' : null };
export type ResolutionMethod = {
    'Oracle' : {
      'oracle_principals' : Array<Principal>,
      'required_confirmations' : bigint,
    }
  } |
  { 'Decentralized' : { 'quorum' : bigint } } |
  { 'Admin' : null };
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : null } |
  { 'Err' : ResolutionError };
export type Result_3 = { 'Ok' : ConsentInfo } |
  { 'Err' : ErrorInfo };
export type Result_4 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_5 = { 'Ok' : null } |
  { 'Err' : DelegationError };
export type Result_6 = { 'Ok' : null } |
  { 'Err' : BetError };
export type Result_7 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : [] | [bigint] } |
  { 'Err' : string };
export interface RevokeDelegationRequest { 'targets' : Array<Principal> }
export interface SearchMarketsArgs {
  'include_resolved' : boolean,
  'sort_field' : [] | [SortField],
  'token_id' : [] | [string],
  'query' : string,
  'start' : bigint,
  'length' : bigint,
  'sort_direction' : [] | [SortDirection],
}
export interface SearchMarketsResult {
  'total' : bigint,
  'markets' : Array<Market>,
}
export type SortDirection = { 'Descending' : null } |
  { 'Ascending' : null };
export type SortField = { 'TotalPool' : null } |
  { 'CreationTime' : null } |
  { 'EndTime' : null } |
  { 'TotalBets' : null };
export type SortOption = { 'TotalPool' : SortDirection } |
  { 'CreatedAt' : SortDirection } |
  { 'EndTime' : SortDirection };
export interface StatsResult {
  'total_bets' : bigint,
  'total_active_markets' : bigint,
  'total_markets' : bigint,
}
export interface TimeWeightPoint {
  'weight' : number,
  'absolute_time' : bigint,
  'relative_time' : number,
}
export interface TokenInfo {
  'id' : string,
  'is_kong' : boolean,
  'decimals' : number,
  'transfer_fee' : bigint,
  'name' : string,
  'fee_percentage' : bigint,
  'activation_fee' : bigint,
  'symbol' : string,
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
  'add_supported_token' : ActorMethod<[TokenInfo], Result>,
  'create_market' : ActorMethod<
    [
      string,
      MarketCategory,
      string,
      Array<string>,
      ResolutionMethod,
      MarketEndTime,
      [] | [string],
      [] | [boolean],
      [] | [number],
      [] | [string],
    ],
    Result_1
  >,
  'estimate_bet_return' : ActorMethod<
    [bigint, bigint, bigint, bigint, [] | [string]],
    EstimatedReturn
  >,
  'force_resolve_market' : ActorMethod<[ResolutionArgs], Result_2>,
  'generate_time_weight_curve' : ActorMethod<
    [bigint, bigint],
    Array<TimeWeightPoint>
  >,
  'get_all_categories' : ActorMethod<[], Array<string>>,
  'get_all_markets' : ActorMethod<[GetAllMarketsArgs], GetAllMarketsResult>,
  'get_all_transactions' : ActorMethod<[], Array<[bigint, FailedTransaction]>>,
  'get_latest_bets' : ActorMethod<[], Array<LatestBets>>,
  'get_market' : ActorMethod<[bigint], [] | [Market]>,
  'get_market_bets' : ActorMethod<[bigint], Array<Bet>>,
  'get_market_payout_records' : ActorMethod<[bigint], Array<BetPayoutRecord>>,
  'get_markets_by_creator' : ActorMethod<
    [GetMarketsByCreatorArgs],
    GetMarketsByCreatorResult
  >,
  'get_markets_by_status' : ActorMethod<
    [GetMarketsByStatusArgs],
    GetMarketsByStatusResult
  >,
  'get_stats' : ActorMethod<[], StatsResult>,
  'get_supported_tokens' : ActorMethod<[], Array<TokenInfo>>,
  'get_token_fee_percentage' : ActorMethod<[string], [] | [bigint]>,
  'get_transactions_by_market' : ActorMethod<
    [bigint],
    Array<[bigint, FailedTransaction]>
  >,
  'get_transactions_by_recipient' : ActorMethod<
    [Principal],
    Array<[bigint, FailedTransaction]>
  >,
  'get_unresolved_transactions' : ActorMethod<
    [],
    Array<[bigint, FailedTransaction]>
  >,
  'get_user_history' : ActorMethod<[Principal], UserHistory>,
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    Result_3
  >,
  'icrc28_trusted_origins' : ActorMethod<[], Icrc28TrustedOriginsResponse>,
  'icrc_34_delegate' : ActorMethod<[DelegationRequest], Result_4>,
  'icrc_34_get_delegation' : ActorMethod<[DelegationRequest], Result_4>,
  'icrc_34_revoke_delegation' : ActorMethod<
    [RevokeDelegationRequest],
    Result_5
  >,
  'is_admin' : ActorMethod<[Principal], boolean>,
  'mark_transaction_resolved' : ActorMethod<[bigint], Result>,
  'place_bet' : ActorMethod<[PlaceBetArgs], Result_6>,
  'propose_resolution' : ActorMethod<[ResolutionArgs], Result_2>,
  'resolve_via_admin' : ActorMethod<[ResolutionArgs], Result_2>,
  'resolve_via_admin_legacy' : ActorMethod<[bigint, Array<bigint>], Result_2>,
  'resolve_via_oracle' : ActorMethod<
    [bigint, Array<bigint>, Uint8Array | number[]],
    Result_2
  >,
  'retry_market_transactions' : ActorMethod<[bigint], Array<Result_7>>,
  'retry_transaction' : ActorMethod<[bigint], Result_8>,
  'search_markets' : ActorMethod<[SearchMarketsArgs], SearchMarketsResult>,
  'simulate_future_weight' : ActorMethod<[bigint, bigint, bigint], number>,
  'update_expired_markets' : ActorMethod<[], bigint>,
  'update_token_config' : ActorMethod<[string, TokenInfo], Result>,
  'void_market' : ActorMethod<[bigint], Result_2>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
