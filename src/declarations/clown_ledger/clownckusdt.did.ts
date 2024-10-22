import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export interface Account__1 {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export interface AdvancedSettings {
  'permitted_drift' : Timestamp,
  'burned_tokens' : Balance,
  'transaction_window' : Timestamp,
}
export interface ArchiveInterface {
  'append_transactions' : ActorMethod<[Array<Transaction>], Result>,
  'get_first_tx' : ActorMethod<[], bigint>,
  'get_last_tx' : ActorMethod<[], bigint>,
  'get_next_archive' : ActorMethod<[], Principal>,
  'get_prev_archive' : ActorMethod<[], Principal>,
  'get_transaction' : ActorMethod<[TxIndex], [] | [Transaction]>,
  'get_transactions' : ActorMethod<
    [GetTransactionsRequest__1],
    TransactionRange
  >,
  'max_memory' : ActorMethod<[], bigint>,
  'remaining_capacity' : ActorMethod<[], bigint>,
  'set_first_tx' : ActorMethod<[bigint], Result>,
  'set_last_tx' : ActorMethod<[bigint], Result>,
  'set_next_archive' : ActorMethod<[Principal], Result>,
  'set_prev_archive' : ActorMethod<[Principal], Result>,
  'total_transactions' : ActorMethod<[], bigint>,
  'total_used' : ActorMethod<[], bigint>,
}
export interface ArchiveInterface__1 {
  'append_transactions' : ActorMethod<[Array<Transaction>], Result>,
  'get_first_tx' : ActorMethod<[], bigint>,
  'get_last_tx' : ActorMethod<[], bigint>,
  'get_next_archive' : ActorMethod<[], Principal>,
  'get_prev_archive' : ActorMethod<[], Principal>,
  'get_transaction' : ActorMethod<[TxIndex], [] | [Transaction]>,
  'get_transactions' : ActorMethod<
    [GetTransactionsRequest__1],
    TransactionRange
  >,
  'max_memory' : ActorMethod<[], bigint>,
  'remaining_capacity' : ActorMethod<[], bigint>,
  'set_first_tx' : ActorMethod<[bigint], Result>,
  'set_last_tx' : ActorMethod<[bigint], Result>,
  'set_next_archive' : ActorMethod<[Principal], Result>,
  'set_prev_archive' : ActorMethod<[Principal], Result>,
  'total_transactions' : ActorMethod<[], bigint>,
  'total_used' : ActorMethod<[], bigint>,
}
export interface ArchivedTransaction {
  'callback' : QueryArchiveFn,
  'start' : TxIndex,
  'length' : bigint,
}
export type Balance = bigint;
export type Balance__1 = bigint;
export interface Burn {
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : Balance,
}
export interface BurnArgs {
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Subaccount],
  'created_at_time' : [] | [bigint],
  'amount' : Balance,
}
export interface GetTransactionsRequest { 'start' : TxIndex, 'length' : bigint }
export interface GetTransactionsRequest__1 {
  'start' : TxIndex,
  'length' : bigint,
}
export interface GetTransactionsResponse {
  'first_index' : TxIndex,
  'log_length' : bigint,
  'transactions' : Array<Transaction>,
  'archived_transactions' : Array<ArchivedTransaction>,
}
export type MetaDatum = [string, Value];
export interface Mint {
  'to' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : Balance,
}
export interface Mint__1 {
  'to' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : Balance,
}
export type QueryArchiveFn = ActorMethod<
  [GetTransactionsRequest__1],
  TransactionRange
>;
export type Result = { 'ok' : null } |
  { 'err' : string };
export type SetAccountParameterResult = { 'Ok' : Account } |
  { 'Err' : SetParameterError };
export type SetBalanceParameterResult = { 'Ok' : Balance } |
  { 'Err' : SetParameterError };
export type SetNat8ParameterResult = { 'Ok' : number } |
  { 'Err' : SetParameterError };
export type SetParameterError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  };
export type SetTextParameterResult = { 'Ok' : string } |
  { 'Err' : SetParameterError };
export type Subaccount = Uint8Array | number[];
export interface SupportedStandard { 'url' : string, 'name' : string }
export type Timestamp = bigint;
export interface TokenInitArgs {
  'fee' : Balance,
  'advanced_settings' : [] | [AdvancedSettings],
  'decimals' : number,
  'minting_account' : [] | [Account],
  'logo' : string,
  'name' : string,
  'initial_balances' : Array<[Account, Balance]>,
  'min_burn_amount' : Balance,
  'max_supply' : Balance,
  'symbol' : string,
}
export interface Transaction {
  'burn' : [] | [Burn],
  'kind' : string,
  'mint' : [] | [Mint__1],
  'timestamp' : Timestamp,
  'index' : TxIndex,
  'transfer' : [] | [Transfer],
}
export interface TransactionRange { 'transactions' : Array<Transaction> }
export interface Transaction__1 {
  'burn' : [] | [Burn],
  'kind' : string,
  'mint' : [] | [Mint__1],
  'timestamp' : Timestamp,
  'index' : TxIndex,
  'transfer' : [] | [Transfer],
}
export interface Transfer {
  'to' : Account,
  'fee' : [] | [Balance],
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : Balance,
}
export interface TransferArgs {
  'to' : Account,
  'fee' : [] | [Balance],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Subaccount],
  'created_at_time' : [] | [bigint],
  'amount' : Balance,
}
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : Balance } } |
  { 'Duplicate' : { 'duplicate_of' : TxIndex } } |
  { 'BadFee' : { 'expected_fee' : Balance } } |
  { 'CreatedInFuture' : { 'ledger_time' : Timestamp } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : Balance } };
export type TransferResult = { 'Ok' : TxIndex } |
  { 'Err' : TransferError };
export type TxIndex = bigint;
export type TxIndex__1 = bigint;
export type Value = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string };
export interface _SERVICE {
  'burn' : ActorMethod<[BurnArgs], TransferResult>,
  'deposit_cycles' : ActorMethod<[], undefined>,
  'get_archive' : ActorMethod<[], Principal>,
  'get_archive_stored_txs' : ActorMethod<[], bigint>,
  'get_total_tx' : ActorMethod<[], bigint>,
  'get_transaction' : ActorMethod<[TxIndex__1], [] | [Transaction__1]>,
  'get_transactions' : ActorMethod<
    [GetTransactionsRequest],
    GetTransactionsResponse
  >,
  'icrc1_balance_of' : ActorMethod<[Account__1], Balance__1>,
  'icrc1_decimals' : ActorMethod<[], number>,
  'icrc1_fee' : ActorMethod<[], Balance__1>,
  'icrc1_metadata' : ActorMethod<[], Array<MetaDatum>>,
  'icrc1_minting_account' : ActorMethod<[], [] | [Account__1]>,
  'icrc1_name' : ActorMethod<[], string>,
  'icrc1_supported_standards' : ActorMethod<[], Array<SupportedStandard>>,
  'icrc1_symbol' : ActorMethod<[], string>,
  'icrc1_total_supply' : ActorMethod<[], Balance__1>,
  'icrc1_transfer' : ActorMethod<[TransferArgs], TransferResult>,
  'min_burn_amount' : ActorMethod<[], Balance__1>,
  'mint' : ActorMethod<[Mint], TransferResult>,
  'set_decimals' : ActorMethod<[number], SetNat8ParameterResult>,
  'set_fee' : ActorMethod<[Balance__1], SetBalanceParameterResult>,
  'set_logo' : ActorMethod<[string], SetTextParameterResult>,
  'set_min_burn_amount' : ActorMethod<[Balance__1], SetBalanceParameterResult>,
  'set_minting_account' : ActorMethod<[string], SetAccountParameterResult>,
  'set_name' : ActorMethod<[string], SetTextParameterResult>,
  'set_symbol' : ActorMethod<[string], SetTextParameterResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
