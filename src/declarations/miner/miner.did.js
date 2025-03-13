export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const CycleMeasurement = IDL.Record({
    'balance' : IDL.Nat,
    'timestamp' : IDL.Nat64,
  });
  const CycleUsageStats = IDL.Record({
    'current_balance' : IDL.Nat,
    'usage_last_15min' : IDL.Opt(IDL.Nat),
    'measurements' : IDL.Vec(CycleMeasurement),
    'estimated_remaining_time' : IDL.Opt(IDL.Text),
    'usage_rate_per_hour' : IDL.Opt(IDL.Float64),
  });
  const MinerInfo = IDL.Record({
    'speed_percentage' : IDL.Nat8,
    'current_token' : IDL.Opt(IDL.Principal),
    'chunks_per_refresh' : IDL.Nat64,
    'chunk_size' : IDL.Nat64,
    'is_mining' : IDL.Bool,
  });
  const Result_1 = IDL.Variant({ 'Ok' : MinerInfo, 'Err' : IDL.Text });
  const MiningStats = IDL.Record({
    'total_hashes' : IDL.Nat64,
    'blocks_mined' : IDL.Nat64,
    'chunks_since_refresh' : IDL.Nat64,
    'total_rewards' : IDL.Nat64,
    'last_hash_rate' : IDL.Float64,
    'start_time' : IDL.Nat64,
  });
  return IDL.Service({
    'claim_rewards' : IDL.Func([], [Result], []),
    'connect_token' : IDL.Func([IDL.Principal], [Result], []),
    'disconnect_token' : IDL.Func([], [Result], []),
    'get_canister_id' : IDL.Func([], [IDL.Principal], ['query']),
    'get_cycle_usage' : IDL.Func([], [CycleUsageStats], ['query']),
    'get_info' : IDL.Func([], [Result_1], ['query']),
    'get_mining_stats' : IDL.Func([], [IDL.Opt(MiningStats)], ['query']),
    'set_chunk_size' : IDL.Func([IDL.Nat64], [Result], []),
    'set_mining_speed' : IDL.Func([IDL.Nat8], [Result], []),
    'set_template_refresh_interval' : IDL.Func([IDL.Nat64], [Result], []),
    'start_mining' : IDL.Func([], [Result], []),
    'stop_mining' : IDL.Func([], [Result], []),
  });
};
export const init = ({ IDL }) => { return [IDL.Record({})]; };
