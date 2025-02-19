export const idlFactory = ({ IDL }) => {
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
  const MarketId = IDL.Nat;
  const MarketStatus = IDL.Variant({
    'Disputed' : IDL.Null,
    'Open' : IDL.Null,
    'Closed' : IDL.Vec(IDL.Nat),
  });
  const Timestamp = IDL.Nat;
  const Market = IDL.Record({
    'id' : MarketId,
    'bet_count_percentages' : IDL.Vec(IDL.Float64),
    'status' : MarketStatus,
    'outcome_pools' : IDL.Vec(IDL.Nat),
    'creator' : IDL.Principal,
    'outcome_percentages' : IDL.Vec(IDL.Float64),
    'question' : IDL.Text,
    'resolution_data' : IDL.Opt(IDL.Text),
    'created_at' : Timestamp,
    'end_time' : Timestamp,
    'total_pool' : IDL.Nat,
    'outcomes' : IDL.Vec(IDL.Text),
    'resolution_method' : ResolutionMethod,
    'category' : MarketCategory,
    'resolved_by' : IDL.Opt(IDL.Principal),
    'bet_counts' : IDL.Vec(IDL.Nat),
  });
  const GetFeeBalanceResult = IDL.Record({
    'balance' : IDL.Nat,
    'admin_principal' : IDL.Principal,
  });
  const Bet = IDL.Record({
    'market_id' : MarketId,
    'user' : IDL.Principal,
    'timestamp' : Timestamp,
    'amount' : IDL.Nat,
    'outcome_index' : IDL.Nat,
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
  const ICRC21ConsentMessageRequest = IDL.Record({
    'method' : IDL.Text,
    'canister' : IDL.Principal,
  });
  const ICRC21ConsentMessageResponse = IDL.Record({
    'consent_message' : IDL.Text,
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
  const RevokeDelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
  });
  const BetError = IDL.Variant({
    'MarketNotFound' : IDL.Null,
    'MarketClosed' : IDL.Null,
    'BetRecordingFailed' : IDL.Null,
    'TransferError' : IDL.Text,
    'MarketUpdateFailed' : IDL.Null,
    'InvalidOutcome' : IDL.Null,
    'InsufficientBalance' : IDL.Null,
    'BalanceUpdateFailed' : IDL.Null,
  });
  const ResolutionError = IDL.Variant({
    'MarketNotFound' : IDL.Null,
    'MarketStillOpen' : IDL.Null,
    'InvalidOutcome' : IDL.Null,
    'InvalidMethod' : IDL.Null,
    'AlreadyResolved' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'UpdateFailed' : IDL.Null,
    'PayoutFailed' : IDL.Null,
  });
  return IDL.Service({
    'add_admin' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'create_market' : IDL.Func(
        [
          IDL.Text,
          MarketCategory,
          IDL.Text,
          IDL.Vec(IDL.Text),
          ResolutionMethod,
          MarketEndTime,
        ],
        [IDL.Variant({ 'Ok' : MarketId, 'Err' : IDL.Text })],
        [],
      ),
    'get_admin_principals' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'get_all_markets' : IDL.Func([], [IDL.Vec(Market)], ['query']),
    'get_balance' : IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
    'get_fee_balance' : IDL.Func([], [GetFeeBalanceResult], ['query']),
    'get_market' : IDL.Func([MarketId], [IDL.Opt(Market)], ['query']),
    'get_market_bets' : IDL.Func([MarketId], [IDL.Vec(Bet)], ['query']),
    'get_markets_by_status' : IDL.Func([], [MarketsByStatus], ['query']),
    'get_user_history' : IDL.Func([IDL.Principal], [UserHistory], ['query']),
    'icrc21_canister_call_consent_message' : IDL.Func(
        [ICRC21ConsentMessageRequest],
        [ICRC21ConsentMessageResponse],
        ['query'],
      ),
    'icrc_34_delegate' : IDL.Func(
        [DelegationRequest],
        [IDL.Variant({ 'Ok' : DelegationResponse, 'Err' : DelegationError })],
        [],
      ),
    'icrc_34_get_delegation' : IDL.Func(
        [DelegationRequest],
        [IDL.Variant({ 'Ok' : DelegationResponse, 'Err' : DelegationError })],
        ['query'],
      ),
    'icrc_34_revoke_delegation' : IDL.Func(
        [RevokeDelegationRequest],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : DelegationError })],
        [],
      ),
    'is_admin' : IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'place_bet' : IDL.Func(
        [MarketId, IDL.Nat, IDL.Nat],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : BetError })],
        [],
      ),
    'remove_admin' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'resolve_via_admin' : IDL.Func(
        [MarketId, IDL.Vec(IDL.Nat)],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : ResolutionError })],
        [],
      ),
    'resolve_via_oracle' : IDL.Func(
        [MarketId, IDL.Vec(IDL.Nat), IDL.Vec(IDL.Nat8)],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : ResolutionError })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
