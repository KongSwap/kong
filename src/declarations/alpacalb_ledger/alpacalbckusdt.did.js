export const idlFactory = ({ IDL }) => {
  const Result_1 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : IDL.Text });
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
  const TxIndex__1 = IDL.Nat;
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
  const Mint = IDL.Record({
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
  const Transaction__1 = IDL.Record({
    'burn' : IDL.Opt(Burn),
    'kind' : IDL.Text,
    'mint' : IDL.Opt(Mint),
    'timestamp' : Timestamp,
    'index' : TxIndex,
    'transfer' : IDL.Opt(Transfer),
  });
  const GetTransactionsRequest = IDL.Record({
    'start' : TxIndex,
    'length' : IDL.Nat,
  });
  const Transaction = IDL.Record({
    'burn' : IDL.Opt(Burn),
    'kind' : IDL.Text,
    'mint' : IDL.Opt(Mint),
    'timestamp' : Timestamp,
    'index' : TxIndex,
    'transfer' : IDL.Opt(Transfer),
  });
  const GetTransactionsRequest__1 = IDL.Record({
    'start' : TxIndex,
    'length' : IDL.Nat,
  });
  const TransactionRange = IDL.Record({
    'transactions' : IDL.Vec(Transaction),
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
  const MintArgs = IDL.Record({
    'min_tx_amount' : IDL.Nat,
    'exchange_ratio' : IDL.Float64,
    'max_mint_amount_per_address' : IDL.Nat,
    'mint_memo' : IDL.Text,
  });
  const MintConfigResponse = IDL.Record({
    'mint_token_ledger_id' : IDL.Principal,
    'min_tx_amount' : IDL.Nat,
    'exchange_ratio' : IDL.Float64,
    'max_mint_amount_per_address' : IDL.Nat,
    'mint_token_gov_id' : IDL.Principal,
    'memo' : IDL.Text,
  });
  const MintStateResponse = IDL.Record({
    'valid_addresses' : IDL.Nat,
    'end_of_distribute' : IDL.Bool,
    'valid_mint_amount' : IDL.Nat,
    'latest_sync_tx_id' : IDL.Nat,
    'end_of_sync' : IDL.Bool,
    'valid_transactions' : IDL.Nat,
  });
  const UserBalanceResponse = IDL.Record({
    'account_id' : IDL.Text,
    'principal' : IDL.Opt(IDL.Principal),
    'distributed_amount' : IDL.Nat,
    'mint_amount' : IDL.Nat,
  });
  const Page = IDL.Record({
    'content' : IDL.Vec(UserBalanceResponse),
    'offset' : IDL.Nat,
    'limit' : IDL.Nat,
    'totalElements' : IDL.Nat,
  });
  const Result = IDL.Variant({ 'ok' : Page, 'err' : IDL.Text });
  return IDL.Service({
    'add_controller' : IDL.Func([IDL.Principal, IDL.Principal], [Result_1], []),
    'archive_id' : IDL.Func([], [IDL.Principal], ['query']),
    'burn' : IDL.Func([BurnArgs], [TransferResult], []),
    'deposit_cycles' : IDL.Func([], [], []),
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
    'init' : IDL.Func(
        [
          IDL.Opt(MintArgs),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Principal),
          IDL.Opt(IDL.Principal),
          IDL.Opt(IDL.Nat),
        ],
        [],
        [],
      ),
    'query_cycle_balance' : IDL.Func([], [IDL.Nat], []),
    'query_mint_config' : IDL.Func([], [MintConfigResponse], ['query']),
    'query_mint_statistics' : IDL.Func([], [MintStateResponse], ['query']),
    'query_user_valid_balance' : IDL.Func(
        [IDL.Principal],
        [IDL.Nat],
        ['query'],
      ),
    'query_users_valid_balance' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [Result],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
