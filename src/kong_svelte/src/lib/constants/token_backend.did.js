export const idlFactory = ({ IDL }) => {
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
  const TokenInitArgs = IDL.Record({
    'decimals' : IDL.Opt(IDL.Nat8),
    'initial_block_reward' : IDL.Nat64,
    'ticker' : IDL.Text,
    'block_time_target_seconds' : IDL.Nat64,
    'transfer_fee' : IDL.Opt(IDL.Nat64),
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'archive_options' : IDL.Opt(ArchiveOptions),
    'halving_interval' : IDL.Nat64,
    'total_supply' : IDL.Nat64,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Principal, 'Err' : IDL.Text });
  const TokenInfo = IDL.Record({
    'decimals' : IDL.Nat8,
    'ticker' : IDL.Text,
    'transfer_fee' : IDL.Nat64,
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'ledger_id' : IDL.Opt(IDL.Principal),
    'archive_options' : IDL.Opt(ArchiveOptions),
    'total_supply' : IDL.Nat64,
  });
  const Result_2 = IDL.Variant({ 'Ok' : TokenInfo, 'Err' : IDL.Text });

  return IDL.Service({
    'get_info' : IDL.Func([], [Result_2], ['query']),
    'register_miner' : IDL.Func([], [Result], []),
    'deregister_miner' : IDL.Func([], [Result], []),
    'start_token' : IDL.Func([], [Result_5], []),
  });
};
export const init = ({ IDL }) => {
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
  const TokenInitArgs = IDL.Record({
    'decimals' : IDL.Opt(IDL.Nat8),
    'initial_block_reward' : IDL.Nat64,
    'ticker' : IDL.Text,
    'block_time_target_seconds' : IDL.Nat64,
    'transfer_fee' : IDL.Opt(IDL.Nat64),
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'archive_options' : IDL.Opt(ArchiveOptions),
    'halving_interval' : IDL.Nat64,
    'total_supply' : IDL.Nat64,
  });
  return [TokenInitArgs];
};