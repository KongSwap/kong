export const idlFactory = ({ IDL }) => {
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const FeatureFlags = IDL.Record({ 'icrc2' : IDL.Bool });
  const UpgradeArgs = IDL.Record({
    'icrc1_minting_account' : IDL.Opt(Account),
    'feature_flags' : IDL.Opt(FeatureFlags),
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const Duration = IDL.Record({ 'secs' : IDL.Nat64, 'nanos' : IDL.Nat32 });
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
  const InitArgs = IDL.Record({
    'send_whitelist' : IDL.Vec(IDL.Principal),
    'token_symbol' : IDL.Opt(IDL.Text),
    'transfer_fee' : IDL.Opt(Tokens),
    'minting_account' : IDL.Text,
    'maximum_number_of_accounts' : IDL.Opt(IDL.Nat64),
    'accounts_overflow_trim_quantity' : IDL.Opt(IDL.Nat64),
    'transaction_window' : IDL.Opt(Duration),
    'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
    'icrc1_minting_account' : IDL.Opt(Account),
    'archive_options' : IDL.Opt(ArchiveOptions),
    'initial_values' : IDL.Vec(IDL.Tuple(IDL.Text, Tokens)),
    'token_name' : IDL.Opt(IDL.Text),
    'feature_flags' : IDL.Opt(FeatureFlags),
  });
  const LedgerCanisterPayload = IDL.Variant({
    'Upgrade' : IDL.Opt(UpgradeArgs),
    'Init' : InitArgs,
  });
  const BinaryAccountBalanceArgs = IDL.Record({
    'account' : IDL.Vec(IDL.Nat8),
  });
  const AccountBalanceArgs = IDL.Record({ 'account' : IDL.Text });
  const ArchiveInfo = IDL.Record({ 'canister_id' : IDL.Principal });
  const Archives = IDL.Record({ 'archives' : IDL.Vec(ArchiveInfo) });
  const Decimals = IDL.Record({ 'decimals' : IDL.Nat32 });
  const StandardRecord = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
  const MetadataValue = IDL.Variant({
    'Int' : IDL.Int,
    'Nat' : IDL.Nat,
    'Blob' : IDL.Vec(IDL.Nat8),
    'Text' : IDL.Text,
  });
  const TransferArg = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(IDL.Nat),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
  });
  const TransferError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : TransferError });

  return IDL.Service({
    'account_balance' : IDL.Func(
        [BinaryAccountBalanceArgs],
        [Tokens],
        ['query'],
      ),
    'account_balance_dfx' : IDL.Func([AccountBalanceArgs], [Tokens], ['query']),
    'icrc1_balance_of' : IDL.Func([Account], [IDL.Nat], ['query']),
    'icrc1_decimals' : IDL.Func([], [IDL.Nat8], ['query']),
    'icrc1_fee' : IDL.Func([], [IDL.Nat], ['query']),
    'icrc1_metadata' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, MetadataValue))],
        ['query'],
      ),
    'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_symbol' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_total_supply' : IDL.Func([], [IDL.Nat], ['query']),
    'icrc1_transfer' : IDL.Func([TransferArg], [Result], []),
  });
};
export const init = ({ IDL }) => {
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const FeatureFlags = IDL.Record({ 'icrc2' : IDL.Bool });
  const UpgradeArgs = IDL.Record({
    'icrc1_minting_account' : IDL.Opt(Account),
    'feature_flags' : IDL.Opt(FeatureFlags),
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const Duration = IDL.Record({ 'secs' : IDL.Nat64, 'nanos' : IDL.Nat32 });
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
  const InitArgs = IDL.Record({
    'send_whitelist' : IDL.Vec(IDL.Principal),
    'token_symbol' : IDL.Opt(IDL.Text),
    'transfer_fee' : IDL.Opt(Tokens),
    'minting_account' : IDL.Text,
    'maximum_number_of_accounts' : IDL.Opt(IDL.Nat64),
    'accounts_overflow_trim_quantity' : IDL.Opt(IDL.Nat64),
    'transaction_window' : IDL.Opt(Duration),
    'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
    'icrc1_minting_account' : IDL.Opt(Account),
    'archive_options' : IDL.Opt(ArchiveOptions),
    'initial_values' : IDL.Vec(IDL.Tuple(IDL.Text, Tokens)),
    'token_name' : IDL.Opt(IDL.Text),
    'feature_flags' : IDL.Opt(FeatureFlags),
  });
  const LedgerCanisterPayload = IDL.Variant({
    'Upgrade' : IDL.Opt(UpgradeArgs),
    'Init' : InitArgs,
  });
  return [LedgerCanisterPayload];
};