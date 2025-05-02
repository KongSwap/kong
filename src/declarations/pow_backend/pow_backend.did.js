export const idlFactory = ({ IDL }) => {
  const ChainType = IDL.Variant({
    'BTC' : IDL.Null,
    'ICP' : IDL.Null,
    'SOL' : IDL.Null,
    'SUI' : IDL.Null,
  });
  const ArchiveOptions = IDL.Record({
    'num_blocks_to_archive' : IDL.Nat64,
    'max_transactions_per_response' : IDL.Opt(IDL.Nat64),
    'trigger_threshold' : IDL.Nat64,
    'more_controller_ids' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
    'cycles_for_archive_creation' : IDL.Opt(IDL.Nat64),
    'node_max_memory_size_bytes' : IDL.Opt(IDL.Nat64),
    'controller_id' : IDL.Principal,
  });
  const SocialLink = IDL.Record({ 'url' : IDL.Text, 'platform' : IDL.Text });
  const TokenInitArgs = IDL.Record({
    'decimals' : IDL.Opt(IDL.Nat8),
    'initial_block_reward' : IDL.Nat64,
    'ticker' : IDL.Text,
    'block_time_target_seconds' : IDL.Nat64,
    'transfer_fee' : IDL.Opt(IDL.Nat64),
    'chain' : ChainType,
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'archive_options' : IDL.Opt(ArchiveOptions),
    'halving_interval' : IDL.Nat64,
    'total_supply' : IDL.Nat64,
    'social_links' : IDL.Opt(IDL.Vec(SocialLink)),
    'launchpad_id' : IDL.Principal,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const BlockTemplate = IDL.Record({
    'height' : IDL.Nat64,
    'difficulty' : IDL.Nat32,
    'prev_hash' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Nat32,
    'merkle_root' : IDL.Vec(IDL.Nat8),
    'target' : IDL.Vec(IDL.Nat8),
    'nonce' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
  });
  const Result_2 = IDL.Variant({ 'Ok' : BlockTemplate, 'Err' : IDL.Text });
  const TokenAllInfo = IDL.Record({
    'decimals' : IDL.Nat8,
    'ticker' : IDL.Text,
    'average_block_time' : IDL.Opt(IDL.Float64),
    'transfer_fee' : IDL.Nat64,
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'canister_id' : IDL.Principal,
    'ledger_id' : IDL.Opt(IDL.Principal),
    'circulating_supply' : IDL.Nat64,
    'total_supply' : IDL.Nat64,
    'current_block_height' : IDL.Nat64,
    'social_links' : IDL.Opt(IDL.Vec(SocialLink)),
    'current_block_reward' : IDL.Nat64,
  });
  const AllInfoResult = IDL.Variant({ 'Ok' : TokenAllInfo, 'Err' : IDL.Text });
  const BlockTimeResult = IDL.Variant({ 'Ok' : IDL.Float64, 'Err' : IDL.Text });
  const TokenInfo = IDL.Record({
    'decimals' : IDL.Nat8,
    'ticker' : IDL.Text,
    'average_block_time' : IDL.Opt(IDL.Float64),
    'transfer_fee' : IDL.Nat64,
    'chain' : ChainType,
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'ledger_id' : IDL.Opt(IDL.Principal),
    'archive_options' : IDL.Opt(ArchiveOptions),
    'total_supply' : IDL.Nat64,
    'current_block_height' : IDL.Nat64,
    'social_links' : IDL.Opt(IDL.Vec(SocialLink)),
    'current_block_reward' : IDL.Nat64,
  });
  const Result_3 = IDL.Variant({ 'Ok' : TokenInfo, 'Err' : IDL.Text });
  const TokenMetrics = IDL.Record({
    'circulating_supply' : IDL.Nat64,
    'total_supply' : IDL.Nat64,
  });
  const MetricsResult = IDL.Variant({ 'Ok' : TokenMetrics, 'Err' : IDL.Text });
  const MinerStatus = IDL.Variant({
    'Inactive' : IDL.Null,
    'Active' : IDL.Null,
  });
  const MinerStats = IDL.Record({
    'average_hashrate' : IDL.Float64,
    'blocks_mined' : IDL.Nat64,
    'best_hashrate' : IDL.Float64,
    'first_block_timestamp' : IDL.Opt(IDL.Nat64),
    'total_rewards' : IDL.Nat64,
    'last_hashrate_update' : IDL.Opt(IDL.Nat64),
    'total_hashes_processed' : IDL.Nat64,
    'last_block_timestamp' : IDL.Opt(IDL.Nat64),
    'hashrate_samples' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Float64)),
    'current_hashrate' : IDL.Float64,
  });
  const MinerInfo = IDL.Record({
    'status' : MinerStatus,
    'principal' : IDL.Principal,
    'registration_time' : IDL.Nat64,
    'stats' : MinerStats,
    'last_status_change' : IDL.Nat64,
  });
  const MiningInfo = IDL.Record({
    'block_time_target' : IDL.Nat64,
    'current_difficulty' : IDL.Nat32,
    'next_halving_interval' : IDL.Nat64,
    'current_block_reward' : IDL.Nat64,
  });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(SocialLink),
    'Err' : IDL.Text,
  });
  const SupportedStandard = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
  const ConsentPreferences = IDL.Record({ 'language' : IDL.Text });
  const ConsentMessageRequest = IDL.Record({
    'arg' : IDL.Vec(IDL.Nat8),
    'method' : IDL.Text,
    'consent_preferences' : ConsentPreferences,
  });
  const ConsentMessageResponse = IDL.Variant({
    'Ok' : IDL.Record({ 'consent_message' : IDL.Text, 'language' : IDL.Text }),
    'Err' : IDL.Record({
      'error_message' : IDL.Text,
      'error_code' : IDL.Nat32,
    }),
  });
  const TrustedOriginsResponse = IDL.Record({
    'trusted_origins' : IDL.Vec(IDL.Text),
  });
  const DelegationRequest = IDL.Record({
    'delegatee' : IDL.Principal,
    'expiry' : IDL.Nat64,
  });
  const DelegationResponse = IDL.Variant({
    'Ok' : IDL.Record({
      'expiry' : IDL.Nat64,
      'delegation_id' : IDL.Vec(IDL.Nat8),
    }),
    'Err' : IDL.Record({
      'error_message' : IDL.Text,
      'error_code' : IDL.Nat32,
    }),
  });
  const DelegationError = IDL.Variant({
    'InvalidExpiry' : IDL.Record({
      'max' : IDL.Nat64,
      'provided' : IDL.Nat64,
      'current' : IDL.Nat64,
    }),
    'Anonymous' : IDL.Null,
    'SystemError' : IDL.Text,
    'Unauthorized' : IDL.Text,
    'RateLimitExceeded' : IDL.Record({ 'next_allowed' : IDL.Nat64 }),
    'InvalidDelegationId' : IDL.Record({
      'provided' : IDL.Vec(IDL.Nat8),
      'expected' : IDL.Vec(IDL.Nat8),
    }),
  });
  const Result_5 = IDL.Variant({
    'Ok' : DelegationResponse,
    'Err' : DelegationError,
  });
  const SolutionError = IDL.Variant({
    'UnauthorizedMiner' : IDL.Null,
    'VerificationFailed' : IDL.Null,
    'NoBlockToMine' : IDL.Null,
    'DuplicateSolution' : IDL.Null,
    'Other' : IDL.Text,
    'StaleBlock' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const Result_6 = IDL.Variant({ 'Ok' : BlockTemplate, 'Err' : SolutionError });
  return IDL.Service({
    'add_social_link' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'claim_rewards' : IDL.Func([], [Result_1], []),
    'cleanup_expired_delegations' : IDL.Func([], [IDL.Nat64], []),
    'create_genesis_block' : IDL.Func([], [Result_2], []),
    'debug_print_module_hash' : IDL.Func([IDL.Principal], [Result], []),
    'deregister_miner' : IDL.Func([], [Result], []),
    'get_all_info' : IDL.Func([], [AllInfoResult], ['query']),
    'get_auth_status' : IDL.Func([], [IDL.Bool], ['query']),
    'get_average_block_time' : IDL.Func(
        [IDL.Opt(IDL.Nat64)],
        [BlockTimeResult],
        ['query'],
      ),
    'get_block_height' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_block_time_target' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_current_block' : IDL.Func([], [IDL.Opt(BlockTemplate)], ['query']),
    'get_info' : IDL.Func([], [Result_3], ['query']),
    'get_metrics' : IDL.Func([], [MetricsResult], ['query']),
    'get_miner_leaderboard' : IDL.Func(
        [IDL.Opt(IDL.Nat32)],
        [IDL.Vec(MinerInfo)],
        ['query'],
      ),
    'get_miner_stats' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(MinerInfo)],
        ['query'],
      ),
    'get_miners' : IDL.Func([], [IDL.Vec(MinerInfo)], ['query']),
    'get_mining_difficulty' : IDL.Func([], [IDL.Nat32], ['query']),
    'get_mining_info' : IDL.Func([], [MiningInfo], ['query']),
    'get_pending_rewards' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat64))],
        ['query'],
      ),
    'get_social_links' : IDL.Func([], [Result_4], ['query']),
    'icrc10_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(SupportedStandard)],
        ['query'],
      ),
    'icrc1_version' : IDL.Func([], [IDL.Text], ['query']),
    'icrc21_consent_message' : IDL.Func(
        [ConsentMessageRequest],
        [ConsentMessageResponse],
        ['query'],
      ),
    'icrc28_trusted_origins' : IDL.Func(
        [],
        [TrustedOriginsResponse],
        ['query'],
      ),
    'icrc34_delegate' : IDL.Func([DelegationRequest], [Result_5], []),
    'register_miner' : IDL.Func([], [Result], []),
    'remove_social_link' : IDL.Func([IDL.Nat64], [Result], []),
    'start_token' : IDL.Func([], [Result], []),
    'submit_solution' : IDL.Func(
        [IDL.Nat64, IDL.Vec(IDL.Nat8), IDL.Principal],
        [Result_6],
        [],
      ),
    'update_social_link' : IDL.Func(
        [IDL.Nat64, IDL.Text, IDL.Text],
        [Result],
        [],
      ),
    'whoami' : IDL.Func([], [IDL.Principal], ['query']),
  });
};
export const init = ({ IDL }) => {
  const ChainType = IDL.Variant({
    'BTC' : IDL.Null,
    'ICP' : IDL.Null,
    'SOL' : IDL.Null,
    'SUI' : IDL.Null,
  });
  const ArchiveOptions = IDL.Record({
    'num_blocks_to_archive' : IDL.Nat64,
    'max_transactions_per_response' : IDL.Opt(IDL.Nat64),
    'trigger_threshold' : IDL.Nat64,
    'more_controller_ids' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
    'cycles_for_archive_creation' : IDL.Opt(IDL.Nat64),
    'node_max_memory_size_bytes' : IDL.Opt(IDL.Nat64),
    'controller_id' : IDL.Principal,
  });
  const SocialLink = IDL.Record({ 'url' : IDL.Text, 'platform' : IDL.Text });
  const TokenInitArgs = IDL.Record({
    'decimals' : IDL.Opt(IDL.Nat8),
    'initial_block_reward' : IDL.Nat64,
    'ticker' : IDL.Text,
    'block_time_target_seconds' : IDL.Nat64,
    'transfer_fee' : IDL.Opt(IDL.Nat64),
    'chain' : ChainType,
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'archive_options' : IDL.Opt(ArchiveOptions),
    'halving_interval' : IDL.Nat64,
    'total_supply' : IDL.Nat64,
    'social_links' : IDL.Opt(IDL.Vec(SocialLink)),
    'launchpad_id' : IDL.Principal,
  });
  return [TokenInitArgs];
};
