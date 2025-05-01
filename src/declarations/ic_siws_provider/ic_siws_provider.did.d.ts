import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Delegation {
  'pubkey' : Uint8Array | number[],
  'targets' : [] | [Array<Principal>],
  'expiration' : bigint,
}
export interface LoginDetails {
  'user_canister_pubkey' : Uint8Array | number[],
  'expiration' : bigint,
}
export type Result = { 'Ok' : string } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : Uint8Array | number[] } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : SignedDelegation } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : LoginDetails } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : SiwsMessage } |
  { 'Err' : string };
export type RuntimeFeature = { 'IncludeUriInSeed' : null } |
  { 'DisablePrincipalToSolMapping' : null } |
  { 'DisableSolToPrincipalMapping' : null };
export interface SettingsInput {
  'uri' : string,
  'runtime_features' : [] | [Array<RuntimeFeature>],
  'domain' : string,
  'statement' : [] | [string],
  'scheme' : [] | [string],
  'salt' : string,
  'session_expires_in' : [] | [bigint],
  'targets' : [] | [Array<string>],
  'chain_id' : [] | [string],
  'sign_in_expires_in' : [] | [bigint],
}
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface SiwsMessage {
  'uri' : string,
  'issued_at' : bigint,
  'domain' : string,
  'statement' : string,
  'version' : number,
  'chain_id' : string,
  'address' : string,
  'nonce' : string,
  'expiration_time' : bigint,
}
export interface _SERVICE {
  'get_address' : ActorMethod<[Uint8Array | number[]], Result>,
  'get_caller_address' : ActorMethod<[], Result>,
  'get_principal' : ActorMethod<[string], Result_1>,
  'siws_get_delegation' : ActorMethod<
    [string, Uint8Array | number[], bigint],
    Result_2
  >,
  'siws_login' : ActorMethod<[string, string, Uint8Array | number[]], Result_3>,
  'siws_prepare_login' : ActorMethod<[string], Result_4>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
