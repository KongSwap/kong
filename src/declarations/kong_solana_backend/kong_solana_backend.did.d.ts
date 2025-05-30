import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface IcpTransferJob {
  'id' : bigint,
  'status' : IcpTransferStatus,
  'updated_at' : bigint,
  'to_principal' : Principal,
  'block_index' : [] | [bigint],
  'error_message' : [] | [string],
  'attempts' : number,
  'created_at' : bigint,
  'from_principal' : [] | [Principal],
  'amount' : bigint,
}
export type IcpTransferStatus = { 'Failed' : null } |
  { 'InProgress' : null } |
  { 'Completed' : null } |
  { 'Pending' : null };
export interface QueuedSwapReply {
  'status' : string,
  'job_id' : bigint,
  'message' : string,
}
export type Result = { 'Ok' : string } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : QueuedSwapReply } |
  { 'Err' : string };
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
export interface TransactionNotification {
  'status' : string,
  'signature' : string,
  'metadata' : [] | [string],
}
export interface TransactionQueueItem {
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
export type TxId = { 'TransactionHash' : string } |
  { 'BlockIndex' : bigint };
export interface UpdateSolanaTransactionArgs {
  'status' : string,
  'signature' : string,
  'metadata' : [] | [string],
}
export interface _SERVICE {
  'cache_solana_address' : ActorMethod<[], Result>,
  'finalize_swap_job' : ActorMethod<
    [bigint, string, boolean, [] | [string]],
    Result_1
  >,
  'get_all_solana_transactions' : ActorMethod<
    [],
    Array<TransactionNotification>
  >,
  'get_icp_job' : ActorMethod<[bigint], [] | [IcpTransferJob]>,
  'get_icp_jobs_for_caller' : ActorMethod<[], Array<IcpTransferJob>>,
  'get_pending_icp_jobs' : ActorMethod<[number], Array<IcpTransferJob>>,
  'get_pending_swap_jobs' : ActorMethod<[number], Array<SwapJob>>,
  'get_solana_address' : ActorMethod<[], Result>,
  'get_solana_transaction' : ActorMethod<
    [string],
    [] | [TransactionNotification]
  >,
  'get_swap_job' : ActorMethod<[bigint], [] | [SwapJob]>,
  'get_transactions' : ActorMethod<
    [bigint, number],
    Array<TransactionQueueItem>
  >,
  'mark_swap_job_submitted' : ActorMethod<[bigint, string], Result_1>,
  'mark_transactions_processed' : ActorMethod<
    [BigUint64Array | bigint[]],
    Result_1
  >,
  'receive_solana_transaction_notification' : ActorMethod<
    [TransactionNotification],
    Result_1
  >,
  'swap' : ActorMethod<[SwapArgs], Result_2>,
  'update_latest_blockhash' : ActorMethod<[string], Result_1>,
  'update_solana_transaction' : ActorMethod<
    [UpdateSolanaTransactionArgs],
    Result_1
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
