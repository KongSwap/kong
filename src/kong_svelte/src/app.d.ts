// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  interface CanisterIdIcpLedger {
    [key: string]: any;
  }
  
  const CANISTER_ID_ICP_LEDGER: CanisterIdIcpLedger;
  
  namespace FE {
    interface TokenBalance {
      in_tokens: bigint;
      in_usd: string;
    }

    interface Token {
      canister_id: string;
      name: string;
      symbol: string;
      fee: bigint;
      decimals: number;
      token: string;
      token_id: number;
      chain: string;
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      on_kong: boolean;
      pool_symbol: string;
      logo?: string;
      total_24h_volume?: bigint;
      price?: number;
      tvl?: number;
      balance?: bigint;
    }

    interface UserPoolBalance {
      amount_0: bigint;
      amount_1: bigint;
      balance: bigint;
      name: string;
      symbol: string;
      symbol_0: string;
      symbol_1: string;
      ts: bigint;
      usd_amount_0: number;
      usd_amount_1: number;
      usd_balance: number;
    }

    interface Transaction {
      type: 'send' | 'receive';
      amount: string;
      token: string;
      to?: string;
      from?: string;
      date: string;
    }
  }

  namespace BE {
    interface ICToken {
      symbol: string;
      fee: bigint;
      decimals: number;
      token: string;
      token_id: number;
      chain: string;
      name: string;
      canister_id: string;
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      pool_symbol: string;
      on_kong: boolean;
    }
  
    interface LPToken {
      address: string;
      chain: string;
      decimals: number;
      fee: bigint;
      name: string;
      on_kong: boolean;
      pool_id_of: number;
      pool_symbol: string;
      symbol: string;
      token: string;
      token_id: number;
      total_supply: bigint;
    }
  
    type Token = { IC: ICToken } | { LP: LPToken };

    // Pool Types
  
   type PoolResponse = {
      pools: Pool[];
      total_tvl: bigint;
      total_24h_volume: bigint;
      total_24h_lp_fee: bigint;
  }
  
   interface Pool {
      lp_token_symbol: string;
      balance: bigint;
      total_lp_fee: bigint;
      name: string;
      lp_fee_0: bigint;
      lp_fee_1: bigint;
      balance_0: bigint;
      balance_1: bigint;
      rolling_24h_volume: bigint;
      rolling_24h_apy: number;
      address_0: string;
      address_1: string;
      symbol_0: string;
      symbol_1: string;
      total_volume: bigint;
      pool_id: number;
      price: number;
      chain_0: string;
      chain_1: string;
      lp_token_supply: bigint;
      symbol: string;
      lp_fee_bps: number;
      on_kong: boolean;
  }
  
  // Swap Types
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
  
  // Request Status Types
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
          mid_price: number;
          pay_amount: bigint;
          receive_amount: bigint;
          claim_ids: bigint[];
          pay_symbol: string;
          receive_symbol: string;
          price: number;
          pay_chain: string;
          slippage: number;
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
  
  // User Types
   interface User {
      account_id: string;
      user_name: string;
      fee_level_expires_at?: bigint;
      referred_by?: string;
      user_id: number;
      fee_level: number;
      principal_id: string;
      referred_by_expires_at?: bigint;
      campaign1_flags: boolean[];
      my_referral_code: string;
    }
  }
}

export {};
