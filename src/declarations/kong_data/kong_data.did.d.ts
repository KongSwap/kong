import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AddLiquidityArgs {
  'token_0' : string,
  'token_1' : string,
  'amount_0' : bigint,
  'amount_1' : bigint,
  'tx_id_0' : [] | [TxId],
  'tx_id_1' : [] | [TxId],
}
export interface AddLiquidityReply {
  'ts' : bigint,
  'request_id' : bigint,
  'status' : string,
  'tx_id' : bigint,
  'add_lp_token_amount' : bigint,
  'transfer_ids' : Array<TransferIdReply>,
  'amount_0' : bigint,
  'amount_1' : bigint,
  'claim_ids' : BigUint64Array | bigint[],
  'address_0' : string,
  'address_1' : string,
  'symbol_0' : string,
  'symbol_1' : string,
  'chain_0' : string,
  'chain_1' : string,
  'symbol' : string,
}
export interface AddPoolArgs {
  'token_0' : string,
  'token_1' : string,
  'amount_0' : bigint,
  'amount_1' : bigint,
  'tx_id_0' : [] | [TxId],
  'tx_id_1' : [] | [TxId],
  'lp_fee_bps' : [] | [number],
  'on_kong' : [] | [boolean],
}
export interface AddPoolReply {
  'ts' : bigint,
  'request_id' : bigint,
  'status' : string,
  'tx_id' : bigint,
  'lp_token_symbol' : string,
  'add_lp_token_amount' : bigint,
  'transfer_ids' : Array<TransferIdReply>,
  'amount_0' : bigint,
  'amount_1' : bigint,
  'claim_ids' : BigUint64Array | bigint[],
  'address_0' : string,
  'address_1' : string,
  'symbol_0' : string,
  'symbol_1' : string,
  'chain_0' : string,
  'chain_1' : string,
  'symbol' : string,
  'lp_fee_bps' : number,
  'on_kong' : boolean,
}
export interface ICTransferReply {
  'is_send' : boolean,
  'block_index' : bigint,
  'chain' : string,
  'canister_id' : string,
  'amount' : bigint,
  'symbol' : string,
}
export interface Icrc10SupportedStandards { 'url' : string, 'name' : string }
export interface Icrc28TrustedOriginsResponse {
  'trusted_origins' : Array<string>,
}
export interface RemoveLiquidityArgs {
  'token_0' : string,
  'token_1' : string,
  'remove_lp_token_amount' : bigint,
}
export interface RemoveLiquidityReply {
  'ts' : bigint,
  'request_id' : bigint,
  'status' : string,
  'tx_id' : bigint,
  'transfer_ids' : Array<TransferIdReply>,
  'lp_fee_0' : bigint,
  'lp_fee_1' : bigint,
  'amount_0' : bigint,
  'amount_1' : bigint,
  'claim_ids' : BigUint64Array | bigint[],
  'address_0' : string,
  'address_1' : string,
  'symbol_0' : string,
  'symbol_1' : string,
  'chain_0' : string,
  'chain_1' : string,
  'remove_lp_token_amount' : bigint,
  'symbol' : string,
}
export type RequestReply = { 'AddLiquidity' : AddLiquidityReply } |
  { 'Swap' : SwapReply } |
  { 'AddPool' : AddPoolReply } |
  { 'RemoveLiquidity' : RemoveLiquidityReply } |
  { 'Pending' : null };
export type RequestRequest = { 'AddLiquidity' : AddLiquidityArgs } |
  { 'Swap' : SwapArgs } |
  { 'AddPool' : AddPoolArgs } |
  { 'RemoveLiquidity' : RemoveLiquidityArgs };
export interface RequestsReply {
  'ts' : bigint,
  'request_id' : bigint,
  'request' : RequestRequest,
  'statuses' : Array<string>,
  'reply' : RequestReply,
}
export type RequestsResult = { 'Ok' : Array<RequestsReply> } |
  { 'Err' : string };
export interface SwapArgs {
  'receive_token' : string,
  'max_slippage' : [] | [number],
  'pay_amount' : bigint,
  'referred_by' : [] | [string],
  'receive_amount' : [] | [bigint],
  'receive_address' : [] | [string],
  'pay_token' : string,
  'pay_tx_id' : [] | [TxId],
}
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
export type TxId = { 'TransactionId' : string } |
  { 'BlockIndex' : bigint };
export type TxsReply = { 'AddLiquidity' : AddLiquidityReply } |
  { 'Swap' : SwapReply } |
  { 'AddPool' : AddPoolReply } |
  { 'RemoveLiquidity' : RemoveLiquidityReply };
export type TxsResult = { 'Ok' : Array<TxsReply> } |
  { 'Err' : string };
export interface _SERVICE {
  'get_requests' : ActorMethod<
    [[] | [bigint], [] | [number], [] | [number]],
    RequestsResult
  >,
  'get_txs' : ActorMethod<
    [[] | [bigint], [] | [bigint], [] | [number], [] | [number]],
    TxsResult
  >,
  'icrc10_supported_standards' : ActorMethod<
    [],
    Array<Icrc10SupportedStandards>
  >,
  'icrc1_name' : ActorMethod<[], string>,
  'icrc28_trusted_origins' : ActorMethod<[], Icrc28TrustedOriginsResponse>,
  'requests' : ActorMethod<[[] | [bigint], [] | [number]], RequestsResult>,
  'txs' : ActorMethod<
    [[] | [boolean], [] | [bigint], [] | [number], [] | [number]],
    TxsResult
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
