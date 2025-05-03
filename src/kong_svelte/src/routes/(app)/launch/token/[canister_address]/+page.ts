export const prerender = false;

import { auth } from "$lib/stores/auth";
import { idlFactory as tokenIdlFactory } from "$declarations/pow_backend/pow_backend.did.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const canister_address = params.canister_address;
  let token: any = null;
  let error: string | null = null;
  let minerStats: any = null;

  try {
    const actor = auth.getActor(canister_address, tokenIdlFactory, { anon: true });
    // Get comprehensive token info
    if (typeof actor.get_all_info === "function") {
      const info = await actor.get_all_info();
      if (info.Ok) {
        token = {
          ...info.Ok,
          canister_address
        };
      } else {
        error = info.Err || "Unknown error fetching token info";
      }
    } else {
      // Fallback to get_info
      const info = await actor.get_info();
      if (info.Ok) {
        token = {
          ...info.Ok,
          canister_address
        };
      } else {
        error = info.Err || "Unknown error fetching token info";
      }
    }

    // Get miner leaderboard if available
    try {
      if (typeof actor.get_miner_leaderboard === "function") {
        minerStats = await actor.get_miner_leaderboard([10]); // Top 10 miners
      }
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
