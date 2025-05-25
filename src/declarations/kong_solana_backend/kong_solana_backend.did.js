export const idlFactory = ({ IDL }) => {
  const SolanaTransactionStatus = IDL.Variant({
    'Failed' : IDL.Null,
    'Finalized' : IDL.Null,
    'Confirmed' : IDL.Null,
    'TimedOut' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const SolanaTransaction = IDL.Record({
    'id' : IDL.Text,
    'fee' : IDL.Opt(IDL.Nat64),
    'status' : SolanaTransactionStatus,
    'updated_at' : IDL.Nat64,
    'direction' : IDL.Opt(IDL.Text),
    'signature' : IDL.Text,
    'transaction_time' : IDL.Opt(IDL.Text),
    'metadata' : IDL.Opt(IDL.Text),
    'instruction_type' : IDL.Opt(IDL.Text),
    'sender' : IDL.Opt(IDL.Text),
    'balance_change' : IDL.Opt(IDL.Nat64),
    'registered_at' : IDL.Nat64,
    'amount' : IDL.Opt(IDL.Nat64),
    'receiver' : IDL.Opt(IDL.Text),
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
  const QueuedTransaction = IDL.Record({
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
    'job_id' : IDL.Opt(IDL.Nat64),
    'message' : IDL.Text,
  });
  const SwapResult = IDL.Variant({ 'Ok' : QueuedSwapReply, 'Err' : IDL.Text });
  const UpdateSolanaTransactionArgs = IDL.Record({
    'id' : IDL.Text,
    'fee' : IDL.Opt(IDL.Nat64),
    'status' : IDL.Text,
    'direction' : IDL.Opt(IDL.Text),
    'signature' : IDL.Text,
    'transaction_time' : IDL.Opt(IDL.Text),
    'metadata' : IDL.Opt(IDL.Text),
    'instruction_type' : IDL.Opt(IDL.Text),
    'sender' : IDL.Opt(IDL.Text),
    'balance_change' : IDL.Opt(IDL.Nat64),
    'skip_queue' : IDL.Bool,
    'amount' : IDL.Opt(IDL.Nat64),
    'receiver' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'add_authorized_principal_with_role' : IDL.Func(
        [IDL.Principal, IDL.Text],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'cache_solana_address' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'finalize_swap_job' : IDL.Func(
        [IDL.Nat64, IDL.Text, IDL.Bool, IDL.Opt(IDL.Text)],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'get_all_solana_txs' : IDL.Func(
        [],
        [IDL.Vec(SolanaTransaction)],
        ['query'],
      ),
    'get_authorization_info' : IDL.Func([], [IDL.Text], ['query']),
    'get_pending_swap_jobs' : IDL.Func(
        [IDL.Nat32],
        [IDL.Vec(SwapJob)],
        ['query'],
      ),
    'get_security_stats' : IDL.Func([], [IDL.Text], ['query']),
    'get_solana_address' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_solana_tx' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(SolanaTransaction)],
        ['query'],
      ),
    'get_swap_job' : IDL.Func([IDL.Nat64], [IDL.Opt(SwapJob)], ['query']),
    'get_transactions' : IDL.Func(
        [IDL.Nat64, IDL.Nat32],
        [IDL.Vec(QueuedTransaction)],
        ['query'],
      ),
    'list_authorized_principals_in_canister' : IDL.Func(
        [],
        [
          IDL.Variant({
            'Ok' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text)),
            'Err' : IDL.Text,
          }),
        ],
        ['query'],
      ),
    'mark_swap_job_submitted' : IDL.Func(
        [IDL.Nat64, IDL.Text],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'mark_transactions_processed' : IDL.Func(
        [IDL.Vec(IDL.Nat64)],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'remove_authorized_principal_from_canister' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'swap' : IDL.Func([SwapArgs], [SwapResult], []),
    'update_latest_blockhash' : IDL.Func(
        [IDL.Text],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'update_solana_tx' : IDL.Func(
        [UpdateSolanaTransactionArgs],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
