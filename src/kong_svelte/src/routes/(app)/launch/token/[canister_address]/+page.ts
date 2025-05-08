export const prerender = false;

import * as powBackendAPI from "$lib/api/powBackend";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const canister_address = params.canister_address;
  let token: any = null;
  let error: string | null = null;
  let minerStats: any = null;

  try {
    // Get comprehensive token info using the powBackend API
    try {
      const allInfo = await powBackendAPI.getAllTokenInfo(canister_address);
      token = {
        ...allInfo,
        canister_address
      };
    } catch (e) {
      // Fallback to basic info if getAllTokenInfo is not available
      const info = await powBackendAPI.getTokenInfo(canister_address);
      token = {
        ...info,
        canister_address
      };
    }

    // Get miner leaderboard
    try {
      minerStats = await powBackendAPI.getMinerLeaderboard(canister_address, 10); // Top 10 miners
    } catch (e) {
      console.warn("Could not fetch miner stats:", e);
    }
    
  } catch (e: any) {
    error = e?.message || e?.toString() || "Failed to fetch token info";
  }

  return {
    token,
    canister_address,
    minerStats,
    error
  };
};