export const idlFactory = ({ IDL }) => {
  const TxId = IDL.Variant({
    'TransactionId' : IDL.Text,
    'BlockIndex' : IDL.Nat,
  });
  const AddLiquidityArgs = IDL.Record({
    'token_0' : IDL.Text,
    'token_1' : IDL.Text,
    'amount_0' : IDL.Nat,
    'amount_1' : IDL.Nat,
    'tx_id_0' : IDL.Opt(TxId),
    'tx_id_1' : IDL.Opt(TxId),
  });
  const SwapArgs = IDL.Record({
    'receive_token' : IDL.Text,
    'max_slippage' : IDL.Opt(IDL.Float64),
    'pay_amount' : IDL.Nat,
    'referred_by' : IDL.Opt(IDL.Text),
    'receive_amount' : IDL.Opt(IDL.Nat),
    'receive_address' : IDL.Opt(IDL.Text),
    'pay_token' : IDL.Text,
    'pay_tx_id' : IDL.Opt(TxId),
  });
  const AddPoolArgs = IDL.Record({
    'token_0' : IDL.Text,
    'token_1' : IDL.Text,
    'amount_0' : IDL.Nat,
    'amount_1' : IDL.Nat,
    'tx_id_0' : IDL.Opt(TxId),
    'tx_id_1' : IDL.Opt(TxId),
    'lp_fee_bps' : IDL.Opt(IDL.Nat8),
    'on_kong' : IDL.Opt(IDL.Bool),
  });
  const RemoveLiquidityArgs = IDL.Record({
    'token_0' : IDL.Text,
    'token_1' : IDL.Text,
    'remove_lp_token_amount' : IDL.Nat,
  });
  const RequestRequest = IDL.Variant({
    'AddLiquidity' : AddLiquidityArgs,
    'Swap' : SwapArgs,
    'AddPool' : AddPoolArgs,
    'RemoveLiquidity' : RemoveLiquidityArgs,
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
    'lp_fee_bps' : IDL.Nat8,
    'on_kong' : IDL.Bool,
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
  const RequestReply = IDL.Variant({
    'AddLiquidity' : AddLiquidityReply,
    'Swap' : SwapReply,
    'AddPool' : AddPoolReply,
    'RemoveLiquidity' : RemoveLiquidityReply,
    'Pending' : IDL.Null,
  });
  const RequestsReply = IDL.Record({
    'ts' : IDL.Nat64,
    'request_id' : IDL.Nat64,
    'request' : RequestRequest,
    'statuses' : IDL.Vec(IDL.Text),
    'reply' : RequestReply,
  });
  const RequestsResult = IDL.Variant({
    'Ok' : IDL.Vec(RequestsReply),
    'Err' : IDL.Text,
  });
  const TxsReply = IDL.Variant({
    'AddLiquidity' : AddLiquidityReply,
    'Swap' : SwapReply,
    'AddPool' : AddPoolReply,
    'RemoveLiquidity' : RemoveLiquidityReply,
  });
  const TxsResult = IDL.Variant({ 'Ok' : IDL.Vec(TxsReply), 'Err' : IDL.Text });
  const Icrc10SupportedStandards = IDL.Record({
    'url' : IDL.Text,
    'name' : IDL.Text,
  });
  const Icrc28TrustedOriginsResponse = IDL.Record({
    'trusted_origins' : IDL.Vec(IDL.Text),
  });
  return IDL.Service({
    'get_requests' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat32), IDL.Opt(IDL.Nat16)],
        [RequestsResult],
        ['query'],
      ),
    'get_txs' : IDL.Func(
        [
          IDL.Opt(IDL.Nat64),
          IDL.Opt(IDL.Nat64),
          IDL.Opt(IDL.Nat32),
          IDL.Opt(IDL.Nat16),
        ],
        [TxsResult],
        ['query'],
      ),
    'icrc10_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(Icrc10SupportedStandards)],
        ['query'],
      ),
    'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
    'icrc28_trusted_origins' : IDL.Func([], [Icrc28TrustedOriginsResponse], []),
    'requests' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat16)],
        [RequestsResult],
        ['query'],
      ),
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
