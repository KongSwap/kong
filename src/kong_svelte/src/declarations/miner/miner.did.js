export const idlFactory = ({ IDL }) => {
  const MinerType = IDL.Variant({
    'Lite': IDL.Null,
    'Normal': IDL.Null,
    'Premium': IDL.Null
  });
  
  const MinerStats = IDL.Record({
    'totalHashRate': IDL.Nat,
    'totalBlocks': IDL.Nat,
    'totalRewards': IDL.Nat
  });
  
  return IDL.Service({
    'getOwner': IDL.Func([], [IDL.Principal], ['query']),
    'getMinerType': IDL.Func([], [MinerType], ['query']),
    'getMinerStats': IDL.Func([], [MinerStats], ['query'])
  });
}; 
