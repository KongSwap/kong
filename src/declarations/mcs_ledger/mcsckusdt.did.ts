import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export type AccountId = Uint8Array | number[];
export type AccountId__1 = Uint8Array | number[];
export type AccountId__2 = Uint8Array | number[];
export interface Account__1 {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export type Address = string;
export type Address__1 = string;
export type Address__2 = string;
export type Address__3 = string;
export interface Allowance { 'remaining' : bigint, 'spender' : AccountId__1 }
export interface AllowanceArgs { 'account' : Account, 'spender' : Account }
export type Amount = bigint;
export interface ApproveArgs {
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [bigint],
  'spender' : Account,
}
export type ApproveError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'AllowanceChanged' : { 'current_allowance' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'Expired' : { 'ledger_time' : bigint } } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type Callback = ActorMethod<[TxnRecord__1], undefined>;
export type Callback__1 = ActorMethod<[TxnRecord__1], undefined>;
export interface CoinSeconds { 'updateTime' : bigint, 'coinSeconds' : bigint }
export interface Config { 'feeTo' : [] | [Address__2] }
export interface Config__1 { 'MAX_PUBLICATION_TRIES' : [] | [bigint] }
export interface Config__2 {
  'MAX_STORAGE_TRIES' : [] | [bigint],
  'EN_DEBUG' : [] | [boolean],
  'MAX_CACHE_NUMBER_PER' : [] | [bigint],
  'MAX_CACHE_TIME' : [] | [bigint],
}
export interface DRC207Support {
  'timer' : { 'interval_seconds' : [] | [bigint], 'enable' : boolean },
  'monitorable_by_self' : boolean,
  'monitorable_by_blackhole' : {
    'canister_id' : [] | [Principal],
    'allowed' : boolean,
  },
  'cycles_receivable' : boolean,
}
export type Data = Uint8Array | number[];
export type Decider = string;
export type ExecuteType = { 'fallback' : null } |
  { 'send' : bigint } |
  { 'sendAll' : null };
export type From = string;
export type Gas = { 'token' : bigint } |
  { 'cycles' : bigint } |
  { 'noFee' : null };
export type Gas__1 = { 'token' : bigint } |
  { 'cycles' : bigint } |
  { 'noFee' : null };
export type Gas__2 = { 'token' : bigint } |
  { 'cycles' : bigint } |
  { 'noFee' : null };
export interface InitArgs {
  'fee' : bigint,
  'decimals' : number,
  'metadata' : [] | [Array<Metadata>],
  'name' : [] | [string],
  'totalSupply' : bigint,
  'founder' : [] | [Address],
  'symbol' : [] | [string],
}
export interface Metadata { 'content' : string, 'name' : string }
export interface Metadata__1 { 'content' : string, 'name' : string }
export interface Metadata__2 {
  'fee' : bigint,
  'decimals' : number,
  'owner' : Principal,
  'logo' : string,
  'name' : string,
  'totalSupply' : bigint,
  'symbol' : string,
}
export type MsgType = { 'onApprove' : null } |
  { 'onExecute' : null } |
  { 'onTransfer' : null } |
  { 'onLock' : null };
export type MsgType__1 = { 'onApprove' : null } |
  { 'onExecute' : null } |
  { 'onTransfer' : null } |
  { 'onLock' : null };
export type Nonce = bigint;
export type Operation = { 'approve' : { 'allowance' : bigint } } |
  {
    'lockTransfer' : {
      'locked' : bigint,
      'expiration' : Time__1,
      'decider' : AccountId__1,
    }
  } |
  {
    'transfer' : {
      'action' : { 'burn' : null } |
        { 'mint' : null } |
        { 'send' : null },
    }
  } |
  { 'executeTransfer' : { 'fallback' : bigint, 'lockedTxid' : Txid__1 } };
export type Operation__1 = { 'approve' : { 'allowance' : bigint } } |
  {
    'lockTransfer' : {
      'locked' : bigint,
      'expiration' : Time__2,
      'decider' : AccountId__2,
    }
  } |
  {
    'transfer' : {
      'action' : { 'burn' : null } |
        { 'mint' : null } |
        { 'send' : null },
    }
  } |
  { 'executeTransfer' : { 'fallback' : bigint, 'lockedTxid' : Txid__3 } };
export type Sa = Uint8Array | number[];
export interface Setting { 'MAX_PUBLICATION_TRIES' : bigint }
export interface Setting__1 {
  'MAX_STORAGE_TRIES' : bigint,
  'EN_DEBUG' : boolean,
  'MAX_CACHE_NUMBER_PER' : bigint,
  'MAX_CACHE_TIME' : bigint,
}
export type Spender = string;
export type Subaccount = Uint8Array | number[];
export interface Subscription {
  'callback' : Callback,
  'msgTypes' : Array<MsgType>,
}
export type Time = bigint;
export type Time__1 = bigint;
export type Time__2 = bigint;
export type Timeout = number;
export type Timestamp = bigint;
export type To = string;
export interface TokenInfo {
  'holderNumber' : bigint,
  'deployTime' : Time,
  'metadata' : Metadata__2,
  'historySize' : bigint,
  'cycles' : bigint,
  'feeTo' : Principal,
}
export interface Transaction {
  'to' : AccountId__1,
  'value' : bigint,
  'data' : [] | [Uint8Array | number[]],
  'from' : AccountId__1,
  'operation' : Operation,
}
export interface Transaction__1 {
  'to' : AccountId__2,
  'value' : bigint,
  'data' : [] | [Uint8Array | number[]],
  'from' : AccountId__2,
  'operation' : Operation__1,
}
export interface TransferArgs {
  'to' : Account,
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Subaccount],
  'created_at_time' : [] | [Timestamp],
  'amount' : bigint,
}
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface TransferFromArgs {
  'to' : Account,
  'fee' : [] | [bigint],
  'spender_subaccount' : [] | [Uint8Array | number[]],
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type TransferFromError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'InsufficientAllowance' : { 'allowance' : bigint } } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type TxReceipt = { 'Ok' : bigint } |
  {
    'Err' : { 'InsufficientAllowance' : null } |
      { 'InsufficientBalance' : null } |
      { 'ErrorOperationStyle' : null } |
      { 'Unauthorized' : null } |
      { 'LedgerTrap' : null } |
      { 'ErrorTo' : null } |
      { 'Other' : string } |
      { 'BlockUsed' : null } |
      { 'AmountTooSmall' : null }
  };
export type Txid = Uint8Array | number[];
export type Txid__1 = Uint8Array | number[];
export type Txid__2 = Uint8Array | number[];
export type Txid__3 = Uint8Array | number[];
export type TxnQueryRequest = { 'getEvents' : { 'owner' : [] | [Address] } } |
  { 'txnCount' : { 'owner' : Address } } |
  { 'lockedTxns' : { 'owner' : Address } } |
  { 'lastTxids' : { 'owner' : Address } } |
  { 'lastTxidsGlobal' : null } |
  { 'getTxn' : { 'txid' : Txid__1 } } |
  { 'txnCountGlobal' : null };
export type TxnQueryResponse = { 'getEvents' : Array<TxnRecord__1> } |
  { 'txnCount' : bigint } |
  {
    'lockedTxns' : { 'txns' : Array<TxnRecord__1>, 'lockedBalance' : bigint }
  } |
  { 'lastTxids' : Array<Txid__1> } |
  { 'lastTxidsGlobal' : Array<Txid__1> } |
  { 'getTxn' : [] | [TxnRecord__1] } |
  { 'txnCountGlobal' : bigint };
export interface TxnRecord {
  'gas' : Gas,
  'msgCaller' : [] | [Principal],
  'transaction' : Transaction,
  'txid' : Txid__1,
  'nonce' : bigint,
  'timestamp' : Time__1,
  'caller' : AccountId__1,
  'index' : bigint,
}
export interface TxnRecord__1 {
  'gas' : Gas,
  'msgCaller' : [] | [Principal],
  'transaction' : Transaction,
  'txid' : Txid__1,
  'nonce' : bigint,
  'timestamp' : Time__1,
  'caller' : AccountId__1,
  'index' : bigint,
}
export interface TxnRecord__2 {
  'gas' : Gas__2,
  'msgCaller' : [] | [Principal],
  'transaction' : Transaction__1,
  'txid' : Txid__3,
  'nonce' : bigint,
  'timestamp' : Time__2,
  'caller' : AccountId__2,
  'index' : bigint,
}
export type TxnResult = { 'ok' : Txid__1 } |
  {
    'err' : {
      'code' : { 'NonceError' : null } |
        { 'InsufficientGas' : null } |
        { 'InsufficientAllowance' : null } |
        { 'UndefinedError' : null } |
        { 'InsufficientBalance' : null } |
        { 'NoLockedTransfer' : null } |
        { 'DuplicateExecutedTransfer' : null } |
        { 'LockedTransferExpired' : null },
      'message' : string,
    }
  };
export type Value = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string };
export interface _SERVICE {
  'allowance' : ActorMethod<[Principal, Principal], bigint>,
  'approve' : ActorMethod<[Principal, bigint], TxReceipt>,
  'balanceOf' : ActorMethod<[Principal], bigint>,
  'decimals' : ActorMethod<[], number>,
  'drc202_canisterId' : ActorMethod<[], Principal>,
  'drc202_config' : ActorMethod<[Config__2], boolean>,
  'drc202_events' : ActorMethod<[[] | [Address__3]], Array<TxnRecord__2>>,
  'drc202_events_filter' : ActorMethod<
    [[] | [Address__3], [] | [Time], [] | [Time]],
    [Array<TxnRecord__2>, boolean]
  >,
  'drc202_getConfig' : ActorMethod<[], Setting__1>,
  'drc202_pool' : ActorMethod<[], Array<[Txid__2, bigint]>>,
  'drc202_txn' : ActorMethod<[Txid__2], [] | [TxnRecord__2]>,
  'drc202_txn2' : ActorMethod<[Txid__2], [] | [TxnRecord__2]>,
  'drc207' : ActorMethod<[], DRC207Support>,
  'drc20_allowance' : ActorMethod<[Address__1, Spender], Amount>,
  'drc20_approvals' : ActorMethod<[Address__1], Array<Allowance>>,
  'drc20_approve' : ActorMethod<
    [Spender, Amount, [] | [Nonce], [] | [Sa], [] | [Data]],
    TxnResult
  >,
  'drc20_balanceOf' : ActorMethod<[Address__1], Amount>,
  'drc20_decimals' : ActorMethod<[], number>,
  'drc20_dropAccount' : ActorMethod<[[] | [Sa]], boolean>,
  'drc20_executeTransfer' : ActorMethod<
    [Txid, ExecuteType, [] | [To], [] | [Nonce], [] | [Sa], [] | [Data]],
    TxnResult
  >,
  'drc20_fee' : ActorMethod<[], Amount>,
  'drc20_gas' : ActorMethod<[], Gas__1>,
  'drc20_getCoinSeconds' : ActorMethod<
    [[] | [Address__1]],
    [CoinSeconds, [] | [CoinSeconds]]
  >,
  'drc20_holdersCount' : ActorMethod<[], [bigint, bigint, bigint]>,
  'drc20_lockTransfer' : ActorMethod<
    [To, Amount, Timeout, [] | [Decider], [] | [Nonce], [] | [Sa], [] | [Data]],
    TxnResult
  >,
  'drc20_lockTransferFrom' : ActorMethod<
    [
      From,
      To,
      Amount,
      Timeout,
      [] | [Decider],
      [] | [Nonce],
      [] | [Sa],
      [] | [Data],
    ],
    TxnResult
  >,
  'drc20_metadata' : ActorMethod<[], Array<Metadata__1>>,
  'drc20_name' : ActorMethod<[], string>,
  'drc20_subscribe' : ActorMethod<
    [[Principal, string], Array<MsgType__1>, [] | [Sa]],
    boolean
  >,
  'drc20_subscribed' : ActorMethod<[Address__1], [] | [Subscription]>,
  'drc20_symbol' : ActorMethod<[], string>,
  'drc20_totalSupply' : ActorMethod<[], Amount>,
  'drc20_transfer' : ActorMethod<
    [To, Amount, [] | [Nonce], [] | [Sa], [] | [Data]],
    TxnResult
  >,
  'drc20_transferBatch' : ActorMethod<
    [Array<To>, Array<Amount>, [] | [Nonce], [] | [Sa], [] | [Data]],
    Array<TxnResult>
  >,
  'drc20_transferFrom' : ActorMethod<
    [From, To, Amount, [] | [Nonce], [] | [Sa], [] | [Data]],
    TxnResult
  >,
  'drc20_txnQuery' : ActorMethod<[TxnQueryRequest], TxnQueryResponse>,
  'drc20_txnRecord' : ActorMethod<[Txid], [] | [TxnRecord]>,
  'getMetadata' : ActorMethod<[], Metadata__2>,
  'getTokenFee' : ActorMethod<[], bigint>,
  'getTokenInfo' : ActorMethod<[], TokenInfo>,
  'historySize' : ActorMethod<[], bigint>,
  'icpubsub_config' : ActorMethod<[Config__1], boolean>,
  'icpubsub_getConfig' : ActorMethod<[], Setting>,
  'icrc1_balance_of' : ActorMethod<[Account__1], bigint>,
  'icrc1_decimals' : ActorMethod<[], number>,
  'icrc1_fee' : ActorMethod<[], bigint>,
  'icrc1_metadata' : ActorMethod<[], Array<[string, Value]>>,
  'icrc1_minting_account' : ActorMethod<[], [] | [Account__1]>,
  'icrc1_name' : ActorMethod<[], string>,
  'icrc1_supported_standards' : ActorMethod<
    [],
    Array<{ 'url' : string, 'name' : string }>
  >,
  'icrc1_symbol' : ActorMethod<[], string>,
  'icrc1_total_supply' : ActorMethod<[], bigint>,
  'icrc1_transfer' : ActorMethod<
    [TransferArgs],
    { 'Ok' : bigint } |
      { 'Err' : TransferError }
  >,
  'icrc2_allowance' : ActorMethod<
    [AllowanceArgs],
    { 'allowance' : bigint, 'expires_at' : [] | [bigint] }
  >,
  'icrc2_approve' : ActorMethod<
    [ApproveArgs],
    { 'Ok' : bigint } |
      { 'Err' : ApproveError }
  >,
  'icrc2_transfer_from' : ActorMethod<
    [TransferFromArgs],
    { 'Ok' : bigint } |
      { 'Err' : TransferFromError }
  >,
  'ictokens_clearSnapshot' : ActorMethod<[], boolean>,
  'ictokens_config' : ActorMethod<[Config], boolean>,
  'ictokens_getConfig' : ActorMethod<[], Config>,
  'ictokens_getSnapshot' : ActorMethod<
    [bigint, bigint],
    [Time, Array<[AccountId, bigint]>, boolean]
  >,
  'ictokens_heldFirstTime' : ActorMethod<[Address__1], [] | [Time]>,
  'ictokens_maxSupply' : ActorMethod<[], [] | [bigint]>,
  'ictokens_setFee' : ActorMethod<[Amount], boolean>,
  'ictokens_setMetadata' : ActorMethod<[Array<Metadata__1>], boolean>,
  'ictokens_snapshot' : ActorMethod<[Amount], boolean>,
  'ictokens_snapshotBalanceOf' : ActorMethod<
    [bigint, Address__1],
    [Time, [] | [bigint]]
  >,
  'ictokens_top100' : ActorMethod<[], Array<[Address__1, bigint]>>,
  'logo' : ActorMethod<[], string>,
  'name' : ActorMethod<[], string>,
  'standard' : ActorMethod<[], string>,
  'symbol' : ActorMethod<[], string>,
  'totalSupply' : ActorMethod<[], bigint>,
  'transfer' : ActorMethod<[Principal, bigint], TxReceipt>,
  'transferFrom' : ActorMethod<[Principal, Principal, bigint], TxReceipt>,
  'wallet_receive' : ActorMethod<[], undefined>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
