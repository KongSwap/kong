export const prerender = false;

import * as minerAPI from '$lib/api/miner';
import * as powBackendAPI from '$lib/api/powBackend';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url }) => {
  const { principal } = params;
  const referrerToken = url.searchParams.get('token');
  
  let miner = null;
  let stats = null;
  let tokenInfo = null;
  let error = null;
  let hashHistory = null;
  let timeRemaining = null;
  let remainingHashes = null;
  
  try {
    // Fetch basic miner info
    try {
      miner = await minerAPI.getMinerInfo(principal);
    } catch (e) {
      console.error("Failed to load miner info:", e);
      error = e.message || "Failed to load miner information";
    }
    
    // Fetch miner stats
    try {
      stats = await minerAPI.getMiningStats(principal);
    } catch (e) {
      console.error("Failed to load miner stats:", e);
    }
    
    // Fetch token info if miner has connected token
    if (miner?.token_canister_id) {
      try {
        tokenInfo = await powBackendAPI.getTokenInfo(miner.token_canister_id.toString());
      } catch (e) {
        console.error("Failed to load token info:", e);
      }
    }
    
    // Fetch hash history if available
    try {
      hashHistory = await minerAPI.getHashRateHistory(principal);
    } catch (e) {
      console.error("Failed to load hash history:", e);
    }
    
    // Get remaining hashes
    try {
      remainingHashes = await minerAPI.getRemainingHashes(principal);
    } catch (e) {
      console.error("Failed to get remaining hashes:", e);
    }
    
    // Get time estimate
    try {
      timeRemaining = await minerAPI.getTimeRemainingEstimate(principal);
    } catch (e) {
      console.error("Failed to get time estimate:", e);
    }
  } catch (error) {
    console.error("Error in load function:", error);
    error = error.message || "An unknown error occurred";
  }
  
  return {
    principal,
    miner,
    stats,
    tokenInfo,
    hashHistory,
    timeRemaining,
    remainingHashes,
    referrerToken,
    error
  };
};