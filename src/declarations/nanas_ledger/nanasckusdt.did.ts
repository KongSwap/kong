import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface Allowance {
  'allowance' : bigint,
  'expires_at' : [] | [bigint],
}
export interface AllowanceArgs { 'account' : Account, 'spender' : Account }
export interface Approve {
  'fee' : [] | [bigint],
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [bigint],
  'spender' : Account,
}
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
export interface ArchiveInfo {
  'block_range_end' : bigint,
  'canister_id' : Principal,
  'block_range_start' : bigint,
}
export interface ArchiveOptions {
  'num_blocks_to_archive' : bigint,
  'max_transactions_per_response' : [] | [bigint],
  'trigger_threshold' : bigint,
  'more_controller_ids' : [] | [Array<Principal>],
  'max_message_size_bytes' : [] | [bigint],
  'cycles_for_archive_creation' : [] | [bigint],
  'node_max_memory_size_bytes' : [] | [bigint],
  'controller_id' : Principal,
}
export interface ArchivedRange {
  'callback' : [Principal, string],
  'start' : bigint,
  'length' : bigint,
}
export interface ArchivedRange_1 {
  'callback' : [Principal, string],
  'start' : bigint,
  'length' : bigint,
}
export interface BlockRange { 'blocks' : Array<Value> }
export interface Burn {
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'spender' : [] | [Account],
}
export type ChangeFeeCollector = { 'SetTo' : Account } |
  { 'Unset' : null };
export interface DataCertificate {
  'certificate' : [] | [Uint8Array | number[]],
  'hash_tree' : Uint8Array | number[],
}
export interface FeatureFlags { 'icrc2' : boolean }
export interface FeeInfo {
  'burn_fee' : bigint,
  'decimals' : bigint,
  'transfer_fee' : bigint,
}
export interface GetBlocksRequest { 'start' : bigint, 'length' : bigint }
export interface GetBlocksResponse {
  'certificate' : [] | [Uint8Array | number[]],
  'first_index' : bigint,
  'blocks' : Array<Value>,
  'chain_length' : bigint,
  'archived_blocks' : Array<ArchivedRange>,
}
export interface GetTransactionsResponse {
  'first_index' : bigint,
  'log_length' : bigint,
  'transactions' : Array<Transaction>,
  'archived_transactions' : Array<ArchivedRange_1>,
}
export interface HoldersBalances {
  'max_length' : bigint,
  'balances' : Array<[Account, bigint]>,
}
export interface InitArgs {
  'burn_fee' : bigint,
  'decimals' : [] | [number],
  'token_symbol' : string,
  'transfer_fee' : bigint,
  'metadata' : Array<[string, MetadataValue]>,
  'minting_account' : Account,
  'initial_balances' : Array<[Account, bigint]>,
  'maximum_number_of_accounts' : [] | [bigint],
  'accounts_overflow_trim_quantity' : [] | [bigint],
  'fee_collector_account' : [] | [Account],
  'burn_fee_rate' : bigint,
  'archive_options' : ArchiveOptions,
  'max_memo_length' : [] | [number],
  'token_name' : string,
  'feature_flags' : [] | [FeatureFlags],
  'transfer_fee_rate' : bigint,
}
export type LedgerArgument = { 'Upgrade' : [] | [UpgradeArgs] } |
  { 'Init' : InitArgs };
export type MetadataValue = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string };
export interface Mint {
  'to' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type Result = { 'Ok' : bigint } |
  { 'Err' : TransferError };
export type Result_1 = { 'Ok' : bigint } |
  { 'Err' : ApproveError };
export type Result_2 = { 'Ok' : bigint } |
  { 'Err' : TransferFromError };
export type Result_3 = { 'Ok' : null } |
  { 'Err' : string };
export interface StandardRecord { 'url' : string, 'name' : string }
export interface Transaction {
  'burn' : [] | [Burn],
  'kind' : string,
  'mint' : [] | [Mint],
  'approve' : [] | [Approve],
  'timestamp' : bigint,
  'transfer' : [] | [Transfer],
}
export interface TransactionRange { 'transactions' : Array<Transaction> }
export interface Transfer {
  'to' : Account,
  'fee' : [] | [bigint],
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'spender' : [] | [Account],
}
export interface TransferArg {
  'to' : Account,
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
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
export interface UpgradeArgs {
  'burn_fee' : [] | [bigint],
  'token_symbol' : [] | [string],
  'transfer_fee' : [] | [bigint],
  'metadata' : [] | [Array<[string, MetadataValue]>],
  'maximum_number_of_accounts' : [] | [bigint],
  'accounts_overflow_trim_quantity' : [] | [bigint],
  'change_fee_collector' : [] | [ChangeFeeCollector],
  'burn_fee_rate' : [] | [bigint],
  'max_memo_length' : [] | [number],
  'token_name' : [] | [string],
  'feature_flags' : [] | [FeatureFlags],
  'transfer_fee_rate' : [] | [bigint],
}
export type Value = { 'Int' : bigint } |
  { 'Map' : Array<[string, Value]> } |
  { 'Nat' : bigint } |
  { 'Nat64' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string } |
  { 'Array' : Vec };
export type Vec = Array<
  { 'Int' : bigint } |
    { 'Map' : Array<[string, Value]> } |
    { 'Nat' : bigint } |
    { 'Nat64' : bigint } |
    { 'Blob' : Uint8Array | number[] } |
    { 'Text' : string } |
    { 'Array' : Vec }
>;
export interface _SERVICE {
  'archives' : ActorMethod<[], Array<ArchiveInfo>>,
  'get_blocks' : ActorMethod<[GetBlocksRequest], GetBlocksResponse>,
  'get_data_certificate' : ActorMethod<[], DataCertificate>,
  'get_transactions' : ActorMethod<[GetBlocksRequest], GetTransactionsResponse>,
  'icrc1_balance_of' : ActorMethod<[Account], bigint>,
  'icrc1_decimals' : ActorMethod<[], number>,
  'icrc1_fee' : ActorMethod<[], bigint>,
  'icrc1_metadata' : ActorMethod<[], Array<[string, MetadataValue]>>,
  'icrc1_minting_account' : ActorMethod<[], [] | [Account]>,
  'icrc1_name' : ActorMethod<[], string>,
  'icrc1_supported_standards' : ActorMethod<[], Array<StandardRecord>>,
  'icrc1_symbol' : ActorMethod<[], string>,
  'icrc1_total_supply' : ActorMethod<[], bigint>,
  'icrc1_transfer' : ActorMethod<[TransferArg], Result>,
  'icrc2_allowance' : ActorMethod<[AllowanceArgs], Allowance>,
  'icrc2_approve' : ActorMethod<[ApproveArgs], Result_1>,
  'icrc2_transfer_from' : ActorMethod<[TransferFromArgs], Result_2>,
  'icrc_plus_cycles' : ActorMethod<[], bigint>,
  'icrc_plus_fee_info' : ActorMethod<[], FeeInfo>,
  'icrc_plus_holders_balance' : ActorMethod<[bigint, bigint], HoldersBalances>,
  'icrc_plus_holders_count' : ActorMethod<[], bigint>,
  'icrc_plus_set_minting_account' : ActorMethod<[Account], Result_3>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
