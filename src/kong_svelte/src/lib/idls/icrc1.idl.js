export const ICRC1_IDL =({ IDL }) => {
    const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
    const Duration = IDL.Record({ 'secs' : IDL.Nat64, 'nanos' : IDL.Nat32 });
    const Account = IDL.Record({
      'owner' : IDL.Principal,
      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    });
    const ArchiveOptions = IDL.Record({
      'num_blocks_to_archive' : IDL.Nat64,
      'max_transactions_per_response' : IDL.Opt(IDL.Nat64),
      'trigger_threshold' : IDL.Nat64,
      'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
      'cycles_for_archive_creation' : IDL.Opt(IDL.Nat64),
      'node_max_memory_size_bytes' : IDL.Opt(IDL.Nat64),
      'controller_id' : IDL.Principal,
    });
    const LedgerCanisterInitPayload = IDL.Record({
      'send_whitelist' : IDL.Vec(IDL.Principal),
      'token_symbol' : IDL.Opt(IDL.Text),
      'transfer_fee' : IDL.Opt(Tokens),
      'minting_account' : IDL.Text,
      'transaction_window' : IDL.Opt(Duration),
      'max_message_size_bytes' : IDL.Opt(IDL.Nat64),
      'icrc1_minting_account' : IDL.Opt(Account),
      'archive_options' : IDL.Opt(ArchiveOptions),
      'initial_values' : IDL.Vec(IDL.Tuple(IDL.Text, Tokens)),
      'token_name' : IDL.Opt(IDL.Text),
    });
    const BinaryAccountBalanceArgs = IDL.Record({
      'account' : IDL.Vec(IDL.Nat8),
    });
    const AccountBalanceArgs = IDL.Record({ 'account' : IDL.Text });
    const ArchiveInfo = IDL.Record({ 'canister_id' : IDL.Principal });
    const Archives = IDL.Record({ 'archives' : IDL.Vec(ArchiveInfo) });
    const Decimals = IDL.Record({ 'decimals' : IDL.Nat32 });
    const MetadataValue = IDL.Variant({
      'Int' : IDL.Int,
      'Nat' : IDL.Nat,
      'Blob' : IDL.Vec(IDL.Nat8),
      'Text' : IDL.Text,
    });
    const StandardRecord = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
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
    const Name = IDL.Record({ 'name' : IDL.Text });
    const GetBlocksArgs = IDL.Record({
      'start' : IDL.Nat64,
      'length' : IDL.Nat64,
    });
    const TimeStamp = IDL.Record({ 'timestamp_nanos' : IDL.Nat64 });
    const CandidOperation = IDL.Variant({
      'Approve' : IDL.Record({
        'fee' : Tokens,
        'from' : IDL.Vec(IDL.Nat8),
        'allowance_e8s' : IDL.Int,
        'expires_at' : IDL.Opt(TimeStamp),
        'spender' : IDL.Vec(IDL.Nat8),
      }),
      'Burn' : IDL.Record({ 'from' : IDL.Vec(IDL.Nat8), 'amount' : Tokens }),
      'Mint' : IDL.Record({ 'to' : IDL.Vec(IDL.Nat8), 'amount' : Tokens }),
      'Transfer' : IDL.Record({
        'to' : IDL.Vec(IDL.Nat8),
        'fee' : Tokens,
        'from' : IDL.Vec(IDL.Nat8),
        'amount' : Tokens,
      }),
      'TransferFrom' : IDL.Record({
        'to' : IDL.Vec(IDL.Nat8),
        'fee' : Tokens,
        'from' : IDL.Vec(IDL.Nat8),
        'amount' : Tokens,
        'spender' : IDL.Vec(IDL.Nat8),
      }),
    });
    const CandidTransaction = IDL.Record({
      'memo' : IDL.Nat64,
      'icrc1_memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
      'operation' : IDL.Opt(CandidOperation),
      'created_at_time' : TimeStamp,
    });
    const CandidBlock = IDL.Record({
      'transaction' : CandidTransaction,
      'timestamp' : TimeStamp,
      'parent_hash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    });
    const BlockRange = IDL.Record({ 'blocks' : IDL.Vec(CandidBlock) });
    const GetBlocksError = IDL.Variant({
      'BadFirstBlockIndex' : IDL.Record({
        'requested_index' : IDL.Nat64,
        'first_valid_index' : IDL.Nat64,
      }),
      'Other' : IDL.Record({
        'error_message' : IDL.Text,
        'error_code' : IDL.Nat64,
      }),
    });
    const ArchivedBlocksRange = IDL.Record({
      'callback' : IDL.Func(
          [GetBlocksArgs],
          [IDL.Variant({ 'Ok' : BlockRange, 'Err' : GetBlocksError })],
          ['query'],
        ),
      'start' : IDL.Nat64,
      'length' : IDL.Nat64,
    });
    const QueryBlocksResponse = IDL.Record({
      'certificate' : IDL.Opt(IDL.Vec(IDL.Nat8)),
      'blocks' : IDL.Vec(CandidBlock),
      'chain_length' : IDL.Nat64,
      'first_block_index' : IDL.Nat64,
      'archived_blocks' : IDL.Vec(ArchivedBlocksRange),
    });
    const SendArgs = IDL.Record({
      'to' : IDL.Text,
      'fee' : Tokens,
      'memo' : IDL.Nat64,
      'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
      'created_at_time' : IDL.Opt(TimeStamp),
      'amount' : Tokens,
    });
    const Symbol = IDL.Record({ 'symbol' : IDL.Text });
    const TransferArgs = IDL.Record({
      'to' : IDL.Vec(IDL.Nat8),
      'fee' : Tokens,
      'memo' : IDL.Nat64,
      'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
      'created_at_time' : IDL.Opt(TimeStamp),
      'amount' : Tokens,
    });
    const TransferError_1 = IDL.Variant({
      'TxTooOld' : IDL.Record({ 'allowed_window_nanos' : IDL.Nat64 }),
      'BadFee' : IDL.Record({ 'expected_fee' : Tokens }),
      'TxDuplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat64 }),
      'TxCreatedInFuture' : IDL.Null,
      'InsufficientFunds' : IDL.Record({ 'balance' : Tokens }),
    });
    const Result_1 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : TransferError_1 });
    const TransferFee = IDL.Record({ 'transfer_fee' : Tokens });
    return IDL.Service({
      'account_balance' : IDL.Func(
          [BinaryAccountBalanceArgs],
          [Tokens],
          ['query'],
        ),
      'account_balance_dfx' : IDL.Func([AccountBalanceArgs], [Tokens], ['query']),
      'archives' : IDL.Func([], [Archives], ['query']),
      'decimals' : IDL.Func([], [Decimals], ['query']),
      'icrc1_balance_of' : IDL.Func([Account], [IDL.Nat], ['query']),
      'icrc1_decimals' : IDL.Func([], [IDL.Nat8], ['query']),
      'icrc1_fee' : IDL.Func([], [IDL.Nat], ['query']),
      'icrc1_metadata' : IDL.Func(
          [],
          [IDL.Vec(IDL.Tuple(IDL.Text, MetadataValue))],
          ['query'],
        ),
      'icrc1_minting_account' : IDL.Func([], [IDL.Opt(Account)], ['query']),
      'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
      'icrc1_supported_standards' : IDL.Func(
          [],
          [IDL.Vec(StandardRecord)],
          ['query'],
        ),
      'icrc1_symbol' : IDL.Func([], [IDL.Text], ['query']),
      'icrc1_total_supply' : IDL.Func([], [IDL.Nat], ['query']),
      'icrc1_transfer' : IDL.Func([TransferArg], [Result], []),
      'name' : IDL.Func([], [Name], ['query']),
      'query_blocks' : IDL.Func(
          [GetBlocksArgs],
          [QueryBlocksResponse],
          ['query'],
        ),
      'send_dfx' : IDL.Func([SendArgs], [IDL.Nat64], []),
      'symbol' : IDL.Func([], [Symbol], ['query']),
      'transfer' : IDL.Func([TransferArgs], [Result_1], []),
      'transfer_fee' : IDL.Func([IDL.Record({})], [TransferFee], ['query']),
    });
};
