export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Principal, 'Err' : IDL.Text });
  const ChainType = IDL.Variant({
    'BTC' : IDL.Null,
    'ICP' : IDL.Null,
    'SOL' : IDL.Null,
    'SUI' : IDL.Null,
  });
  const Result_3 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const MinerInfo = IDL.Record({
    'creator' : IDL.Principal,
    'canister_id' : IDL.Principal,
    'pow_backend_id' : IDL.Principal,
  });
  const TokenInfo = IDL.Record({
    'creator' : IDL.Principal,
    'ticker' : IDL.Text,
    'name' : IDL.Text,
    'canister_id' : IDL.Principal,
    'total_supply' : IDL.Nat64,
  });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Vec(IDL.Nat8)),
    'Err' : IDL.Text,
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  return IDL.Service({
    'add_trusted_hash' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'claim_kong' : IDL.Func([IDL.Nat], [Result_1], []),
    'create_miner' : IDL.Func(
        [IDL.Principal, IDL.Opt(IDL.Principal)],
        [Result_2],
        [],
      ),
    'create_token' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Nat64,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Nat8),
          IDL.Opt(IDL.Nat64),
          IDL.Nat64,
          IDL.Nat64,
          IDL.Nat64,
          ChainType,
          IDL.Opt(IDL.Principal),
        ],
        [Result_2],
        [],
      ),
    'get_top_up_quote' : IDL.Func([IDL.Nat], [Result_3], ['query']),
    'list_miners' : IDL.Func([], [IDL.Vec(MinerInfo)], ['query']),
    'list_tokens' : IDL.Func([], [IDL.Vec(TokenInfo)], ['query']),
    'list_trusted_hashes' : IDL.Func([], [Result_4], ['query']),
    'remove_trusted_hash' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_5], []),
    'top_up_miner' : IDL.Func([IDL.Principal, IDL.Nat], [Result_3], []),
    'validate_hash' : IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Bool], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
