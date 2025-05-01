export const idlFactory = ({ IDL }) => {
  const RuntimeFeature = IDL.Variant({
    'IncludeUriInSeed' : IDL.Null,
    'DisablePrincipalToSolMapping' : IDL.Null,
    'DisableSolToPrincipalMapping' : IDL.Null,
  });
  const SettingsInput = IDL.Record({
    'uri' : IDL.Text,
    'runtime_features' : IDL.Opt(IDL.Vec(RuntimeFeature)),
    'domain' : IDL.Text,
    'statement' : IDL.Opt(IDL.Text),
    'scheme' : IDL.Opt(IDL.Text),
    'salt' : IDL.Text,
    'session_expires_in' : IDL.Opt(IDL.Nat64),
    'targets' : IDL.Opt(IDL.Vec(IDL.Text)),
    'chain_id' : IDL.Opt(IDL.Text),
    'sign_in_expires_in' : IDL.Opt(IDL.Nat64),
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Vec(IDL.Nat8), 'Err' : IDL.Text });
  const Delegation = IDL.Record({
    'pubkey' : IDL.Vec(IDL.Nat8),
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'expiration' : IDL.Nat64,
  });
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : Delegation,
  });
  const Result_2 = IDL.Variant({ 'Ok' : SignedDelegation, 'Err' : IDL.Text });
  const LoginDetails = IDL.Record({
    'user_canister_pubkey' : IDL.Vec(IDL.Nat8),
    'expiration' : IDL.Nat64,
  });
  const Result_3 = IDL.Variant({ 'Ok' : LoginDetails, 'Err' : IDL.Text });
  const SiwsMessage = IDL.Record({
    'uri' : IDL.Text,
    'issued_at' : IDL.Nat64,
    'domain' : IDL.Text,
    'statement' : IDL.Text,
    'version' : IDL.Nat32,
    'chain_id' : IDL.Text,
    'address' : IDL.Text,
    'nonce' : IDL.Text,
    'expiration_time' : IDL.Nat64,
  });
  const Result_4 = IDL.Variant({ 'Ok' : SiwsMessage, 'Err' : IDL.Text });
  return IDL.Service({
    'get_address' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], ['query']),
    'get_caller_address' : IDL.Func([], [Result], ['query']),
    'get_principal' : IDL.Func([IDL.Text], [Result_1], ['query']),
    'siws_get_delegation' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8), IDL.Nat64],
        [Result_2],
        ['query'],
      ),
    'siws_login' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Nat8)],
        [Result_3],
        [],
      ),
    'siws_prepare_login' : IDL.Func([IDL.Text], [Result_4], []),
  });
};
export const init = ({ IDL }) => {
  const RuntimeFeature = IDL.Variant({
    'IncludeUriInSeed' : IDL.Null,
    'DisablePrincipalToSolMapping' : IDL.Null,
    'DisableSolToPrincipalMapping' : IDL.Null,
  });
  const SettingsInput = IDL.Record({
    'uri' : IDL.Text,
    'runtime_features' : IDL.Opt(IDL.Vec(RuntimeFeature)),
    'domain' : IDL.Text,
    'statement' : IDL.Opt(IDL.Text),
    'scheme' : IDL.Opt(IDL.Text),
    'salt' : IDL.Text,
    'session_expires_in' : IDL.Opt(IDL.Nat64),
    'targets' : IDL.Opt(IDL.Vec(IDL.Text)),
    'chain_id' : IDL.Opt(IDL.Text),
    'sign_in_expires_in' : IDL.Opt(IDL.Nat64),
  });
  return [SettingsInput];
};
