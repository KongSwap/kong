export const idlFactory = ({ IDL }) => {
  const MinerInitArgs = IDL.Record({
    'pow_backend' : IDL.Principal,
    'owner' : IDL.Principal,
    'launchpad' : IDL.Principal,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const BlockTemplate = IDL.Record({
    'height' : IDL.Nat64,
    'difficulty' : IDL.Nat32,
    'prev_hash' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Nat32,
    'merkle_root' : IDL.Vec(IDL.Nat8),
    'target' : IDL.Vec(IDL.Nat8),
    'nonce' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
  });
  const MiningResult = IDL.Record({
    'miner' : IDL.Principal,
    'solution_hash' : IDL.Vec(IDL.Nat8),
    'nonce' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'block_height' : IDL.Nat64,
  });
  const MinerInfo = IDL.Record({
    'speed_percentage' : IDL.Nat16,
    'current_token' : IDL.Opt(IDL.Principal),
    'chunk_size' : IDL.Nat64,
    'is_mining' : IDL.Bool,
  });
  const Result_2 = IDL.Variant({ 'Ok' : MinerInfo, 'Err' : IDL.Text });
  const MiningStats = IDL.Record({
    'total_hashes' : IDL.Nat64,
    'blocks_mined' : IDL.Nat64,
    'total_rewards' : IDL.Nat64,
    'last_hash_rate' : IDL.Float64,
    'start_time' : IDL.Nat64,
  });
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'status_code' : IDL.Nat16,
  });
  const Result_3 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  return IDL.Service({
    'claim_rewards' : IDL.Func([], [Result], []),
    'connect_token' : IDL.Func([IDL.Principal], [Result_1], []),
    'disconnect_token' : IDL.Func([], [Result_1], []),
    'find_solution_in_range' : IDL.Func(
        [BlockTemplate, IDL.Nat64, IDL.Nat64],
        [IDL.Opt(MiningResult)],
        ['query'],
      ),
    'get_canister_id' : IDL.Func([], [IDL.Principal], ['query']),
    'get_info' : IDL.Func([], [Result_2], ['query']),
    'get_mining_stats' : IDL.Func([], [MiningStats], ['query']),
    'get_remaining_hashes' : IDL.Func([], [IDL.Nat], ['query']),
    'get_time_remaining_estimate' : IDL.Func([], [IDL.Text], ['query']),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'icrc1_version' : IDL.Func([], [IDL.Text], ['query']),
    'set_chunk_size' : IDL.Func([IDL.Nat64], [Result_1], []),
    'set_max_chunk_duration' : IDL.Func([IDL.Nat64], [Result_1], []),
    'set_mining_speed' : IDL.Func([IDL.Nat16], [Result_1], []),
    'start_mining' : IDL.Func([], [Result_1], []),
    'stop_mining' : IDL.Func([], [Result_1], []),
    'top_up' : IDL.Func([IDL.Nat], [Result_3], []),
  });
};
export const init = ({ IDL }) => {
  const MinerInitArgs = IDL.Record({
    'pow_backend' : IDL.Principal,
    'owner' : IDL.Principal,
    'launchpad' : IDL.Principal,
  });
  return [MinerInitArgs];
};
