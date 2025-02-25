export const idlFactory = ({ IDL }) => {
  const TxId = IDL.Variant({
    'TransactionId' : IDL.Text,
    'BlockIndex' : IDL.Nat,
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
  const SwapResult = IDL.Variant({ 'Ok' : SwapReply, 'Err' : IDL.Text });
  const SwapAmountsTxReply = IDL.Record({
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
  const SwapAmountsReply = IDL.Record({
    'txs' : IDL.Vec(SwapAmountsTxReply),
    'receive_chain' : IDL.Text,
    'mid_price' : IDL.Float64,
    'pay_amount' : IDL.Nat,
    'receive_amount' : IDL.Nat,
    'pay_symbol' : IDL.Text,
    'receive_symbol' : IDL.Text,
    'receive_address' : IDL.Text,
    'pay_address' : IDL.Text,
    'price' : IDL.Float64,
    'pay_chain' : IDL.Text,
    'slippage' : IDL.Float64,
  });
  const SwapAmountsResult = IDL.Variant({
    'Ok' : SwapAmountsReply,
    'Err' : IDL.Text,
  });
  const SwapAsyncResult = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text });

  return IDL.Service({
    'swap' : IDL.Func([SwapArgs], [SwapResult], []),
    'swap_amounts' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Text],
        [SwapAmountsResult],
        ['query'],
      ),
    'swap_async' : IDL.Func([SwapArgs], [SwapAsyncResult], []),
  });
};
export const init = ({ IDL }) => { return []; };