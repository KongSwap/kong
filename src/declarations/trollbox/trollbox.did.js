export const idlFactory = ({ IDL }) => {
  const Message = IDL.Record({
    'id' : IDL.Nat64,
    'principal' : IDL.Principal,
    'created_at' : IDL.Nat64,
    'message' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : Message, 'Err' : IDL.Text });
  const PaginationParams = IDL.Record({
    'cursor' : IDL.Opt(IDL.Nat64),
    'limit' : IDL.Opt(IDL.Nat64),
  });
  const MessagesPage = IDL.Record({
    'messages' : IDL.Vec(Message),
    'next_cursor' : IDL.Opt(IDL.Nat64),
  });
  const ICRC21ConsentMessageRequest = IDL.Record({
    'method' : IDL.Text,
    'canister' : IDL.Principal,
  });
  const ICRC21ConsentMessageResponse = IDL.Record({
    'consent_message' : IDL.Text,
  });
  const Icrc28TrustedOriginsResponse = IDL.Record({
    'trusted_origins' : IDL.Vec(IDL.Text),
  });
  const DelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
    'expiration' : IDL.Opt(IDL.Nat64),
  });
  const Delegation = IDL.Record({
    'created' : IDL.Nat64,
    'targets_list_hash' : IDL.Vec(IDL.Nat8),
    'target' : IDL.Principal,
    'expiration' : IDL.Opt(IDL.Nat64),
  });
  const DelegationResponse = IDL.Record({
    'delegations' : IDL.Vec(Delegation),
  });
  const DelegationError = IDL.Variant({
    'NotFound' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'StorageError' : IDL.Text,
    'Expired' : IDL.Null,
  });
  const Result_1 = IDL.Variant({
    'Ok' : DelegationResponse,
    'Err' : DelegationError,
  });
  const RevokeDelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
  });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : DelegationError });
  return IDL.Service({
    'create_message' : IDL.Func([IDL.Text], [Result], []),
    'get_message' : IDL.Func([IDL.Nat64], [IDL.Opt(Message)], ['query']),
    'get_messages' : IDL.Func(
        [IDL.Opt(PaginationParams)],
        [MessagesPage],
        ['query'],
      ),
    'icrc21_canister_call_consent_message' : IDL.Func(
        [ICRC21ConsentMessageRequest],
        [ICRC21ConsentMessageResponse],
        ['query'],
      ),
    'icrc28_trusted_origins' : IDL.Func(
        [],
        [Icrc28TrustedOriginsResponse],
        ['query'],
      ),
    'icrc_34_delegate' : IDL.Func([DelegationRequest], [Result_1], []),
    'icrc_34_get_delegation' : IDL.Func(
        [DelegationRequest],
        [Result_1],
        ['query'],
      ),
    'icrc_34_revoke_delegation' : IDL.Func(
        [RevokeDelegationRequest],
        [Result_2],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
