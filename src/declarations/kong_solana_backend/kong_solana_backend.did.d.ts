import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ICTransferReply {
  'is_send' : boolean,
  'block_index' : bigint,
  'chain' : string,
  'canister_id' : string,
  'amount' : bigint,
  'symbol' : string,
}
export interface QueuedSwapReply {
  'status' : string,
  'job_id' : [] | [bigint],
  'message' : string,
}
export interface QueuedTransaction {
  'id' : bigint,
  'fee' : [] | [bigint],
  'is_processed' : boolean,
  'direction' : [] | [string],
  'signature' : string,
  'metadata' : [] | [string],
  'instruction_type' : [] | [string],
  'sender' : [] | [string],
  'balance_change' : [] | [bigint],
  'processed_at' : [] | [bigint],
  'amount' : [] | [bigint],
  'queued_at' : bigint,
  'receiver' : [] | [string],
}
export interface SolanaTransaction {
  'id' : string,
  'fee' : [] | [bigint],
  'status' : SolanaTransactionStatus,
  'updated_at' : bigint,
  'direction' : [] | [string],
  'signature' : string,
  'transaction_time' : [] | [string],
  'metadata' : [] | [string],
  'instruction_type' : [] | [string],
  'sender' : [] | [string],
  'balance_change' : [] | [bigint],
  'registered_at' : bigint,
  'amount' : [] | [bigint],
  'receiver' : [] | [string],
}
export type SolanaTransactionStatus = { 'Failed' : null } |
  { 'Finalized' : null } |
  { 'Confirmed' : null } |
  { 'TimedOut' : null } |
  { 'Pending' : null };
export interface SwapArgs {
  'receive_token' : string,
  'signature' : [] | [string],
  'max_slippage' : [] | [number],
  'pay_amount' : bigint,
  'referred_by' : [] | [string],
  'receive_amount' : [] | [bigint],
  'receive_address' : [] | [string],
  'timestamp' : [] | [bigint],
  'pay_token' : string,
  'pay_tx_id' : [] | [TxId],
  'pay_address' : [] | [string],
}
export interface SwapJob {
  'id' : bigint,
  'status' : SwapJobStatus,
  'updated_at' : bigint,
  'error_message' : [] | [string],
  'attempts' : number,
  'created_at' : bigint,
  'original_args_json' : string,
  'solana_tx_signature_of_payout' : [] | [string],
  'encoded_signed_solana_tx' : string,
}
export type SwapJobStatus = { 'Failed' : null } |
  { 'Confirmed' : null } |
  { 'Submitted' : null } |
  { 'Pending' : null };
export interface SwapReply {
  'ts' : bigint,
  'txs' : Array<SwapTxReply>,
  'request_id' : bigint,
  'status' : string,
  'tx_id' : bigint,
  'transfer_ids' : Array<TransferIdReply>,
  'receive_chain' : string,
  'mid_price' : number,
  'pay_amount' : bigint,
  'receive_amount' : bigint,
  'claim_ids' : BigUint64Array | bigint[],
  'pay_symbol' : string,
  'receive_symbol' : string,
  'receive_address' : string,
  'pay_address' : string,
  'price' : number,
  'pay_chain' : string,
  'slippage' : number,
}
export type SwapResult = { 'Ok' : QueuedSwapReply } |
  { 'Err' : string };
export interface SwapTxReply {
  'ts' : bigint,
  'receive_chain' : string,
  'pay_amount' : bigint,
  'receive_amount' : bigint,
  'pay_symbol' : string,
  'receive_symbol' : string,
  'receive_address' : string,
  'pool_symbol' : string,
  'pay_address' : string,
  'price' : number,
  'pay_chain' : string,
  'lp_fee' : bigint,
  'gas_fee' : bigint,
}
export interface TransferIdReply {
  'transfer_id' : bigint,
  'transfer' : TransferReply,
}
export type TransferReply = { 'IC' : ICTransferReply };
export type TxId = { 'TransactionHash' : string } |
  { 'BlockIndex' : bigint };
export interface UpdateSolanaTransactionArgs {
  'id' : string,
  'fee' : [] | [bigint],
  'status' : string,
  'direction' : [] | [string],
  'signature' : string,
  'transaction_time' : [] | [string],
  'metadata' : [] | [string],
  'instruction_type' : [] | [string],
  'sender' : [] | [string],
  'balance_change' : [] | [bigint],
  'skip_queue' : boolean,
  'amount' : [] | [bigint],
  'receiver' : [] | [string],
}
export interface _SERVICE {
  'add_authorized_principal_with_role' : ActorMethod<
    [Principal, string],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'cache_solana_address' : ActorMethod<
    [],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'finalize_swap_job' : ActorMethod<
    [bigint, string, boolean, [] | [string]],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'get_all_solana_txs' : ActorMethod<[], Array<SolanaTransaction>>,
  'get_authorization_info' : ActorMethod<[], string>,
  'get_pending_swap_jobs' : ActorMethod<[number], Array<SwapJob>>,
  'get_security_stats' : ActorMethod<[], string>,
  'get_solana_address' : ActorMethod<
    [],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'get_solana_tx' : ActorMethod<[string], [] | [SolanaTransaction]>,
  'get_swap_job' : ActorMethod<[bigint], [] | [SwapJob]>,
  'get_transactions' : ActorMethod<[bigint, number], Array<QueuedTransaction>>,
  'list_authorized_principals_in_canister' : ActorMethod<
    [],
    { 'Ok' : Array<[Principal, string]> } |
      { 'Err' : string }
  >,
  'mark_swap_job_submitted' : ActorMethod<
    [bigint, string],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'mark_transactions_processed' : ActorMethod<
    [BigUint64Array | bigint[]],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'remove_authorized_principal_from_canister' : ActorMethod<
    [Principal],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'swap' : ActorMethod<[SwapArgs], SwapResult>,
  'update_latest_blockhash' : ActorMethod<
    [string],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'update_solana_tx' : ActorMethod<
    [UpdateSolanaTransactionArgs],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
