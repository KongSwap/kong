import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ConsentInfo {
  'metadata' : ConsentMessageMetadata,
  'consent_message' : ConsentMessage,
}
export type ConsentMessage = {
    'LineDisplayMessage' : { 'pages' : Array<LineDisplayPage> }
  } |
  { 'GenericDisplayMessage' : string };
export interface ConsentMessageMetadata {
  'utc_offset_minutes' : [] | [number],
  'language' : string,
}
export interface ConsentMessageRequest {
  'arg' : Uint8Array | number[],
  'method' : string,
  'user_preferences' : ConsentMessageSpec,
}
export interface ConsentMessageSpec {
  'metadata' : ConsentMessageMetadata,
  'device_spec' : [] | [DisplayMessageType],
}
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
export type DisplayMessageType = { 'GenericDisplay' : null } |
  {
    'LineDisplay' : {
      'characters_per_line' : number,
      'lines_per_page' : number,
    }
  };
export interface ErrorInfo { 'description' : string }
export interface Icrc28TrustedOriginsResponse {
  'trusted_origins' : Array<string>,
}
export interface LineDisplayPage { 'lines' : Array<string> }
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
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : Message } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : ConsentInfo } |
  { 'Err' : ErrorInfo };
export type Result_3 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_4 = { 'Ok' : null } |
  { 'Err' : DelegationError };
export interface RevokeDelegationRequest { 'targets' : Array<Principal> }
export interface _SERVICE {
  'add_admin' : ActorMethod<[string], Result>,
  'ban_user' : ActorMethod<[Principal, bigint], Result>,
  'check_ban_status' : ActorMethod<[Principal], [] | [bigint]>,
  'create_message' : ActorMethod<[string], Result_1>,
  'delete_message' : ActorMethod<[bigint], Result>,
  'get_message' : ActorMethod<[bigint], [] | [Message]>,
  'get_messages' : ActorMethod<[[] | [PaginationParams]], MessagesPage>,
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    Result_2
  >,
  'icrc28_trusted_origins' : ActorMethod<[], Icrc28TrustedOriginsResponse>,
  'icrc_34_delegate' : ActorMethod<[DelegationRequest], Result_3>,
  'icrc_34_get_delegation' : ActorMethod<[DelegationRequest], Result_3>,
  'icrc_34_revoke_delegation' : ActorMethod<
    [RevokeDelegationRequest],
    Result_4
  >,
  'is_admin' : ActorMethod<[string], boolean>,
  'unban_user' : ActorMethod<[Principal], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
