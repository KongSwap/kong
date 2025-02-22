import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Delegation {
  'created' : bigint,
  'targets_list_hash' : Uint8Array | number[],
  'target' : Principal,
  'expiration' : [] | [bigint],
}
export type DelegationError = { 'NotFound' : null } |
  { 'Unauthorized' : null } |
  { 'InvalidRequest' : string } |
  { 'StorageError' : string } |
  { 'Expired' : null };
export interface DelegationRequest {
  'targets' : Array<Principal>,
  'expiration' : [] | [bigint],
}
export interface DelegationResponse { 'delegations' : Array<Delegation> }
export interface ICRC21ConsentMessageRequest {
  'method' : string,
  'canister' : Principal,
}
export interface ICRC21ConsentMessageResponse { 'consent_message' : string }
export interface Icrc28TrustedOriginsResponse {
  'trusted_origins' : Array<string>,
}
export interface Message {
  'id' : bigint,
  'principal' : Principal,
  'created_at' : bigint,
  'message' : string,
}
export interface MessagesPage {
  'messages' : Array<Message>,
  'next_cursor' : [] | [bigint],
}
export interface PaginationParams {
  'cursor' : [] | [bigint],
  'limit' : [] | [bigint],
}
export type Result = { 'Ok' : Message } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_2 = { 'Ok' : null } |
  { 'Err' : DelegationError };
export interface RevokeDelegationRequest { 'targets' : Array<Principal> }
export interface _SERVICE {
  'create_message' : ActorMethod<[string], Result>,
  'get_message' : ActorMethod<[bigint], [] | [Message]>,
  'get_messages' : ActorMethod<[[] | [PaginationParams]], MessagesPage>,
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ICRC21ConsentMessageRequest],
    ICRC21ConsentMessageResponse
  >,
  'icrc28_trusted_origins' : ActorMethod<[], Icrc28TrustedOriginsResponse>,
  'icrc_34_delegate' : ActorMethod<[DelegationRequest], Result_1>,
  'icrc_34_get_delegation' : ActorMethod<[DelegationRequest], Result_1>,
  'icrc_34_revoke_delegation' : ActorMethod<
    [RevokeDelegationRequest],
    Result_2
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
