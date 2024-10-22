import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type ClaimResult = { 'Ok' : string } |
  { 'Err' : string };
export interface _SERVICE { 'claim' : ActorMethod<[], ClaimResult> }
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
