export const idlFactory = ({ IDL }) => {
  const ArchiveInterface__1 = IDL.Rec();
  const Subaccount = IDL.Vec(IDL.Nat8);
  const Balance = IDL.Nat;
  const BurnArgs = IDL.Record({
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(Subaccount),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : Balance,
  });
  const TxIndex = IDL.Nat;
  const Timestamp = IDL.Nat64;
  const TransferError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'BadBurn' : IDL.Record({ 'min_burn_amount' : Balance }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : TxIndex }),
    'BadFee' : IDL.Record({ 'expected_fee' : Balance }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : Timestamp }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : Balance }),
  });
  const TransferResult = IDL.Variant({ 'Ok' : TxIndex, 'Err' : TransferError });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(Subaccount),
  });
  const Burn = IDL.Record({
    'from' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : Balance,
  });
  const Mint__1 = IDL.Record({
    'to' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : Balance,
  });
  const Transfer = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(Balance),
    'from' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : Balance,
  });
  const Transaction = IDL.Record({
    'burn' : IDL.Opt(Burn),
    'kind' : IDL.Text,
    'mint' : IDL.Opt(Mint__1),
    'timestamp' : Timestamp,
    'index' : TxIndex,
    'transfer' : IDL.Opt(Transfer),
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const GetTransactionsRequest__1 = IDL.Record({
    'start' : TxIndex,
    'length' : IDL.Nat,
  });
  const TransactionRange = IDL.Record({
    'transactions' : IDL.Vec(Transaction),
  });
  ArchiveInterface__1.fill(
    IDL.Service({
      'append_transactions' : IDL.Func([IDL.Vec(Transaction)], [Result], []),
      'get_first_tx' : IDL.Func([], [IDL.Nat], ['query']),
      'get_last_tx' : IDL.Func([], [IDL.Nat], ['query']),
      'get_next_archive' : IDL.Func([], [ArchiveInterface__1], ['query']),
      'get_prev_archive' : IDL.Func([], [ArchiveInterface__1], ['query']),
      'get_transaction' : IDL.Func(
          [TxIndex],
          [IDL.Opt(Transaction)],
          ['query'],
        ),
      'get_transactions' : IDL.Func(
          [GetTransactionsRequest__1],
          [TransactionRange],
          ['query'],
        ),
      'max_memory' : IDL.Func([], [IDL.Nat], ['query']),
      'remaining_capacity' : IDL.Func([], [IDL.Nat], ['query']),
      'set_first_tx' : IDL.Func([IDL.Nat], [Result], []),
      'set_last_tx' : IDL.Func([IDL.Nat], [Result], []),
      'set_next_archive' : IDL.Func([ArchiveInterface__1], [Result], []),
      'set_prev_archive' : IDL.Func([ArchiveInterface__1], [Result], []),
      'total_transactions' : IDL.Func([], [IDL.Nat], ['query']),
      'total_used' : IDL.Func([], [IDL.Nat], ['query']),
    })
  );
  const ArchiveInterface = IDL.Service({
    'append_transactions' : IDL.Func([IDL.Vec(Transaction)], [Result], []),
    'get_first_tx' : IDL.Func([], [IDL.Nat], ['query']),
    'get_last_tx' : IDL.Func([], [IDL.Nat], ['query']),
    'get_next_archive' : IDL.Func([], [ArchiveInterface__1], ['query']),
    'get_prev_archive' : IDL.Func([], [ArchiveInterface__1], ['query']),
    'get_transaction' : IDL.Func([TxIndex], [IDL.Opt(Transaction)], ['query']),
    'get_transactions' : IDL.Func(
        [GetTransactionsRequest__1],
        [TransactionRange],
        ['query'],
      ),
    'max_memory' : IDL.Func([], [IDL.Nat], ['query']),
    'remaining_capacity' : IDL.Func([], [IDL.Nat], ['query']),
    'set_first_tx' : IDL.Func([IDL.Nat], [Result], []),
    'set_last_tx' : IDL.Func([IDL.Nat], [Result], []),
    'set_next_archive' : IDL.Func([ArchiveInterface__1], [Result], []),
    'set_prev_archive' : IDL.Func([ArchiveInterface__1], [Result], []),
    'total_transactions' : IDL.Func([], [IDL.Nat], ['query']),
    'total_used' : IDL.Func([], [IDL.Nat], ['query']),
  });
  const TxIndex__1 = IDL.Nat;
  const Transaction__1 = IDL.Record({
    'burn' : IDL.Opt(Burn),
    'kind' : IDL.Text,
    'mint' : IDL.Opt(Mint__1),
    'timestamp' : Timestamp,
    'index' : TxIndex,
    'transfer' : IDL.Opt(Transfer),
  });
  const GetTransactionsRequest = IDL.Record({
    'start' : TxIndex,
    'length' : IDL.Nat,
  });
  const QueryArchiveFn = IDL.Func(
      [GetTransactionsRequest__1],
      [TransactionRange],
      ['query'],
    );
  const ArchivedTransaction = IDL.Record({
    'callback' : QueryArchiveFn,
    'start' : TxIndex,
    'length' : IDL.Nat,
  });
  const GetTransactionsResponse = IDL.Record({
    'first_index' : TxIndex,
    'log_length' : IDL.Nat,
    'transactions' : IDL.Vec(Transaction),
    'archived_transactions' : IDL.Vec(ArchivedTransaction),
  });
  const Account__1 = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(Subaccount),
  });
  const Balance__1 = IDL.Nat;
  const Value = IDL.Variant({
    'Int' : IDL.Int,
    'Nat' : IDL.Nat,
    'Blob' : IDL.Vec(IDL.Nat8),
    'Text' : IDL.Text,
  });
  const MetaDatum = IDL.Tuple(IDL.Text, Value);
  const SupportedStandard = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
  const TransferArgs = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(Balance),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(Subaccount),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : Balance,
  });
  const Mint = IDL.Record({
    'to' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : Balance,
  });
  const SetParameterError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
  });
  const SetNat8ParameterResult = IDL.Variant({
    'Ok' : IDL.Nat8,
    'Err' : SetParameterError,
  });
  const SetBalanceParameterResult = IDL.Variant({
    'Ok' : Balance,
    'Err' : SetParameterError,
  });
  const SetTextParameterResult = IDL.Variant({
    'Ok' : IDL.Text,
    'Err' : SetParameterError,
  });
  const SetAccountParameterResult = IDL.Variant({
    'Ok' : Account,
    'Err' : SetParameterError,
  });
  return IDL.Service({
    'burn' : IDL.Func([BurnArgs], [TransferResult], []),
    'deposit_cycles' : IDL.Func([], [], []),
    'get_archive' : IDL.Func([], [ArchiveInterface], ['query']),
    'get_archive_stored_txs' : IDL.Func([], [IDL.Nat], ['query']),
    'get_total_tx' : IDL.Func([], [IDL.Nat], ['query']),
    'get_transaction' : IDL.Func([TxIndex__1], [IDL.Opt(Transaction__1)], []),
    'get_transactions' : IDL.Func(
        [GetTransactionsRequest],
        [GetTransactionsResponse],
        ['query'],
      ),
    'icrc1_balance_of' : IDL.Func([Account__1], [Balance__1], ['query']),
    'icrc1_decimals' : IDL.Func([], [IDL.Nat8], ['query']),
    'icrc1_fee' : IDL.Func([], [Balance__1], ['query']),
    'icrc1_metadata' : IDL.Func([], [IDL.Vec(MetaDatum)], ['query']),
    'icrc1_minting_account' : IDL.Func([], [IDL.Opt(Account__1)], ['query']),
    'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(SupportedStandard)],
        ['query'],
      ),
    'icrc1_symbol' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_total_supply' : IDL.Func([], [Balance__1], ['query']),
    'icrc1_transfer' : IDL.Func([TransferArgs], [TransferResult], []),
    'min_burn_amount' : IDL.Func([], [Balance__1], ['query']),
    'mint' : IDL.Func([Mint], [TransferResult], []),
    'set_decimals' : IDL.Func([IDL.Nat8], [SetNat8ParameterResult], []),
    'set_fee' : IDL.Func([Balance__1], [SetBalanceParameterResult], []),
    'set_logo' : IDL.Func([IDL.Text], [SetTextParameterResult], []),
    'set_min_burn_amount' : IDL.Func(
        [Balance__1],
        [SetBalanceParameterResult],
        [],
      ),
    'set_minting_account' : IDL.Func(
        [IDL.Text],
        [SetAccountParameterResult],
        [],
      ),
    'set_name' : IDL.Func([IDL.Text], [SetTextParameterResult], []),
    'set_symbol' : IDL.Func([IDL.Text], [SetTextParameterResult], []),
  });
};
export const init = ({ IDL }) => { return []; };
