import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface BatchCommentCountRequest { 'context_ids' : Array<string> }
export interface Comment {
  'id' : bigint,
  'context_id' : string,
  'content' : string,
  'created_at' : bigint,
  'edited_at' : [] | [bigint],
  'author' : Principal,
  'likes' : number,
  'parent_id' : [] | [bigint],
  'is_edited' : boolean,
}
export interface CommentResponse {
  'id' : bigint,
  'context_id' : string,
  'content' : string,
  'created_at' : bigint,
  'edited_at' : [] | [bigint],
  'author' : Principal,
  'likes' : number,
  'has_liked' : boolean,
  'parent_id' : [] | [bigint],
  'is_edited' : boolean,
}
export interface CommentsPage {
  'next_cursor' : [] | [bigint],
  'comments' : Array<CommentResponse>,
}
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
export interface ContextCommentCount { 'context_id' : string, 'count' : number }
export interface CreateCommentRequest {
  'context_id' : string,
  'content' : string,
  'parent_id' : [] | [bigint],
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
export interface EditCommentRequest {
  'content' : string,
  'comment_id' : bigint,
}
export interface ErrorInfo { 'description' : string }
export interface GetCommentsRequest {
  'context_id' : string,
  'pagination' : [] | [PaginationParams],
  'check_likes_for' : [] | [Principal],
}
export interface Icrc28TrustedOriginsResponse {
  'trusted_origins' : Array<string>,
}
export interface LineDisplayPage { 'lines' : Array<string> }
export interface PaginationParams {
  'cursor' : [] | [bigint],
  'limit' : [] | [bigint],
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : CommentResponse } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : number } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : ConsentInfo } |
  { 'Err' : ErrorInfo };
export type Result_4 = { 'Ok' : DelegationResponse } |
  { 'Err' : DelegationError };
export type Result_5 = { 'Ok' : null } |
  { 'Err' : DelegationError };
export interface RevokeDelegationRequest { 'targets' : Array<Principal> }
export interface _SERVICE {
  'add_admin' : ActorMethod<[string], Result>,
  'ban_user' : ActorMethod<[Principal, bigint], Result>,
  'check_ban_status' : ActorMethod<[Principal], [] | [bigint]>,
  'create_comment' : ActorMethod<[CreateCommentRequest], Result_1>,
  'delete_comment' : ActorMethod<[bigint], Result>,
  'delete_context_comments' : ActorMethod<[string], Result_2>,
  'edit_comment' : ActorMethod<[EditCommentRequest], Result_1>,
  'get_batch_context_comment_counts' : ActorMethod<
    [BatchCommentCountRequest],
    Array<ContextCommentCount>
  >,
  'get_comment' : ActorMethod<[bigint], [] | [Comment]>,
  'get_comments_by_context' : ActorMethod<[GetCommentsRequest], CommentsPage>,
  'get_context_comment_count' : ActorMethod<[string], number>,
  'get_user_comments' : ActorMethod<[Principal, [] | [number]], Array<Comment>>,
  'get_user_liked_comments' : ActorMethod<[], BigUint64Array | bigint[]>,
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    Result_3
  >,
  'icrc28_trusted_origins' : ActorMethod<[], Icrc28TrustedOriginsResponse>,
  'icrc_34_delegate' : ActorMethod<[DelegationRequest], Result_4>,
  'icrc_34_get_delegation' : ActorMethod<[DelegationRequest], Result_4>,
  'icrc_34_revoke_delegation' : ActorMethod<
    [RevokeDelegationRequest],
    Result_5
  >,
  'is_admin' : ActorMethod<[string], boolean>,
  'like_comment' : ActorMethod<[bigint], Result_2>,
  'unban_user' : ActorMethod<[Principal], Result>,
  'unlike_comment' : ActorMethod<[bigint], Result_2>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
