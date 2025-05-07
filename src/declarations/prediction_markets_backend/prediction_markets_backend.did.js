export const idlFactory = ({ IDL }) => {
  const TokenInfo = IDL.Record({
    'id' : IDL.Text,
    'is_kong' : IDL.Bool,
    'decimals' : IDL.Nat8,
    'transfer_fee' : IDL.Nat,
    'name' : IDL.Text,
    'fee_percentage' : IDL.Nat64,
    'symbol' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const MarketCategory = IDL.Variant({
    'AI' : IDL.Null,
    'Memes' : IDL.Null,
    'Crypto' : IDL.Null,
    'Other' : IDL.Null,
    'Politics' : IDL.Null,
    'KongMadness' : IDL.Null,
    'Sports' : IDL.Null,
  });
  const ResolutionMethod = IDL.Variant({
    'Oracle' : IDL.Record({
      'oracle_principals' : IDL.Vec(IDL.Principal),
      'required_confirmations' : IDL.Nat,
    }),
    'Decentralized' : IDL.Record({ 'quorum' : IDL.Nat }),
    'Admin' : IDL.Null,
  });
  const MarketEndTime = IDL.Variant({
    'SpecificDate' : IDL.Nat,
    'Duration' : IDL.Nat,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const EstimatedReturnScenario = IDL.Record({
    'probability' : IDL.Float64,
    'max_return' : IDL.Nat,
    'time_weight' : IDL.Opt(IDL.Float64),
    'time_weighted' : IDL.Bool,
    'min_return' : IDL.Nat,
    'expected_return' : IDL.Nat,
    'scenario' : IDL.Text,
  });
  const EstimatedReturn = IDL.Record({
    'bet_amount' : IDL.Nat,
    'uses_time_weighting' : IDL.Bool,
    'current_outcome_pool' : IDL.Nat,
    'estimated_platform_fee' : IDL.Opt(IDL.Nat),
    'current_market_pool' : IDL.Nat,
    'market_id' : IDL.Nat,
    'platform_fee_percentage' : IDL.Opt(IDL.Nat64),
    'scenarios' : IDL.Vec(EstimatedReturnScenario),
    'time_weight_alpha' : IDL.Opt(IDL.Float64),
    'current_time' : IDL.Nat,
    'outcome_index' : IDL.Nat,
  });
  const ResolutionError = IDL.Variant({
    'MarketNotFound' : IDL.Null,
    'MarketStillOpen' : IDL.Null,
    'InvalidMarketStatus' : IDL.Null,
    'TransferError' : IDL.Text,
    'AwaitingAdminApproval' : IDL.Null,
    'InvalidOutcome' : IDL.Null,
    'InvalidMethod' : IDL.Null,
    'AlreadyResolved' : IDL.Null,
    'ResolutionMismatch' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'AwaitingCreatorApproval' : IDL.Null,
    'UpdateFailed' : IDL.Null,
    'PayoutFailed' : IDL.Null,
    'VoidingFailed' : IDL.Null,
    'ResolutionDisagreement' : IDL.Null,
  });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : ResolutionError });
  const TimeWeightPoint = IDL.Record({
    'weight' : IDL.Float64,
    'absolute_time' : IDL.Nat,
    'relative_time' : IDL.Float64,
  });
  const MarketStatus = IDL.Variant({
    'Disputed' : IDL.Null,
    'Closed' : IDL.Vec(IDL.Nat),
    'Active' : IDL.Null,
    'Voided' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const SortDirection = IDL.Variant({
    'Descending' : IDL.Null,
    'Ascending' : IDL.Null,
  });
  const SortOption = IDL.Variant({
    'TotalPool' : SortDirection,
    'CreatedAt' : SortDirection,
  });
  const GetAllMarketsArgs = IDL.Record({
    'status_filter' : IDL.Opt(MarketStatus),
    'start' : IDL.Nat,
    'length' : IDL.Nat64,
    'sort_option' : IDL.Opt(SortOption),
  });
  const Market = IDL.Record({
    'id' : IDL.Nat,
    'bet_count_percentages' : IDL.Vec(IDL.Float64),
    'status' : MarketStatus,
    'outcome_pools' : IDL.Vec(IDL.Nat),
    'uses_time_weighting' : IDL.Bool,
    'creator' : IDL.Principal,
    'outcome_percentages' : IDL.Vec(IDL.Float64),
    'question' : IDL.Text,
    'token_id' : IDL.Text,
    'image_url' : IDL.Opt(IDL.Text),
    'resolution_data' : IDL.Opt(IDL.Text),
    'created_at' : IDL.Nat,
    'end_time' : IDL.Nat,
    'total_pool' : IDL.Nat,
    'outcomes' : IDL.Vec(IDL.Text),
    'resolution_method' : ResolutionMethod,
    'time_weight_alpha' : IDL.Opt(IDL.Float64),
    'category' : MarketCategory,
    'rules' : IDL.Text,
    'resolved_by' : IDL.Opt(IDL.Principal),
    'bet_counts' : IDL.Vec(IDL.Nat),
  });
  const GetAllMarketsResult = IDL.Record({
    'markets' : IDL.Vec(Market),
    'total_count' : IDL.Nat,
  });
  const FailedTransaction = IDL.Record({
    'resolved' : IDL.Bool,
    'token_id' : IDL.Text,
    'retry_count' : IDL.Nat8,
    'market_id' : IDL.Opt(IDL.Nat),
    'recipient' : IDL.Principal,
    'error' : IDL.Text,
    'timestamp' : IDL.Nat64,
    'amount' : IDL.Nat,
  });
  const Bet = IDL.Record({
    'token_id' : IDL.Text,
    'market_id' : IDL.Nat,
    'user' : IDL.Principal,
    'timestamp' : IDL.Nat,
    'amount' : IDL.Nat,
    'outcome_index' : IDL.Nat,
  });
  const BetPayoutRecord = IDL.Record({
    'transaction_id' : IDL.Opt(IDL.Nat),
    'bet_amount' : IDL.Nat,
    'bonus_amount' : IDL.Opt(IDL.Nat),
    'time_weight' : IDL.Opt(IDL.Float64),
    'platform_fee_amount' : IDL.Opt(IDL.Nat),
    'token_id' : IDL.Text,
    'token_symbol' : IDL.Text,
    'market_id' : IDL.Nat,
    'platform_fee_percentage' : IDL.Nat64,
    'user' : IDL.Principal,
    'payout_amount' : IDL.Nat,
    'original_contribution_returned' : IDL.Nat,
    'timestamp' : IDL.Nat,
    'was_time_weighted' : IDL.Bool,
    'outcome_index' : IDL.Nat,
  });
  const GetMarketsByStatusArgs = IDL.Record({
    'start' : IDL.Nat,
    'length' : IDL.Nat,
  });
  const Distribution = IDL.Record({
    'bet_amount' : IDL.Nat,
    'winnings' : IDL.Nat,
    'user' : IDL.Principal,
    'outcome_index' : IDL.Nat,
  });
  const MarketResult = IDL.Record({
    'bet_count_percentages' : IDL.Vec(IDL.Float64),
    'outcome_pools' : IDL.Vec(IDL.Nat),
    'outcome_percentages' : IDL.Vec(IDL.Float64),
    'winning_pool' : IDL.Nat,
    'distributions' : IDL.Vec(Distribution),
    'total_pool' : IDL.Nat,
    'market' : Market,
    'winning_outcomes' : IDL.Vec(IDL.Nat),
    'bet_counts' : IDL.Vec(IDL.Nat),
  });
  const MarketsByStatus = IDL.Record({
    'resolved' : IDL.Vec(MarketResult),
    'active' : IDL.Vec(Market),
    'expired_unresolved' : IDL.Vec(Market),
  });
  const GetMarketsByStatusResult = IDL.Record({
    'total_active' : IDL.Nat,
    'total_resolved' : IDL.Nat,
    'total_expired_unresolved' : IDL.Nat,
    'markets_by_status' : MarketsByStatus,
  });
  const StatsResult = IDL.Record({
    'total_bets' : IDL.Nat,
    'total_active_markets' : IDL.Nat,
    'total_markets' : IDL.Nat,
  });
  const UserBetInfo = IDL.Record({
    'outcome_text' : IDL.Text,
    'bet_amount' : IDL.Nat,
    'winnings' : IDL.Opt(IDL.Nat),
    'market' : Market,
    'outcome_index' : IDL.Nat,
  });
  const UserHistory = IDL.Record({
    'pending_resolution' : IDL.Vec(UserBetInfo),
    'total_wagered' : IDL.Nat,
    'current_balance' : IDL.Nat,
    'total_won' : IDL.Nat,
    'active_bets' : IDL.Vec(UserBetInfo),
    'resolved_bets' : IDL.Vec(UserBetInfo),
  });
  const ConsentMessageMetadata = IDL.Record({
    'utc_offset_minutes' : IDL.Opt(IDL.Int16),
    'language' : IDL.Text,
  });
  const DisplayMessageType = IDL.Variant({
    'GenericDisplay' : IDL.Null,
    'LineDisplay' : IDL.Record({
      'characters_per_line' : IDL.Nat16,
      'lines_per_page' : IDL.Nat16,
    }),
  });
  const ConsentMessageSpec = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'device_spec' : IDL.Opt(DisplayMessageType),
  });
  const ConsentMessageRequest = IDL.Record({
    'arg' : IDL.Vec(IDL.Nat8),
    'method' : IDL.Text,
    'user_preferences' : ConsentMessageSpec,
  });
  const LineDisplayPage = IDL.Record({ 'lines' : IDL.Vec(IDL.Text) });
  const ConsentMessage = IDL.Variant({
    'LineDisplayMessage' : IDL.Record({ 'pages' : IDL.Vec(LineDisplayPage) }),
    'GenericDisplayMessage' : IDL.Text,
  });
  const ConsentInfo = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'consent_message' : ConsentMessage,
  });
  const ErrorInfo = IDL.Record({ 'description' : IDL.Text });
  const Result_3 = IDL.Variant({ 'Ok' : ConsentInfo, 'Err' : ErrorInfo });
  const Icrc28TrustedOriginsResponse = IDL.Record({
    'trusted_origins' : IDL.Vec(IDL.Text),
  });
  const DelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
    'expiration' : IDL.Opt(IDL.Nat64),
  });
  const Delegation = IDL.Record({
    'created' : IDL.Nat64,
    'targets_list_hash' : IDL.Vec(IDL.Nat8),
    'target' : IDL.Principal,
    'expiration' : IDL.Opt(IDL.Nat64),
  });
  const DelegationResponse = IDL.Record({
    'delegations' : IDL.Vec(Delegation),
  });
  const DelegationError = IDL.Variant({
    'NotFound' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'StorageError' : IDL.Text,
    'Expired' : IDL.Null,
  });
  const Result_4 = IDL.Variant({
    'Ok' : DelegationResponse,
    'Err' : DelegationError,
  });
  const RevokeDelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : DelegationError });
  const BetError = IDL.Variant({
    'MarketNotFound' : IDL.Null,
    'InsufficientActivationBet' : IDL.Null,
    'MarketClosed' : IDL.Null,
    'BetRecordingFailed' : IDL.Null,
    'NotMarketCreator' : IDL.Null,
    'InvalidMarketStatus' : IDL.Null,
    'TransferError' : IDL.Text,
    'MarketUpdateFailed' : IDL.Null,
    'InvalidOutcome' : IDL.Null,
    'MarketNotActive' : IDL.Null,
    'InsufficientBalance' : IDL.Null,
    'BalanceUpdateFailed' : IDL.Null,
  });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : BetError });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text });
  const Result_8 = IDL.Variant({ 'Ok' : IDL.Opt(IDL.Nat), 'Err' : IDL.Text });
  return IDL.Service({
    'add_supported_token' : IDL.Func([TokenInfo], [Result], []),
    'create_market' : IDL.Func(
        [
          IDL.Text,
          MarketCategory,
          IDL.Text,
          IDL.Vec(IDL.Text),
          ResolutionMethod,
          MarketEndTime,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Bool),
          IDL.Opt(IDL.Float64),
          IDL.Opt(IDL.Text),
        ],
        [Result_1],
        [],
      ),
    'estimate_bet_return' : IDL.Func(
        [IDL.Nat64, IDL.Nat64, IDL.Nat64, IDL.Nat64, IDL.Opt(IDL.Text)],
        [EstimatedReturn],
        ['query'],
      ),
    'force_resolve_market' : IDL.Func(
        [IDL.Nat, IDL.Vec(IDL.Nat)],
        [Result_2],
        [],
      ),
    'generate_time_weight_curve' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(TimeWeightPoint)],
        ['query'],
      ),
    'get_all_categories' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'get_all_markets' : IDL.Func(
        [GetAllMarketsArgs],
        [GetAllMarketsResult],
        ['query'],
      ),
    'get_all_transactions' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, FailedTransaction))],
        ['query'],
      ),
    'get_market' : IDL.Func([IDL.Nat], [IDL.Opt(Market)], ['query']),
    'get_market_bets' : IDL.Func([IDL.Nat], [IDL.Vec(Bet)], ['query']),
    'get_market_payout_records' : IDL.Func(
        [IDL.Nat64],
        [IDL.Vec(BetPayoutRecord)],
        ['query'],
      ),
    'get_markets_by_status' : IDL.Func(
        [GetMarketsByStatusArgs],
        [GetMarketsByStatusResult],
        ['query'],
      ),
    'get_stats' : IDL.Func([], [StatsResult], ['query']),
    'get_supported_tokens' : IDL.Func([], [IDL.Vec(TokenInfo)], ['query']),
    'get_token_fee_percentage' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(IDL.Nat64)],
        ['query'],
      ),
    'get_transactions_by_market' : IDL.Func(
        [IDL.Nat],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, FailedTransaction))],
        ['query'],
      ),
    'get_transactions_by_recipient' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, FailedTransaction))],
        ['query'],
      ),
    'get_unresolved_transactions' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, FailedTransaction))],
        ['query'],
      ),
    'get_user_history' : IDL.Func([IDL.Principal], [UserHistory], ['query']),
    'icrc21_canister_call_consent_message' : IDL.Func(
        [ConsentMessageRequest],
        [Result_3],
        ['query'],
      ),
    'icrc28_trusted_origins' : IDL.Func(
        [],
        [Icrc28TrustedOriginsResponse],
        ['query'],
      ),
    'icrc_34_delegate' : IDL.Func([DelegationRequest], [Result_4], []),
    'icrc_34_get_delegation' : IDL.Func(
        [DelegationRequest],
        [Result_4],
        ['query'],
      ),
    'icrc_34_revoke_delegation' : IDL.Func(
        [RevokeDelegationRequest],
        [Result_5],
        [],
      ),
    'is_admin' : IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'mark_transaction_resolved' : IDL.Func([IDL.Nat64], [Result], []),
    'place_bet' : IDL.Func(
        [IDL.Nat, IDL.Nat, IDL.Nat, IDL.Opt(IDL.Text)],
        [Result_6],
        [],
      ),
    'propose_resolution' : IDL.Func(
        [IDL.Nat, IDL.Vec(IDL.Nat)],
        [Result_2],
        [],
      ),
    'resolve_via_admin' : IDL.Func([IDL.Nat, IDL.Vec(IDL.Nat)], [Result_2], []),
    'resolve_via_oracle' : IDL.Func(
        [IDL.Nat, IDL.Vec(IDL.Nat), IDL.Vec(IDL.Nat8)],
        [Result_2],
        [],
      ),
    'retry_market_transactions' : IDL.Func([IDL.Nat], [IDL.Vec(Result_7)], []),
    'retry_transaction' : IDL.Func([IDL.Nat64], [Result_8], []),
    'simulate_future_weight' : IDL.Func(
        [IDL.Nat64, IDL.Nat64, IDL.Nat64],
        [IDL.Float64],
        ['query'],
      ),
    'update_token_config' : IDL.Func([IDL.Text, TokenInfo], [Result], []),
    'void_market' : IDL.Func([IDL.Nat], [Result_2], []),
  });
};
export const init = ({ IDL }) => { return []; };
