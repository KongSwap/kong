// types/backend.ts
import type { Principal } from '@dfinity/principal';

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  fee: bigint;
}

export interface Pool {
  id: string;
  token0: string;
  token1: string;
  balance: bigint;
  fee: number;
  apy: number;
}

export interface SwapQuote {
  receiveAmount: bigint;
  payAmount: bigint;
  slippage: number;
  price: string;
  fees: {
    lpFee: bigint;
    gasFee: bigint;
    tokenFee?: string;
  }[];
}

export interface User {
  principal: Principal;
  balances: Record<string, bigint>;
  poolShares: Record<string, bigint>;
}

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  fee: bigint;
}

export interface User {
  principal: Principal;
  balances: Record<string, bigint>;
  poolShares: Record<string, bigint>;
}
