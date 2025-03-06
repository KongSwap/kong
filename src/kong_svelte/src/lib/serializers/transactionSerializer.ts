// TransactionSerializer.ts
// Serializer for transaction data

import { BaseSerializer } from './BaseSerializer';

/**
 * Safely converts a value to string
 * @param value - The value to convert
 * @returns string value or empty string if conversion fails
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  try {
    return String(value);
  } catch (error) {
    console.error('Error converting to string:', error);
    return '';
  }
}

/**
 * Safely formats a token amount by removing underscores and adjusting for decimals
 * @param amount - The amount to format
 * @param decimals - The number of decimals for the token
 * @returns Formatted amount as string
 */
function formatTokenAmount(amount: unknown, decimals: number): string {
  if (amount === null || amount === undefined) return '0';
  
  try {
    const cleanAmount = toString(amount).replace(/_/g, '');
    if (!cleanAmount) return '0';
    
    return (Number(cleanAmount) / Math.pow(10, decimals)).toString();
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
}

export class TransactionSerializer extends BaseSerializer {
  /**
   * Serializes the response from user transactions API
   * @param data - The raw API response
   * @returns Formatted transaction response
   */
  static serializeTransactionsResponse(data: any): { 
    transactions: any[], 
    has_more: boolean, 
    next_cursor?: number 
  } {
    if (!data) {
      return {
        transactions: [],
        has_more: false
      };
    }

    const items = Array.isArray(data.items) ? data.items : 
                 Array.isArray(data) ? data :
                 data.transaction ? [data] : [];

    return {
      transactions: items.map(item => this.serializeTransaction(item)).filter(Boolean),
      has_more: data.has_more || false,
      next_cursor: data.next_cursor
    };
  }

  /**
   * Serializes a single transaction
   * @param item - The raw transaction item
   * @returns Formatted transaction or null if invalid
   */
  static serializeTransaction(item: any): any {
    if (!item) return null;
    
    const tx = item.transaction || item;
    const tokens = item.tokens || [];
    
    if (!tx) return null;
    
    // Handle different transaction types
    switch (tx.tx_type) {
      case 'RemoveLiquidity':
      case 'AddLiquidity':
        return this.serializeLiquidityTransaction(tx, tokens);
      case 'Swap':
        return this.serializeSwapTransaction(tx, tokens);
      case 'Send':
        return this.serializeSendTransaction(tx, tokens);
      default:
        return null;
    }
  }

  /**
   * Serializes a liquidity transaction (add or remove)
   * @param tx - The raw transaction
   * @param tokens - The tokens involved
   * @returns Formatted liquidity transaction
   */
  private static serializeLiquidityTransaction(tx: any, tokens: any[]): any {
    const rawTx = tx.raw_json?.[`${tx.tx_type}Tx`];
    if (!rawTx) return null;

    // Find the tokens in the response
    const token0 = tokens.find((t: any) => t.token_id === tokens[0]?.token_id);
    const token1 = tokens.find((t: any) => t.token_id === tokens[1]?.token_id);
    const lpToken = tokens.find((t: any) => t.token_type === 'Lp');

    // Format amounts based on token decimals
    const formattedAmount0 = this.formatTokenAmount(
      rawTx.amount_0, 
      token0?.decimals || 8
    );
    
    const formattedAmount1 = this.formatTokenAmount(
      rawTx.amount_1, 
      token1?.decimals || 8
    );
    
    const lpAmount = tx.tx_type === 'AddLiquidity' 
      ? rawTx.add_lp_token_amount 
      : rawTx.remove_lp_token_amount;
      
    const formattedLpAmount = this.formatTokenAmount(
      lpAmount, 
      lpToken?.decimals || 8
    );

    return {
      tx_id: rawTx.tx_id,
      tx_type: tx.tx_type === 'RemoveLiquidity' ? 'remove_liquidity' : 'add_liquidity',
      status: rawTx.status || 'Success',
      timestamp: rawTx.ts.toString(),
      details: {
        token_0_id: token0?.token_id,
        token_1_id: token1?.token_id,
        token_0_symbol: token0?.symbol || `Token ${token0?.token_id}`,
        token_1_symbol: token1?.symbol || `Token ${token1?.token_id}`,
        token_0_canister: token0?.canister_id || '',
        token_1_canister: token1?.canister_id || '',
        amount_0: formattedAmount0,
        amount_1: formattedAmount1,
        lp_token_symbol: lpToken?.symbol || '',
        lp_token_amount: formattedLpAmount,
        pool_id: rawTx.pool_id,
        lp_fee_0: this.formatTokenAmount(rawTx.lp_fee_0, token0?.decimals || 8),
        lp_fee_1: this.formatTokenAmount(rawTx.lp_fee_1, token1?.decimals || 8)
      }
    };
  }

  /**
   * Serializes a swap transaction
   * @param tx - The raw transaction
   * @param tokens - The tokens involved
   * @returns Formatted swap transaction
   */
  private static serializeSwapTransaction(tx: any, tokens: any[]): any {
    const rawTx = tx.raw_json?.SwapTx;
    if (!rawTx) return null;

    // Find the tokens in the response
    const payToken = tokens.find((t: any) => t.token_id === rawTx.pay_token_id);
    const receiveToken = tokens.find((t: any) => t.token_id === rawTx.receive_token_id);

    // Format amounts based on token decimals
    const formattedPayAmount = this.formatTokenAmount(
      rawTx.pay_amount, 
      payToken?.decimals || 8
    );
    
    const formattedReceiveAmount = this.formatTokenAmount(
      rawTx.receive_amount, 
      receiveToken?.decimals || 8
    );

    return {
      tx_id: rawTx.tx_id,
      tx_type: 'swap',
      status: rawTx.status || 'Success',
      timestamp: rawTx.ts.toString(),
      details: {
        pay_amount: formattedPayAmount,
        receive_amount: formattedReceiveAmount,
        pay_token_id: rawTx.pay_token_id,
        receive_token_id: rawTx.receive_token_id,
        pool_id: rawTx.pool_id,
        price: rawTx.price?.toString() || "0",
        slippage: rawTx.slippage?.toString() || "0",
        pay_token_symbol: payToken?.symbol || `Token ${rawTx.pay_token_id}`,
        receive_token_symbol: receiveToken?.symbol || `Token ${rawTx.receive_token_id}`,
        pay_token_canister: payToken?.canister_id || '',
        receive_token_canister: receiveToken?.canister_id || '',
        gas_fee: this.formatTokenAmount(rawTx.gas_fee, payToken?.decimals || 8),
        lp_fee: this.formatTokenAmount(rawTx.lp_fee, payToken?.decimals || 8)
      }
    };
  }

  /**
   * Serializes a send transaction
   * @param tx - The raw transaction
   * @param tokens - The tokens involved
   * @returns Formatted send transaction
   */
  private static serializeSendTransaction(tx: any, tokens: any[]): any {
    const rawTx = tx.raw_json?.SendTx || tx;
    if (!rawTx) return null;

    // Find the token in the response
    const token = tokens.find((t: any) => 
      t.token_id === rawTx.token_id || 
      t.canister_id === rawTx.token_canister
    );

    // Format amount based on token decimals
    const formattedAmount = this.formatTokenAmount(
      rawTx.amount, 
      token?.decimals || 8
    );

    return {
      tx_id: rawTx.tx_id || rawTx.id || `send-${Date.now()}`,
      tx_type: 'send',
      status: rawTx.status || 'Success',
      timestamp: rawTx.ts?.toString() || rawTx.timestamp?.toString() || Date.now().toString(),
      details: {
        amount: formattedAmount,
        token_id: rawTx.token_id || '',
        token_symbol: token?.symbol || rawTx.token_symbol || 'Unknown',
        token_canister: token?.canister_id || rawTx.token_canister || '',
        from: rawTx.from || tx.from || '',
        to: rawTx.to || tx.to || '',
        fee: this.formatTokenAmount(rawTx.fee, token?.decimals || 8)
      }
    };
  }
} 