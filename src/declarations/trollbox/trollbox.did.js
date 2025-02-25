export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const Message = IDL.Record({
    'id' : IDL.Nat64,
    'principal' : IDL.Principal,
    'created_at' : IDL.Nat64,
    'message' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'Ok' : Message, 'Err' : IDL.Text });
  const PaginationParams = IDL.Record({
    'cursor' : IDL.Opt(IDL.Nat64),
    'limit' : IDL.Opt(IDL.Nat64),
  });
  const MessagesPage = IDL.Record({
    'messages' : IDL.Vec(Message),
    'next_cursor' : IDL.Opt(IDL.Nat64),
  });
  const ConsentMessageMetadata = IDL.Record({
    'utc_offset_minutes' : IDL.Opt(IDL.Int16),
    'language' : IDL.Text,
  });
  const DisplayMessageType = IDL.Variant({
    'GenericDisplay' : IDL.Null,
    'LineDisplay' : IDL.Record({
      'characters_per_line' : IDL.Nat16,
      'lines_per_page' : IDL.Nat16,
    }),
  });
  const ConsentMessageSpec = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'device_spec' : IDL.Opt(DisplayMessageType),
  });
  const ConsentMessageRequest = IDL.Record({
    'arg' : IDL.Vec(IDL.Nat8),
    'method' : IDL.Text,
    'user_preferences' : ConsentMessageSpec,
  });
  const LineDisplayPage = IDL.Record({ 'lines' : IDL.Vec(IDL.Text) });
  const ConsentMessage = IDL.Variant({
    'LineDisplayMessage' : IDL.Record({ 'pages' : IDL.Vec(LineDisplayPage) }),
    'GenericDisplayMessage' : IDL.Text,
  });
  const ConsentInfo = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'consent_message' : ConsentMessage,
  });
  const ErrorInfo = IDL.Record({ 'description' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : ConsentInfo, 'Err' : ErrorInfo });
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
  const Result_3 = IDL.Variant({
    'Ok' : DelegationResponse,
    'Err' : DelegationError,
  });
  const RevokeDelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
  });
  const Result_4 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : DelegationError });
  return IDL.Service({
    'add_admin' : IDL.Func([IDL.Principal], [Result], []),
    'ban_user' : IDL.Func([IDL.Principal, IDL.Nat64], [Result], []),
    'check_ban_status' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(IDL.Nat64)],
        ['query'],
      ),
    'create_message' : IDL.Func([IDL.Text], [Result_1], []),
    'delete_message' : IDL.Func([IDL.Nat64], [Result], []),
    'get_message' : IDL.Func([IDL.Nat64], [IDL.Opt(Message)], ['query']),
    'get_messages' : IDL.Func(
        [IDL.Opt(PaginationParams)],
        [MessagesPage],
        ['query'],
      ),
    'icrc21_canister_call_consent_message' : IDL.Func(
        [ConsentMessageRequest],
        [Result_2],
        ['query'],
      ),
    'icrc28_trusted_origins' : IDL.Func(
        [],
        [Icrc28TrustedOriginsResponse],
        ['query'],
      ),
    'icrc_34_delegate' : IDL.Func([DelegationRequest], [Result_3], []),
    'icrc_34_get_delegation' : IDL.Func(
        [DelegationRequest],
        [Result_3],
        ['query'],
      ),
    'icrc_34_revoke_delegation' : IDL.Func(
        [RevokeDelegationRequest],
        [Result_4],
        [],
      ),
    'is_admin' : IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'unban_user' : IDL.Func([IDL.Principal], [Result], []),
  });
};
export const init = ({ IDL }) => { return []; };
