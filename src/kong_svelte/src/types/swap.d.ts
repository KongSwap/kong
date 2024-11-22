declare global {
  namespace BE {
    interface SwapTx {
      ts: bigint;
      receive_chain: string;
      pay_amount: bigint;
      receive_amount: bigint;
      pay_symbol: string;
      receive_symbol: string;
      pool_symbol: string;
      price: number;
      pay_chain: string;
      lp_fee: bigint;
      gas_fee: bigint;
    }
  
    interface SwapQuoteResponse {
      Ok?: {
        txs: SwapTx[];
        receive_chain: string;
        mid_price: number;
        pay_amount: bigint;
        receive_amount: bigint;
        pay_symbol: string;
        receive_symbol: string;
        receive_address: string;
        pay_address: string;
        price: number;
        pay_chain: string;
        slippage: number;
      };
      Err?: string;
    }
  
    interface SwapAsyncResponse {
      Ok?: bigint;
      Err?: string;
    }
  
    interface TransferInfo {
      transfer_id: bigint;
      transfer: {
        IC: {
          is_send: boolean;
          block_index: bigint;
          chain: string;
          canister_id: string;
          amount: bigint;
          symbol: string;
        }
      }
    }
  
    interface SwapReply {
      Swap: {
        ts: bigint;
        txs: SwapTx[];
        request_id: bigint;
        status: string;
        tx_id: bigint;
        transfer_ids: TransferInfo[];
        receive_chain: string;
      }
    }

    interface RequestResponse {
      Ok?: Array<{
        ts: bigint;
        request_id: bigint;
        request: any;
        statuses: string[];
        reply: SwapReply | { Pending: null };
      }>;
      Err?: string;
    }
  }
}

export {};
