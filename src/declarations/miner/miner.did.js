export const idlFactory = ({ IDL }) => {
  const MinerInitArgs = IDL.Record({ 'owner' : IDL.Principal });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const MinerInfo = IDL.Record({
    'owner' : IDL.Principal,
    'current_token' : IDL.Opt(IDL.Principal),
    'is_mining' : IDL.Bool,
  });
  const Result_1 = IDL.Variant({ 'Ok' : MinerInfo, 'Err' : IDL.Text });
  const MiningStats = IDL.Record({
    'total_hashes' : IDL.Nat64,
    'blocks_mined' : IDL.Nat64,
    'total_rewards' : IDL.Nat64,
    'last_hash_rate' : IDL.Float64,
    'start_time' : IDL.Nat64,
  });
  const MinerType = IDL.Variant({
    'Premium' : IDL.Null,
    'Lite' : IDL.Null,
    'Normal' : IDL.Null,
  });
  return IDL.Service({
    'claim_rewards' : IDL.Func([], [Result], []),
    'connect_token' : IDL.Func([IDL.Principal], [Result], []),
    'disconnect_token' : IDL.Func([], [Result], []),
    'get_info' : IDL.Func([], [Result_1], ['query']),
    'get_mining_stats' : IDL.Func([], [IDL.Opt(MiningStats)], ['query']),
    'start_mining' : IDL.Func([], [Result], []),
    'stop_mining' : IDL.Func([], [Result], []),
    'transform_miner' : IDL.Func([MinerType], [Result], []),
  });
};
export const init = ({ IDL }) => {
  const MinerInitArgs = IDL.Record({ 'owner' : IDL.Principal });
  return [MinerInitArgs];
};
