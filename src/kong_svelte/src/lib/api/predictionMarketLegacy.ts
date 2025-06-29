import { canisters } from "$lib/config/auth.config";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { predictionActorLegacy } from "$lib/stores/auth";
import { Principal } from "@dfinity/principal";
import { notificationsStore } from "$lib/stores/notificationsStore";
import type { MarketStatus, SortOption } from "../../../../declarations/prediction_markets_backend_legacy/prediction_markets_backend.did";

export async function getMarket(marketId: bigint) {
  const actor = predictionActorLegacy({anon: true});
  const market = await actor.get_market(marketId);
  return market;
}

// Legacy version - uses getMarketsByStatus
export async function getMarketsByStatus() {
  const actor = predictionActorLegacy({anon: true});
  const marketsByStatus = await actor.get_markets_by_status({
    start: 0n,
    length: 100n,
  });
  return marketsByStatus;
}

export async function getMarketBets(marketId: bigint) {
  const actor = predictionActorLegacy({anon: true});
  const bets = await actor.get_market_bets(marketId);
  return bets;
}

export async function getUserHistory(principal: string) {
  const actor = predictionActorLegacy({anon: true});
  try {
    const principalObj = Principal.fromText(principal);
    const history = await actor.get_user_history(principalObj);
    return history;
  } catch (error) {
    console.error("Error in getUserHistory:", error);
    throw error;
  }
}

export interface CreateMarketParams {
  question: string;
  category: any; // MarketCategory type from candid
  rules: string;
  outcomes: string[];
  resolutionMethod: any; // ResolutionMethod type from candid
  endTimeSpec: any; // MarketEndTime type from candid
  image_url?: string; // Optional image URL
  uses_time_weighting?: boolean; // Optional: Whether to use time-weighted distribution
  time_weight_alpha?: number; // Optional: Decay parameter for time-weighting
  token_id?: string; // Optional: Token type to use for this market
}

export async function createMarket(params: CreateMarketParams) {
  const actor = predictionActorLegacy({anon: false, requiresSigning: false});
  const result = await actor.create_market(
    params.question,
    params.category,
    params.rules,
    params.outcomes,
    params.resolutionMethod,
    params.endTimeSpec,
    params.image_url ? [params.image_url] : []
  );

  notificationsStore.add({
    title: "Market Created",
    message: `Market "${params.question}" has been created`,
    type: "success",
  });
  return result;
}

export async function placeBet(
  token: Kong.Token,
  marketId: bigint,
  outcomeIndex: bigint,
  amount: string,
) {
  try {
    // Request a large allowance (100x the bet amount) to allow for multiple bets
    const largeAllowance = BigInt(token.metrics.total_supply);

    // Check and request allowance if needed
    await IcrcService.checkAndRequestIcrc2Allowances(
      token,
      largeAllowance,
      canisters.predictionMarketsLegacy.canisterId,
    );

    // Place the bet using an authenticated actor
    const actor = predictionActorLegacy({anon: false, requiresSigning: true});

    // Convert amount string to BigInt and verify it's not zero
    const bigIntAmount = BigInt(amount);

    if (bigIntAmount === 0n) {
      throw new Error("Bet amount cannot be zero");
    }

    const result = await actor.place_bet(marketId, outcomeIndex, bigIntAmount);

    if ("Err" in result) {
      // Handle specific error cases
      if ("TransferError" in result.Err) {
        throw new Error(`Transfer failed: ${result.Err.TransferError}`);
      } else if ("MarketNotFound" in result.Err) {
        throw new Error("Market not found");
      } else if ("MarketClosed" in result.Err) {
        throw new Error("Market is closed");
      } else if ("InvalidOutcome" in result.Err) {
        throw new Error("Invalid outcome selected");
      } else if ("InsufficientBalance" in result.Err) {
        throw new Error("Insufficient KONG balance");
      } else {
        throw new Error(`Bet failed: ${JSON.stringify(result.Err)}`);
      }
    }

    notificationsStore.add({
      title: "Bet Placed",
      message: `Bet placed successfully on market ${marketId}`,
      type: "success",
    });
    return result;
  } catch (error) {
    console.error("Place bet raw error object:", error);
    console.error("Place bet error (JSON.stringify):", JSON.stringify(error));
    if (error instanceof Error) {
      console.error("Place bet error.name:", error.name);
      console.error("Place bet error.message:", error.message);
      console.error("Place bet error.stack:", error.stack);
    } else {
      console.error("Place bet error is not an instance of Error. Type:", typeof error);
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to place bet: ${JSON.stringify(error)}`);
  }
}

export async function resolveMarketViaAdmin(
  marketId: bigint,
  winningOutcome: bigint,
): Promise<void> {
  try {
    const actor = predictionActorLegacy({anon: false, requiresSigning: false});

    const result = await actor.resolve_via_admin(marketId, [winningOutcome]);

    if ("Err" in result) {
      const error = result.Err as any;
      if ("MarketNotFound" in error) {
        throw new Error("Market not found");
      } else if ("MarketStillOpen" in error) {
        throw new Error("Market is still open");
      } else if ("AlreadyResolved" in error) {
        throw new Error("Market has already been resolved");
      } else if ("Unauthorized" in error) {
        throw new Error("You are not authorized to resolve this market");
      } else {
        throw new Error(
          `Failed to resolve market: ${JSON.stringify(result.Err)}`,
        );
      }
    }
    notificationsStore.add({
      title: "Market Resolved",
      message: `Market ${marketId} has been resolved`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to resolve market via admin:", error);
    throw error;
  }
}

export async function voidMarketViaAdmin(marketId: bigint): Promise<void> {
  try {
    const actor = predictionActorLegacy({anon: false, requiresSigning: false});

    // Convert marketId from string to number
    const marketIdNumber = marketId;
    const result = await actor.void_market(marketIdNumber);

    if ("Err" in result) {
      const error = result.Err as any;
      if ("MarketNotFound" in error) {
        throw new Error("Market not found");
      } else if ("MarketStillOpen" in error) {
        throw new Error("Market is still open");
      } else if ("AlreadyResolved" in error) {
        throw new Error("Market has already been resolved");
      } else if ("Unauthorized" in error) {
        throw new Error("You are not authorized to void this market");
      } else if ("VoidingFailed" in error) {
        throw new Error("Failed to void the market");
      } else {
        throw new Error(
          `Failed to void market: ${JSON.stringify(result.Err)}`,
        );
      }
    }
    notificationsStore.add({
      title: "Market Voided",
      message: `Market ${marketId} has been voided`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to void market via admin:", error);
    throw error;
  }
}

export async function getAllBets(fromIndex: number = 0, toIndex: number = 10) {
  const actor = predictionActorLegacy({anon: true});

  // The backend API expects start and length parameters
  const marketsByStatus = await actor.get_markets_by_status({
    start: 0n,
    length: 100n,
  });

  // Combine bets from all markets
  const allBets: any[] = [];

  // Process active markets
  if (
    marketsByStatus.markets_by_status.active &&
    marketsByStatus.markets_by_status.active.length > 0
  ) {
    for (const market of marketsByStatus.markets_by_status.active) {
      try {
        const marketBets = await actor.get_market_bets(market.id);
        allBets.push(...marketBets);
      } catch (e) {
        console.error(`Failed to get bets for market ${market.id}:`, e);
      }
    }
  }

  // Process expired unresolved markets
  if (
    marketsByStatus.markets_by_status.expired_unresolved &&
    marketsByStatus.markets_by_status.expired_unresolved.length > 0
  ) {
    for (const market of marketsByStatus.markets_by_status.expired_unresolved) {
      try {
        const marketBets = await actor.get_market_bets(market.id);
        allBets.push(...marketBets);
      } catch (e) {
        console.error(`Failed to get bets for market ${market.id}:`, e);
      }
    }
  }

  // Sort bets by timestamp (newest first)
  allBets.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  // Return the requested slice
  return allBets.slice(fromIndex, toIndex);
}

export async function getPredictionMarketStats() {
  const actor = predictionActorLegacy({anon: true});
  const stats = await actor.get_stats();
  return stats;
}

export async function getAllCategories() {
  const actor = predictionActorLegacy({anon: true});
  const categories = await actor.get_all_categories();
  return categories;
}

export async function isAdmin(principal: string) {
  const actor = predictionActorLegacy({anon: true});
  return await actor.is_admin(Principal.fromText(principal));
}

export async function resolveMarket(
  marketId: bigint,
  winningOutcome: bigint,
  userPrincipal: string,
): Promise<void> {
  // Check if current user is admin
  const userIsAdmin = await isAdmin(userPrincipal);
  
  if (userIsAdmin) {
    await resolveMarketViaAdmin(marketId, winningOutcome);
  }
}
