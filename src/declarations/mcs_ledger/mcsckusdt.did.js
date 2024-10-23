export const idlFactory = ({ IDL }) => {
  const TxReceipt = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : IDL.Variant({
      'InsufficientAllowance' : IDL.Null,
      'InsufficientBalance' : IDL.Null,
      'ErrorOperationStyle' : IDL.Null,
      'Unauthorized' : IDL.Null,
      'LedgerTrap' : IDL.Null,
      'ErrorTo' : IDL.Null,
      'Other' : IDL.Text,
      'BlockUsed' : IDL.Null,
      'AmountTooSmall' : IDL.Null,
    }),
  });
  const Config__2 = IDL.Record({
    'MAX_STORAGE_TRIES' : IDL.Opt(IDL.Nat),
    'EN_DEBUG' : IDL.Opt(IDL.Bool),
    'MAX_CACHE_NUMBER_PER' : IDL.Opt(IDL.Nat),
    'MAX_CACHE_TIME' : IDL.Opt(IDL.Nat),
  });
  const Address__3 = IDL.Text;
  const Gas__2 = IDL.Variant({
    'token' : IDL.Nat,
    'cycles' : IDL.Nat,
    'noFee' : IDL.Null,
  });
  const AccountId__2 = IDL.Vec(IDL.Nat8);
  const Time__2 = IDL.Int;
  const Txid__3 = IDL.Vec(IDL.Nat8);
  const Operation__1 = IDL.Variant({
    'approve' : IDL.Record({ 'allowance' : IDL.Nat }),
    'lockTransfer' : IDL.Record({
      'locked' : IDL.Nat,
      'expiration' : Time__2,
      'decider' : AccountId__2,
    }),
    'transfer' : IDL.Record({
      'action' : IDL.Variant({
        'burn' : IDL.Null,
        'mint' : IDL.Null,
        'send' : IDL.Null,
      }),
    }),
    'executeTransfer' : IDL.Record({
      'fallback' : IDL.Nat,
      'lockedTxid' : Txid__3,
    }),
  });
  const Transaction__1 = IDL.Record({
    'to' : AccountId__2,
    'value' : IDL.Nat,
    'data' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from' : AccountId__2,
    'operation' : Operation__1,
  });
  const TxnRecord__2 = IDL.Record({
    'gas' : Gas__2,
    'msgCaller' : IDL.Opt(IDL.Principal),
    'transaction' : Transaction__1,
    'txid' : Txid__3,
    'nonce' : IDL.Nat,
    'timestamp' : Time__2,
    'caller' : AccountId__2,
    'index' : IDL.Nat,
  });
  const Time = IDL.Int;
  const Setting__1 = IDL.Record({
    'MAX_STORAGE_TRIES' : IDL.Nat,
    'EN_DEBUG' : IDL.Bool,
    'MAX_CACHE_NUMBER_PER' : IDL.Nat,
    'MAX_CACHE_TIME' : IDL.Nat,
  });
  const Txid__2 = IDL.Vec(IDL.Nat8);
  const DRC207Support = IDL.Record({
    'timer' : IDL.Record({
      'interval_seconds' : IDL.Opt(IDL.Nat),
      'enable' : IDL.Bool,
    }),
    'monitorable_by_self' : IDL.Bool,
    'monitorable_by_blackhole' : IDL.Record({
      'canister_id' : IDL.Opt(IDL.Principal),
      'allowed' : IDL.Bool,
    }),
    'cycles_receivable' : IDL.Bool,
  });
  const Address__1 = IDL.Text;
  const Spender = IDL.Text;
  const Amount = IDL.Nat;
  const AccountId__1 = IDL.Vec(IDL.Nat8);
  const Allowance = IDL.Record({
    'remaining' : IDL.Nat,
    'spender' : AccountId__1,
  });
  const Nonce = IDL.Nat;
  const Sa = IDL.Vec(IDL.Nat8);
  const Data = IDL.Vec(IDL.Nat8);
  const Txid__1 = IDL.Vec(IDL.Nat8);
  const TxnResult = IDL.Variant({
    'ok' : Txid__1,
    'err' : IDL.Record({
      'code' : IDL.Variant({
        'NonceError' : IDL.Null,
        'InsufficientGas' : IDL.Null,
        'InsufficientAllowance' : IDL.Null,
        'UndefinedError' : IDL.Null,
        'InsufficientBalance' : IDL.Null,
        'NoLockedTransfer' : IDL.Null,
        'DuplicateExecutedTransfer' : IDL.Null,
        'LockedTransferExpired' : IDL.Null,
      }),
      'message' : IDL.Text,
    }),
  });
  const Txid = IDL.Vec(IDL.Nat8);
  const ExecuteType = IDL.Variant({
    'fallback' : IDL.Null,
    'send' : IDL.Nat,
    'sendAll' : IDL.Null,
  });
  const To = IDL.Text;
  const Gas__1 = IDL.Variant({
    'token' : IDL.Nat,
    'cycles' : IDL.Nat,
    'noFee' : IDL.Null,
  });
  const CoinSeconds = IDL.Record({
    'updateTime' : IDL.Int,
    'coinSeconds' : IDL.Nat,
  });
  const Timeout = IDL.Nat32;
  const Decider = IDL.Text;
  const From = IDL.Text;
  const Metadata__1 = IDL.Record({ 'content' : IDL.Text, 'name' : IDL.Text });
  const Gas = IDL.Variant({
    'token' : IDL.Nat,
    'cycles' : IDL.Nat,
    'noFee' : IDL.Null,
  });
  const Time__1 = IDL.Int;
  const Operation = IDL.Variant({
    'approve' : IDL.Record({ 'allowance' : IDL.Nat }),
    'lockTransfer' : IDL.Record({
      'locked' : IDL.Nat,
      'expiration' : Time__1,
      'decider' : AccountId__1,
    }),
    'transfer' : IDL.Record({
      'action' : IDL.Variant({
        'burn' : IDL.Null,
        'mint' : IDL.Null,
        'send' : IDL.Null,
      }),
    }),
    'executeTransfer' : IDL.Record({
      'fallback' : IDL.Nat,
      'lockedTxid' : Txid__1,
    }),
  });
  const Transaction = IDL.Record({
    'to' : AccountId__1,
    'value' : IDL.Nat,
    'data' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from' : AccountId__1,
    'operation' : Operation,
  });
  const TxnRecord__1 = IDL.Record({
    'gas' : Gas,
    'msgCaller' : IDL.Opt(IDL.Principal),
    'transaction' : Transaction,
    'txid' : Txid__1,
    'nonce' : IDL.Nat,
    'timestamp' : Time__1,
    'caller' : AccountId__1,
    'index' : IDL.Nat,
  });
  const Callback__1 = IDL.Func([TxnRecord__1], [], []);
  const MsgType__1 = IDL.Variant({
    'onApprove' : IDL.Null,
    'onExecute' : IDL.Null,
    'onTransfer' : IDL.Null,
    'onLock' : IDL.Null,
  });
  const Callback = IDL.Func([TxnRecord__1], [], []);
  const MsgType = IDL.Variant({
    'onApprove' : IDL.Null,
    'onExecute' : IDL.Null,
    'onTransfer' : IDL.Null,
    'onLock' : IDL.Null,
  });
  const Subscription = IDL.Record({
    'callback' : Callback,
    'msgTypes' : IDL.Vec(MsgType),
  });
  const Address = IDL.Text;
  const TxnQueryRequest = IDL.Variant({
    'getEvents' : IDL.Record({ 'owner' : IDL.Opt(Address) }),
    'txnCount' : IDL.Record({ 'owner' : Address }),
    'lockedTxns' : IDL.Record({ 'owner' : Address }),
    'lastTxids' : IDL.Record({ 'owner' : Address }),
    'lastTxidsGlobal' : IDL.Null,
    'getTxn' : IDL.Record({ 'txid' : Txid__1 }),
    'txnCountGlobal' : IDL.Null,
  });
  const TxnQueryResponse = IDL.Variant({
    'getEvents' : IDL.Vec(TxnRecord__1),
    'txnCount' : IDL.Nat,
    'lockedTxns' : IDL.Record({
      'txns' : IDL.Vec(TxnRecord__1),
      'lockedBalance' : IDL.Nat,
    }),
    'lastTxids' : IDL.Vec(Txid__1),
    'lastTxidsGlobal' : IDL.Vec(Txid__1),
    'getTxn' : IDL.Opt(TxnRecord__1),
    'txnCountGlobal' : IDL.Nat,
  });
  const TxnRecord = IDL.Record({
    'gas' : Gas,
    'msgCaller' : IDL.Opt(IDL.Principal),
    'transaction' : Transaction,
    'txid' : Txid__1,
    'nonce' : IDL.Nat,
    'timestamp' : Time__1,
    'caller' : AccountId__1,
    'index' : IDL.Nat,
  });
  const Metadata__2 = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'owner' : IDL.Principal,
    'logo' : IDL.Text,
    'name' : IDL.Text,
    'totalSupply' : IDL.Nat,
    'symbol' : IDL.Text,
  });
  const TokenInfo = IDL.Record({
    'holderNumber' : IDL.Nat,
    'deployTime' : Time,
    'metadata' : Metadata__2,
    'historySize' : IDL.Nat,
    'cycles' : IDL.Nat,
    'feeTo' : IDL.Principal,
  });
  const Config__1 = IDL.Record({ 'MAX_PUBLICATION_TRIES' : IDL.Opt(IDL.Nat) });
  const Setting = IDL.Record({ 'MAX_PUBLICATION_TRIES' : IDL.Nat });
  const Subaccount = IDL.Vec(IDL.Nat8);
  const Account__1 = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(Subaccount),
  });
  const Value = IDL.Variant({
    'Int' : IDL.Int,
    'Nat' : IDL.Nat,
    'Blob' : IDL.Vec(IDL.Nat8),
    'Text' : IDL.Text,
  });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(Subaccount),
  });
  const Timestamp = IDL.Nat64;
  const TransferArgs = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(IDL.Nat),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(Subaccount),
    'created_at_time' : IDL.Opt(Timestamp),
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
  const AllowanceArgs = IDL.Record({
    'account' : Account,
    'spender' : Account,
  });
  const ApproveArgs = IDL.Record({
    'fee' : IDL.Opt(IDL.Nat),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
    'expected_allowance' : IDL.Opt(IDL.Nat),
    'expires_at' : IDL.Opt(IDL.Nat64),
    'spender' : Account,
  });
  const ApproveError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'AllowanceChanged' : IDL.Record({ 'current_allowance' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'TooOld' : IDL.Null,
    'Expired' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const TransferFromArgs = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(IDL.Nat),
    'spender_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
  });
  const TransferFromError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'InsufficientAllowance' : IDL.Record({ 'allowance' : IDL.Nat }),
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const Address__2 = IDL.Text;
  const Config = IDL.Record({ 'feeTo' : IDL.Opt(Address__2) });
  const AccountId = IDL.Vec(IDL.Nat8);
  return IDL.Service({
    'allowance' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [IDL.Nat],
        ['query'],
      ),
    'approve' : IDL.Func([IDL.Principal, IDL.Nat], [TxReceipt], []),
    'balanceOf' : IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
    'decimals' : IDL.Func([], [IDL.Nat8], ['query']),
    'drc202_canisterId' : IDL.Func([], [IDL.Principal], ['query']),
    'drc202_config' : IDL.Func([Config__2], [IDL.Bool], []),
    'drc202_events' : IDL.Func(
        [IDL.Opt(Address__3)],
        [IDL.Vec(TxnRecord__2)],
        ['query'],
      ),
    'drc202_events_filter' : IDL.Func(
        [IDL.Opt(Address__3), IDL.Opt(Time), IDL.Opt(Time)],
        [IDL.Vec(TxnRecord__2), IDL.Bool],
        ['query'],
      ),
    'drc202_getConfig' : IDL.Func([], [Setting__1], ['query']),
    'drc202_pool' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(Txid__2, IDL.Nat))],
        ['query'],
      ),
    'drc202_txn' : IDL.Func([Txid__2], [IDL.Opt(TxnRecord__2)], ['query']),
    'drc202_txn2' : IDL.Func([Txid__2], [IDL.Opt(TxnRecord__2)], []),
    'drc207' : IDL.Func([], [DRC207Support], ['query']),
    'drc20_allowance' : IDL.Func([Address__1, Spender], [Amount], ['query']),
    'drc20_approvals' : IDL.Func([Address__1], [IDL.Vec(Allowance)], ['query']),
    'drc20_approve' : IDL.Func(
        [Spender, Amount, IDL.Opt(Nonce), IDL.Opt(Sa), IDL.Opt(Data)],
        [TxnResult],
        [],
      ),
    'drc20_balanceOf' : IDL.Func([Address__1], [Amount], ['query']),
    'drc20_decimals' : IDL.Func([], [IDL.Nat8], ['query']),
    'drc20_dropAccount' : IDL.Func([IDL.Opt(Sa)], [IDL.Bool], []),
    'drc20_executeTransfer' : IDL.Func(
        [
          Txid,
          ExecuteType,
          IDL.Opt(To),
          IDL.Opt(Nonce),
          IDL.Opt(Sa),
          IDL.Opt(Data),
        ],
        [TxnResult],
        [],
      ),
    'drc20_fee' : IDL.Func([], [Amount], ['query']),
    'drc20_gas' : IDL.Func([], [Gas__1], ['query']),
    'drc20_getCoinSeconds' : IDL.Func(
        [IDL.Opt(Address__1)],
        [CoinSeconds, IDL.Opt(CoinSeconds)],
        ['query'],
      ),
    'drc20_holdersCount' : IDL.Func([], [IDL.Nat, IDL.Nat, IDL.Nat], ['query']),
    'drc20_lockTransfer' : IDL.Func(
        [
          To,
          Amount,
          Timeout,
          IDL.Opt(Decider),
          IDL.Opt(Nonce),
          IDL.Opt(Sa),
          IDL.Opt(Data),
        ],
        [TxnResult],
        [],
      ),
    'drc20_lockTransferFrom' : IDL.Func(
        [
          From,
          To,
          Amount,
          Timeout,
          IDL.Opt(Decider),
          IDL.Opt(Nonce),
          IDL.Opt(Sa),
          IDL.Opt(Data),
        ],
        [TxnResult],
        [],
      ),
    'drc20_metadata' : IDL.Func([], [IDL.Vec(Metadata__1)], ['query']),
    'drc20_name' : IDL.Func([], [IDL.Text], ['query']),
    'drc20_subscribe' : IDL.Func(
        [Callback__1, IDL.Vec(MsgType__1), IDL.Opt(Sa)],
        [IDL.Bool],
        [],
      ),
    'drc20_subscribed' : IDL.Func(
        [Address__1],
        [IDL.Opt(Subscription)],
        ['query'],
      ),
    'drc20_symbol' : IDL.Func([], [IDL.Text], ['query']),
    'drc20_totalSupply' : IDL.Func([], [Amount], ['query']),
    'drc20_transfer' : IDL.Func(
        [To, Amount, IDL.Opt(Nonce), IDL.Opt(Sa), IDL.Opt(Data)],
        [TxnResult],
        [],
      ),
    'drc20_transferBatch' : IDL.Func(
        [
          IDL.Vec(To),
          IDL.Vec(Amount),
          IDL.Opt(Nonce),
          IDL.Opt(Sa),
          IDL.Opt(Data),
        ],
        [IDL.Vec(TxnResult)],
        [],
      ),
    'drc20_transferFrom' : IDL.Func(
        [From, To, Amount, IDL.Opt(Nonce), IDL.Opt(Sa), IDL.Opt(Data)],
        [TxnResult],
        [],
      ),
    'drc20_txnQuery' : IDL.Func(
        [TxnQueryRequest],
        [TxnQueryResponse],
        ['query'],
      ),
    'drc20_txnRecord' : IDL.Func([Txid], [IDL.Opt(TxnRecord)], []),
    'getMetadata' : IDL.Func([], [Metadata__2], ['query']),
    'getTokenFee' : IDL.Func([], [IDL.Nat], ['query']),
    'getTokenInfo' : IDL.Func([], [TokenInfo], ['query']),
    'historySize' : IDL.Func([], [IDL.Nat], ['query']),
    'icpubsub_config' : IDL.Func([Config__1], [IDL.Bool], []),
    'icpubsub_getConfig' : IDL.Func([], [Setting], ['query']),
    'icrc1_balance_of' : IDL.Func([Account__1], [IDL.Nat], ['query']),
    'icrc1_decimals' : IDL.Func([], [IDL.Nat8], ['query']),
    'icrc1_fee' : IDL.Func([], [IDL.Nat], ['query']),
    'icrc1_metadata' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, Value))],
        ['query'],
      ),
    'icrc1_minting_account' : IDL.Func([], [IDL.Opt(Account__1)], ['query']),
    'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text }))],
        ['query'],
      ),
    'icrc1_symbol' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_total_supply' : IDL.Func([], [IDL.Nat], ['query']),
    'icrc1_transfer' : IDL.Func(
        [TransferArgs],
        [IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : TransferError })],
        [],
      ),
    'icrc2_allowance' : IDL.Func(
        [AllowanceArgs],
        [
          IDL.Record({
            'allowance' : IDL.Nat,
            'expires_at' : IDL.Opt(IDL.Nat64),
          }),
        ],
        ['query'],
      ),
    'icrc2_approve' : IDL.Func(
        [ApproveArgs],
        [IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : ApproveError })],
        [],
      ),
    'icrc2_transfer_from' : IDL.Func(
        [TransferFromArgs],
        [IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : TransferFromError })],
        [],
      ),
    'ictokens_clearSnapshot' : IDL.Func([], [IDL.Bool], []),
    'ictokens_config' : IDL.Func([Config], [IDL.Bool], []),
    'ictokens_getConfig' : IDL.Func([], [Config], ['query']),
    'ictokens_getSnapshot' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [Time, IDL.Vec(IDL.Tuple(AccountId, IDL.Nat)), IDL.Bool],
        ['query'],
      ),
    'ictokens_heldFirstTime' : IDL.Func(
        [Address__1],
        [IDL.Opt(Time)],
        ['query'],
      ),
    'ictokens_maxSupply' : IDL.Func([], [IDL.Opt(IDL.Nat)], ['query']),
    'ictokens_setFee' : IDL.Func([Amount], [IDL.Bool], []),
    'ictokens_setMetadata' : IDL.Func([IDL.Vec(Metadata__1)], [IDL.Bool], []),
    'ictokens_snapshot' : IDL.Func([Amount], [IDL.Bool], []),
    'ictokens_snapshotBalanceOf' : IDL.Func(
        [IDL.Nat, Address__1],
        [Time, IDL.Opt(IDL.Nat)],
        ['query'],
      ),
    'ictokens_top100' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(Address__1, IDL.Nat))],
        ['query'],
      ),
    'logo' : IDL.Func([], [IDL.Text], ['query']),
    'name' : IDL.Func([], [IDL.Text], ['query']),
    'standard' : IDL.Func([], [IDL.Text], ['query']),
    'symbol' : IDL.Func([], [IDL.Text], ['query']),
    'totalSupply' : IDL.Func([], [IDL.Nat], ['query']),
    'transfer' : IDL.Func([IDL.Principal, IDL.Nat], [TxReceipt], []),
    'transferFrom' : IDL.Func(
        [IDL.Principal, IDL.Principal, IDL.Nat],
        [TxReceipt],
        [],
      ),
    'wallet_receive' : IDL.Func([], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
