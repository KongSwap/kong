export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const TransactionNotification = IDL.Record({
    'status' : IDL.Text,
    'signature' : IDL.Text,
    'metadata' : IDL.Opt(IDL.Text),
  });
  const IcpTransferStatus = IDL.Variant({
    'Failed' : IDL.Null,
    'InProgress' : IDL.Null,
    'Completed' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const IcpTransferJob = IDL.Record({
    'id' : IDL.Nat64,
    'status' : IcpTransferStatus,
    'updated_at' : IDL.Nat64,
    'to_principal' : IDL.Principal,
    'block_index' : IDL.Opt(IDL.Nat64),
    'error_message' : IDL.Opt(IDL.Text),
    'attempts' : IDL.Nat32,
    'created_at' : IDL.Nat64,
    'from_principal' : IDL.Opt(IDL.Principal),
    'amount' : IDL.Nat64,
  });
  const SwapJobStatus = IDL.Variant({
    'Failed' : IDL.Null,
    'Confirmed' : IDL.Null,
    'Submitted' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const SwapJob = IDL.Record({
    'id' : IDL.Nat64,
    'status' : SwapJobStatus,
    'updated_at' : IDL.Nat64,
    'error_message' : IDL.Opt(IDL.Text),
    'attempts' : IDL.Nat32,
    'created_at' : IDL.Nat64,
    'original_args_json' : IDL.Text,
    'solana_tx_signature_of_payout' : IDL.Opt(IDL.Text),
    'encoded_signed_solana_tx' : IDL.Text,
  });
  const TransactionQueueItem = IDL.Record({
    'id' : IDL.Nat64,
    'fee' : IDL.Opt(IDL.Nat64),
    'is_processed' : IDL.Bool,
    'direction' : IDL.Opt(IDL.Text),
    'signature' : IDL.Text,
    'metadata' : IDL.Opt(IDL.Text),
    'instruction_type' : IDL.Opt(IDL.Text),
    'sender' : IDL.Opt(IDL.Text),
    'balance_change' : IDL.Opt(IDL.Nat64),
    'processed_at' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Opt(IDL.Nat64),
    'queued_at' : IDL.Nat64,
    'receiver' : IDL.Opt(IDL.Text),
  });
  const TxId = IDL.Variant({
    'TransactionHash' : IDL.Text,
    'BlockIndex' : IDL.Nat,
  });
  const SwapArgs = IDL.Record({
    'receive_token' : IDL.Text,
    'signature' : IDL.Opt(IDL.Text),
    'max_slippage' : IDL.Opt(IDL.Float64),
    'pay_amount' : IDL.Nat,
    'referred_by' : IDL.Opt(IDL.Text),
    'receive_amount' : IDL.Opt(IDL.Nat),
    'receive_address' : IDL.Opt(IDL.Text),
    'timestamp' : IDL.Opt(IDL.Nat64),
    'pay_token' : IDL.Text,
    'pay_tx_id' : IDL.Opt(TxId),
    'pay_address' : IDL.Opt(IDL.Text),
  });
  const QueuedSwapReply = IDL.Record({
    'status' : IDL.Text,
    'job_id' : IDL.Nat64,
    'message' : IDL.Text,
  });
  const Result_2 = IDL.Variant({ 'Ok' : QueuedSwapReply, 'Err' : IDL.Text });
  const UpdateSolanaTransactionArgs = IDL.Record({
    'status' : IDL.Text,
    'signature' : IDL.Text,
    'metadata' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'cache_solana_address' : IDL.Func([], [Result], []),
    'finalize_swap_job' : IDL.Func(
        [IDL.Nat64, IDL.Text, IDL.Bool, IDL.Opt(IDL.Text)],
        [Result_1],
        [],
      ),
    'get_all_solana_transactions' : IDL.Func(
        [],
        [IDL.Vec(TransactionNotification)],
        ['query'],
      ),
    'get_icp_job' : IDL.Func([IDL.Nat64], [IDL.Opt(IcpTransferJob)], ['query']),
    'get_icp_jobs_for_caller' : IDL.Func(
        [],
        [IDL.Vec(IcpTransferJob)],
        ['query'],
      ),
    'get_pending_icp_jobs' : IDL.Func(
        [IDL.Nat32],
        [IDL.Vec(IcpTransferJob)],
        ['query'],
      ),
    'get_pending_swap_jobs' : IDL.Func(
        [IDL.Nat32],
        [IDL.Vec(SwapJob)],
        ['query'],
      ),
    'get_solana_address' : IDL.Func([], [Result], ['query']),
    'get_solana_transaction' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(TransactionNotification)],
        ['query'],
      ),
    'get_swap_job' : IDL.Func([IDL.Nat64], [IDL.Opt(SwapJob)], ['query']),
    'get_transactions' : IDL.Func(
        [IDL.Nat64, IDL.Nat32],
        [IDL.Vec(TransactionQueueItem)],
        ['query'],
      ),
    'mark_swap_job_submitted' : IDL.Func([IDL.Nat64, IDL.Text], [Result_1], []),
    'mark_transactions_processed' : IDL.Func(
        [IDL.Vec(IDL.Nat64)],
        [Result_1],
        [],
      ),
    'receive_solana_transaction_notification' : IDL.Func(
        [TransactionNotification],
        [Result_1],
        [],
      ),
    'swap' : IDL.Func([SwapArgs], [Result_2], []),
    'update_latest_blockhash' : IDL.Func([IDL.Text], [Result_1], []),
    'update_solana_transaction' : IDL.Func(
        [UpdateSolanaTransactionArgs],
        [Result_1],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
