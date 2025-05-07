import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Anonymizable = { 'Anonymize' : string } |
  { 'Public' : string };
export interface EventsArgs { 'start' : bigint, 'length' : bigint }
export interface EventsResponse {
  'events' : Array<IndexedEvent>,
  'latest_event_index' : [] | [bigint],
}
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'upgrade' : [] | [boolean],
  'status_code' : number,
}
export interface IdempotentEvent {
  'source' : [] | [Anonymizable],
  'name' : string,
  'user' : [] | [Anonymizable],
  'timestamp' : bigint,
  'payload' : Uint8Array | number[],
  'idempotency_key' : bigint,
}
export interface IndexedEvent {
  'source' : [] | [string],
  'name' : string,
  'user' : [] | [string],
  'timestamp' : bigint,
  'index' : bigint,
  'payload' : Uint8Array | number[],
}
export interface InitArgs {
  'push_events_whitelist' : Array<Principal>,
  'read_events_whitelist' : Array<Principal>,
  'time_granularity' : [] | [bigint],
}
export interface PushEventsArgs { 'events' : Array<IdempotentEvent> }
export interface WhitelistedPrincipals {
  'push' : Array<Principal>,
  'read' : Array<Principal>,
}
export interface _SERVICE {
  'events' : ActorMethod<[EventsArgs], EventsResponse>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'push_events' : ActorMethod<[PushEventsArgs], undefined>,
  'whitelisted_principals' : ActorMethod<[], WhitelistedPrincipals>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
