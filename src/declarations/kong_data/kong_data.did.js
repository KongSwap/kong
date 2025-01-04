export const idlFactory = ({ IDL }) => {
  const Icrc10SupportedStandards = IDL.Record({
    'url' : IDL.Text,
    'name' : IDL.Text,
  });
  const Icrc28TrustedOriginsResponse = IDL.Record({
    'trusted_origins' : IDL.Vec(IDL.Text),
  });
  const PoolReply = IDL.Record({
    'tvl' : IDL.Nat,
    'lp_token_symbol' : IDL.Text,
    'name' : IDL.Text,
    'lp_fee_0' : IDL.Nat,
    'lp_fee_1' : IDL.Nat,
    'balance_0' : IDL.Nat,
    'balance_1' : IDL.Nat,
    'rolling_24h_volume' : IDL.Nat,
    'rolling_24h_apy' : IDL.Float64,
    'address_0' : IDL.Text,
    'address_1' : IDL.Text,
    'rolling_24h_num_swaps' : IDL.Nat,
    'symbol_0' : IDL.Text,
    'symbol_1' : IDL.Text,
    'pool_id' : IDL.Nat32,
    'price' : IDL.Float64,
    'chain_0' : IDL.Text,
    'chain_1' : IDL.Text,
    'is_removed' : IDL.Bool,
    'symbol' : IDL.Text,
    'rolling_24h_lp_fee' : IDL.Nat,
    'lp_fee_bps' : IDL.Nat8,
  });
  const PoolsReply = IDL.Record({
    'total_24h_lp_fee' : IDL.Nat,
    'total_tvl' : IDL.Nat,
    'total_24h_volume' : IDL.Nat,
    'pools' : IDL.Vec(PoolReply),
    'total_24h_num_swaps' : IDL.Nat,
  });
  const PoolsResult = IDL.Variant({ 'Ok' : PoolsReply, 'Err' : IDL.Text });
  const ICTokenReply = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'token_id' : IDL.Nat32,
    'chain' : IDL.Text,
    'name' : IDL.Text,
    'canister_id' : IDL.Text,
    'icrc1' : IDL.Bool,
    'icrc2' : IDL.Bool,
    'icrc3' : IDL.Bool,
    'is_removed' : IDL.Bool,
    'symbol' : IDL.Text,
  });
  const LPTokenReply = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'token_id' : IDL.Nat32,
    'chain' : IDL.Text,
    'name' : IDL.Text,
    'address' : IDL.Text,
    'pool_id_of' : IDL.Nat32,
    'is_removed' : IDL.Bool,
    'total_supply' : IDL.Nat,
    'symbol' : IDL.Text,
  });
  const TokenReply = IDL.Variant({ 'IC' : ICTokenReply, 'LP' : LPTokenReply });
  const TokensResult = IDL.Variant({
    'Ok' : IDL.Vec(TokenReply),
    'Err' : IDL.Text,
  });
  const ICTransferReply = IDL.Record({
    'is_send' : IDL.Bool,
    'block_index' : IDL.Nat,
    'chain' : IDL.Text,
    'canister_id' : IDL.Text,
    'amount' : IDL.Nat,
    'symbol' : IDL.Text,
  });
  const TransferReply = IDL.Variant({ 'IC' : ICTransferReply });
  const TransferIdReply = IDL.Record({
    'transfer_id' : IDL.Nat64,
    'transfer' : TransferReply,
  });
  const AddLiquidityReply = IDL.Record({
    'ts' : IDL.Nat64,
    'request_id' : IDL.Nat64,
    'status' : IDL.Text,
    'tx_id' : IDL.Nat64,
    'add_lp_token_amount' : IDL.Nat,
    'transfer_ids' : IDL.Vec(TransferIdReply),
    'amount_0' : IDL.Nat,
    'amount_1' : IDL.Nat,
    'claim_ids' : IDL.Vec(IDL.Nat64),
    'address_0' : IDL.Text,
    'address_1' : IDL.Text,
    'symbol_0' : IDL.Text,
    'symbol_1' : IDL.Text,
    'chain_0' : IDL.Text,
    'chain_1' : IDL.Text,
    'symbol' : IDL.Text,
  });
  const SwapTxReply = IDL.Record({
    'ts' : IDL.Nat64,
    'receive_chain' : IDL.Text,
    'pay_amount' : IDL.Nat,
    'receive_amount' : IDL.Nat,
    'pay_symbol' : IDL.Text,
    'receive_symbol' : IDL.Text,
    'receive_address' : IDL.Text,
    'pool_symbol' : IDL.Text,
    'pay_address' : IDL.Text,
    'price' : IDL.Float64,
    'pay_chain' : IDL.Text,
    'lp_fee' : IDL.Nat,
    'gas_fee' : IDL.Nat,
  });
  const SwapReply = IDL.Record({
    'ts' : IDL.Nat64,
    'txs' : IDL.Vec(SwapTxReply),
    'request_id' : IDL.Nat64,
    'status' : IDL.Text,
    'tx_id' : IDL.Nat64,
    'transfer_ids' : IDL.Vec(TransferIdReply),
    'receive_chain' : IDL.Text,
    'mid_price' : IDL.Float64,
    'pay_amount' : IDL.Nat,
    'receive_amount' : IDL.Nat,
    'claim_ids' : IDL.Vec(IDL.Nat64),
    'pay_symbol' : IDL.Text,
    'receive_symbol' : IDL.Text,
    'receive_address' : IDL.Text,
    'pay_address' : IDL.Text,
    'price' : IDL.Float64,
    'pay_chain' : IDL.Text,
    'slippage' : IDL.Float64,
  });
  const AddPoolReply = IDL.Record({
    'ts' : IDL.Nat64,
    'request_id' : IDL.Nat64,
    'status' : IDL.Text,
    'tx_id' : IDL.Nat64,
    'lp_token_symbol' : IDL.Text,
    'add_lp_token_amount' : IDL.Nat,
    'transfer_ids' : IDL.Vec(TransferIdReply),
    'name' : IDL.Text,
    'amount_0' : IDL.Nat,
    'amount_1' : IDL.Nat,
    'claim_ids' : IDL.Vec(IDL.Nat64),
    'address_0' : IDL.Text,
    'address_1' : IDL.Text,
    'symbol_0' : IDL.Text,
    'symbol_1' : IDL.Text,
    'pool_id' : IDL.Nat32,
    'chain_0' : IDL.Text,
    'chain_1' : IDL.Text,
    'is_removed' : IDL.Bool,
    'symbol' : IDL.Text,
    'lp_fee_bps' : IDL.Nat8,
  });
  const RemoveLiquidityReply = IDL.Record({
    'ts' : IDL.Nat64,
    'request_id' : IDL.Nat64,
    'status' : IDL.Text,
    'tx_id' : IDL.Nat64,
    'transfer_ids' : IDL.Vec(TransferIdReply),
    'lp_fee_0' : IDL.Nat,
    'lp_fee_1' : IDL.Nat,
    'amount_0' : IDL.Nat,
    'amount_1' : IDL.Nat,
    'claim_ids' : IDL.Vec(IDL.Nat64),
    'address_0' : IDL.Text,
    'address_1' : IDL.Text,
    'symbol_0' : IDL.Text,
    'symbol_1' : IDL.Text,
    'chain_0' : IDL.Text,
    'chain_1' : IDL.Text,
    'remove_lp_token_amount' : IDL.Nat,
    'symbol' : IDL.Text,
  });
  const TxsReply = IDL.Variant({
    'AddLiquidity' : AddLiquidityReply,
    'Swap' : SwapReply,
    'AddPool' : AddPoolReply,
    'RemoveLiquidity' : RemoveLiquidityReply,
  });
  const TxsResult = IDL.Variant({ 'Ok' : IDL.Vec(TxsReply), 'Err' : IDL.Text });
  return IDL.Service({
    'icrc10_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(Icrc10SupportedStandards)],
        ['query'],
      ),
    'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
    'icrc28_trusted_origins' : IDL.Func([], [Icrc28TrustedOriginsResponse], []),
    'pools' : IDL.Func([IDL.Opt(IDL.Text)], [PoolsResult], ['query']),
    'tokens' : IDL.Func([IDL.Opt(IDL.Text)], [TokensResult], ['query']),
    'txs' : IDL.Func(
        [
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Nat64),
          IDL.Opt(IDL.Nat32),
          IDL.Opt(IDL.Nat16),
        ],
        [TxsResult],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
