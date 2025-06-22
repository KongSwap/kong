import { auth, swapActor } from '$lib/stores/auth';
import { canisters, type CanisterType } from '../config/auth.config';
import type { Claim } from '../types/claims';
import { toastStore } from '../stores/toastStore';
import { fetchTokensByCanisterId } from '../api/tokens/TokenApiClient';
import { get } from 'svelte/store';

// Create a mapping from token symbols to canister IDs
const SYMBOL_TO_CANISTER_ID: Record<string, string> = {
  'ICP': 'ryjl3-tyaaa-aaaaa-aaaba-cai',
  'GHOST': '4c4fd-caaaa-aaaaq-aaa3a-cai',
  'KINIC': '73mez-iiaaa-aaaaq-aaasq-cai',
  'CHAT': '2ouva-viaaa-aaaaq-aaamq-cai',
  'CTZ': 'uf2wh-taaaa-aaaaq-aabna-cai',
  'ICS': 'ss2fx-dyaaa-aaaaq-aaova-cai',
  'BIL': 'vtrom-gqaaa-aaaaq-aabia-cai'
};

export class ClaimsService {
  private static DEFAULT_IMAGE = "/tokens/not_verified.webp";

  static async fetchClaims(): Promise<{ claims: Claim[], error: string | null }> {
    try {
      const authState = get(auth);
      if (!authState.isConnected) {
        return { claims: [], error: "Please connect your wallet to view claims" };
      }

      const actor = swapActor({anon: false, requiresSigning: false});
      const principalId = authState.account?.owner;
      
      if (!principalId) {
        return { claims: [], error: "Principal ID not found" };
      }

      const result = await actor.claims(principalId);
      
      if ('Ok' in result) {
        const fetchedClaims = result.Ok.map(claim => ({
          ...claim,
          canister_id: claim.canister_id.length > 0 ? claim.canister_id[0] : ''
        }));
        const tokenIdentifiers = this.getUniqueTokenIdentifiers(fetchedClaims);
        const tokenDetailsMap = await this.fetchTokenDetails(tokenIdentifiers);
        
        const enhancedClaims = this.enhanceClaimsWithTokenDetails(fetchedClaims, tokenDetailsMap);
        return { claims: enhancedClaims, error: null };
      } else {
        return { claims: [], error: result.Err };
      }
    } catch (err) {
      console.error("Error fetching claims:", err);
      return { claims: [], error: err.message || "Failed to fetch claims" };
    }
  }

  static async processClaim(claimId: bigint): Promise<{ success: boolean, error: string | null }> {
    try {
      const actor = swapActor({anon: false, requiresSigning: false});
      const result = await actor.claim(claimId);
      
      if ('Ok' in result) {
        toastStore.success("Claim processed successfully!");
        return { success: true, error: null };
      } else {
        const error = `Failed to process claim: ${result.Err}`;
        toastStore.error(error);
        return { success: false, error };
      }
    } catch (err) {
      console.error("Error processing claim:", err);
      const error = err.message || "Failed to process claim";
      toastStore.error(error);
      return { success: false, error };
    }
  }

  static async processAllClaims(claims: Claim[]): Promise<{ successCount: number, failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;
    
    try {
      const actor = swapActor({anon: false, requiresSigning: false});
      
      for (const claim of claims) {
        try {
          const result = await actor.claim(claim.claim_id);
          if ('Ok' in result) {
            successCount++;
          } else {
            failureCount++;
            console.error(`Failed to process claim ${claim.claim_id}: ${result.Err}`);
          }
        } catch (err) {
          failureCount++;
          console.error("Error processing claim:", err);
        }
      }

      this.showProcessAllResult(successCount, failureCount);
      return { successCount, failureCount };
    } catch (err) {
      console.error("Error processing all claims:", err);
      toastStore.error(err.message || "Failed to process claims");
      return { successCount, failureCount };
    }
  }

  private static getUniqueTokenIdentifiers(claims: Claim[]): string[] {
    return claims
      .map(claim => {
        if (claim.chain === 'IC' && claim.canister_id) {
          return Array.isArray(claim.canister_id) ? claim.canister_id[0] : claim.canister_id;
        }
        if (claim.chain === 'IC' && SYMBOL_TO_CANISTER_ID[claim.symbol]) {
          return SYMBOL_TO_CANISTER_ID[claim.symbol];
        }
        return null;
      })
      .filter(Boolean) as string[];
  }

  private static async fetchTokenDetails(tokenIdentifiers: string[]): Promise<Record<string, Kong.Token>> {
    if (tokenIdentifiers.length === 0) return {};
    
    try {
      const tokens = await fetchTokensByCanisterId(tokenIdentifiers);
      return tokens.reduce((acc, token) => {
        if (token) {
          acc[token.symbol] = token;
          if (token.address) {
            const canisterId = Array.isArray(token.address) ? token.address[0] : token.address;
            acc[canisterId] = token;
          }
        }
        return acc;
      }, {} as Record<string, Kong.Token>);
    } catch (err) {
      console.error("Error fetching token details:", err);
      return {};
    }
  }

  private static enhanceClaimsWithTokenDetails(
    claims: Claim[], 
    tokenDetailsMap: Record<string, Kong.Token>
  ): Claim[] {
    return claims.map(claim => {
      const claimCanisterId = Array.isArray(claim.canister_id) ? claim.canister_id[0] : claim.canister_id;
      const tokenDetails = claimCanisterId && tokenDetailsMap[claimCanisterId]
        ? tokenDetailsMap[claimCanisterId]
        : tokenDetailsMap[claim.symbol];
      
      const canisterId = claimCanisterId || SYMBOL_TO_CANISTER_ID[claim.symbol];
      
      return {
        ...claim,
        logo_url: tokenDetails?.logo_url || this.DEFAULT_IMAGE,
        decimals: tokenDetails?.decimals || 8
      };
    });
  }

  private static showProcessAllResult(successCount: number, failureCount: number): void {
    if (successCount > 0 && failureCount === 0) {
      toastStore.success(`Successfully processed ${successCount} claims!`);
    } else if (successCount > 0 && failureCount > 0) {
      toastStore.warning(`Processed ${successCount} claims, but ${failureCount} failed.`);
    } else if (failureCount > 0) {
      toastStore.error(`Failed to process all ${failureCount} claims.`);
    }
  }
} 