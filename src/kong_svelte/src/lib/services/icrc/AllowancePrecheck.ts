import { IcrcService } from './IcrcService';
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';

export interface AllowanceCheckParams {
  token: Kong.Token;
  amount: bigint;
  spender?: string;
}

/**
 * Pre-checks and requests ICRC-2 allowances in the background
 * This is used to ensure allowances are ready before user actions that require signing
 * to prevent Safari from blocking popups
 */
export class AllowancePrecheck {
  /**
   * Check allowance without requesting approval
   */
  static async checkAllowanceOnly(params: AllowanceCheckParams): Promise<boolean> {
    const { token, amount, spender } = params;
    
    // Only check ICRC-2 tokens
    if (!token.standards?.includes("ICRC-2")) {
      return true; // No allowance needed for non-ICRC-2 tokens
    }

    const authStore = get(auth);
    if (!authStore.account?.owner) {
      return false;
    }

    try {
      const ownerString = typeof authStore.account.owner === 'string' 
        ? authStore.account.owner 
        : authStore.account.owner.toString();
      
      const currentAllowance = await IcrcService.checkAllowance(
        token,
        ownerString,
        spender
      );
      
      const isExpired = currentAllowance.expires_at.length > 0 && 
        currentAllowance.expires_at[0] < BigInt(Date.now() * 1000000);
      
      // Calculate required amount with fees
      const cleanFee = token.fee_fixed?.replace(/_/g, "");
      const tokenFee = cleanFee && /^\d+$/.test(cleanFee) ? BigInt(cleanFee) : 0n;
      const totalRequired = amount + (tokenFee * 4n);
      
      // Return whether allowance is sufficient
      return currentAllowance && !isExpired && currentAllowance.allowance >= totalRequired;
    } catch (error) {
      console.error(`Failed to check allowance for ${token.symbol}:`, error);
      return false; // Assume insufficient on error
    }
  }

  /**
   * Check and request allowance for a single token
   */
  static async checkAndRequestAllowance(params: AllowanceCheckParams): Promise<void> {
    const { token, amount, spender } = params;
    
    // Only check ICRC-2 tokens
    if (!token.standards?.includes("ICRC-2")) {
      return;
    }

    const authStore = get(auth);
    if (!authStore.account?.owner) {
      return;
    }

    try {
      const hasAllowance = await this.checkAllowanceOnly(params);
      
      // Request approval if needed
      if (!hasAllowance) {
        await IcrcService.checkAndRequestIcrc2Allowances(token, amount, spender);
      }
    } catch (error) {
      console.error(`Failed to check/request allowance for ${token.symbol}:`, error);
      // Don't throw - let the actual operation fail if allowance is insufficient
    }
  }

  /**
   * Check and request allowances for multiple tokens in parallel
   */
  static async checkAndRequestAllowances(params: AllowanceCheckParams[]): Promise<void> {
    const promises = params.map(param => this.checkAndRequestAllowance(param));
    await Promise.all(promises);
  }

  /**
   * Check if a token has sufficient allowance (synchronous check)
   */
  static hasSufficientAllowance(token: Kong.Token, amount: bigint, spender?: string): boolean {
    if (!token.standards?.includes("ICRC-2")) {
      return true; // Not ICRC-2, no allowance needed
    }

    try {
      const authStore = get(auth);
      if (!authStore.account?.owner) return false;

      // This would need to be implemented with a cache to be truly synchronous
      // For now, return false to trigger the async check
      return false;
    } catch (error) {
      console.error(`Failed to check allowance for ${token.symbol}:`, error);
      return false;
    }
  }
}