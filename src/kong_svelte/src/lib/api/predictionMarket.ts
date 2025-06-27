import { canisters } from "$lib/config/auth.config";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { predictionActor } from "$lib/stores/auth";
import { Principal } from "@dfinity/principal";
import { notificationsStore } from "$lib/stores/notificationsStore";
import type { MarketStatus, SortOption } from "../../../../declarations/prediction_markets_backend_legacy/prediction_markets_backend.did";

export async function getMarket(marketId: bigint) {
  const actor = predictionActor({anon: true});
  const market = await actor.get_market(marketId);
  return market;
}

export async function getAllMarkets(
  options: {
    start?: number;
    length?: number;
    statusFilter?: "Open" | "Closed" | "Disputed" | "Voided";
    sortOption?: {
      type: "CreatedAt" | "TotalPool";
      direction: "Ascending" | "Descending";
    };
  } = {},
) {
  const actor = predictionActor({anon: true});

  const statusFilterValue: [] | [MarketStatus] = options.statusFilter
    ? [
        options.statusFilter === "Open" ? { Open: null } as MarketStatus :
        options.statusFilter === "Closed" ? { Closed: [] } as MarketStatus :
        options.statusFilter === "Disputed" ? { Disputed: null } as MarketStatus :
        options.statusFilter === "Voided" ? { Voided: null } as MarketStatus :
        undefined
      ].filter(Boolean) as [MarketStatus]
    : [];

  const sortOptionValue: [] | [SortOption] = options.sortOption
    ? [
        options.sortOption.type === "TotalPool"
          ? { TotalPool: options.sortOption.direction === "Ascending" ? { Ascending: null } : { Descending: null } }
          : { CreatedAt: options.sortOption.direction === "Ascending" ? { Ascending: null } : { Descending: null } }
      ]
    : [];

  const args = {
    start: BigInt(options.start ?? 0),
    length: BigInt(options.length ?? 100),
    status_filter: statusFilterValue,
    sort_option: sortOptionValue,
  };

  const markets = await actor.get_all_markets(args);
  return markets;
}

export async function getMarketsByStatus() {
  const actor = predictionActor({anon: true});
  const marketsByStatus = await actor.get_markets_by_status({
    start: 0n,
    length: 100n,
  });
  return marketsByStatus;
}

export async function getMarketBets(marketId: bigint) {
  const actor = predictionActor({anon: true});
  const bets = await actor.get_market_bets(marketId);
  return bets;
}

export async function getUserHistory(principal: string) {
  const actor = predictionActor({anon: true});
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
  const actor = predictionActor({anon: false, requiresSigning: false});
  const result = await actor.create_market(
    params.question,
    params.category,
    params.rules,
    params.outcomes,
    params.resolutionMethod,
    params.endTimeSpec,
    params.image_url ? [params.image_url] : [], // Pass as optional array
    params.uses_time_weighting !== undefined ? [params.uses_time_weighting] : [],
    params.time_weight_alpha !== undefined ? [params.time_weight_alpha] : [],
    (params.token_id !== undefined && params.token_id !== null) ? [String(params.token_id)] : []
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
      canisters.predictionMarkets.canisterId,
    );

    // Place the bet using an authenticated actor
    const actor = predictionActor({anon: false, requiresSigning: true});

    // Convert amount string to BigInt and verify it's not zero
    const bigIntAmount = BigInt(amount);

    if (bigIntAmount === 0n) {
      throw new Error("Bet amount cannot be zero");
    }

    const result = await actor.place_bet({market_id: marketId, outcome_index: outcomeIndex, amount: bigIntAmount, token_id: []});

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
    const actor = predictionActor({anon: false, requiresSigning: false});

    // Convert marketId from string to number
    const marketIdNumber = marketId;
    const result = await actor.resolve_via_admin(marketIdNumber, [winningOutcome]);

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
    const actor = predictionActor({anon: false, requiresSigning: false});

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

export async function getLatestBets() {
  const actor = predictionActor({anon: true});
  const latestBets = await actor.get_latest_bets();
  return latestBets;
}

export async function getAllBets(fromIndex: number = 0, toIndex: number = 10) {
  const actor = predictionActor({anon: true});

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
  const actor = predictionActor({anon: true});
  const stats = await actor.get_stats();
  return stats;
}

export async function getUserClaims(principal: string) {
  const actor = predictionActor({anon: true});
  try {
    const claims = await actor.get_user_claims(principal);
    console.log("claims", claims)
    
    return claims;
  } catch (error) {
    console.error("Error in getUserClaims:", error);
    throw error;
  }
}

export async function getUserPendingClaims(principal: string) {
  const actor = predictionActor({anon: true});
  try {
    const pendingClaims = await actor.get_user_pending_claims(principal);
    console.log("pending claims", pendingClaims)
    
    return pendingClaims;
  } catch (error) {
    console.error("Error in getUserPendingClaims:", error);
    throw error;
  }
}

export async function claimWinnings(claimIds: bigint[]) {
  const actor = predictionActor({anon: false, requiresSigning: true});
  try {
    const result = await actor.claim_winnings(claimIds);
    
    if ("Err" in result) {
      throw new Error(`Failed to claim winnings: ${result.Err}`);
    }
    
    return result;
  } catch (error) {
    console.error("Error in claimWinnings:", error);
    throw error;
  }
}

export async function getAllCategories() {
  const actor = predictionActor({anon: true});
  const categories = await actor.get_all_categories();
  return categories;
}

export async function isAdmin(principal: string) {
  const actor = predictionActor({anon: true});
  return await actor.is_admin(Principal.fromText(principal));
}

export async function getSupportedTokens() {
  const actor = predictionActor({anon: true});
  return await actor.get_supported_tokens();
}

export async function estimateBetReturn(
  marketId: bigint, 
  outcomeIndex: bigint, 
  betAmount: bigint, 
  currentTime: bigint = BigInt(Date.now()) * 1000000n,
  tokenId?: string
) {
  const actor = predictionActor({anon: true});
  return await actor.estimate_bet_return(
    marketId, 
    outcomeIndex, 
    betAmount, 
    currentTime,
    tokenId ? [tokenId] : []
  );
}

export async function getMarketsByCreator(
  creator: string,
  options: {
    start?: number;
    length?: number;
    sortByCreationTime?: boolean;
  } = {}
) {
  const actor = predictionActor({anon: true});
  try {
    const creatorPrincipal = Principal.fromText(creator);
    const result = await actor.get_markets_by_creator({
      creator: creatorPrincipal,
      start: BigInt(options.start ?? 0),
      length: BigInt(options.length ?? 100),
      sort_by_creation_time: options.sortByCreationTime ?? true,
    });
    return result;
  } catch (error) {
    console.error("Error in getMarketsByCreator:", error);
    throw error;
  }
}

export async function setMarketFeatured(marketId: bigint, featured: boolean): Promise<void> {
  try {
    const actor = predictionActor({anon: false, requiresSigning: false});
    const result = await actor.set_market_featured(marketId, featured);

    if ("Err" in result) {
      const error = result.Err as any;
      if (typeof error === 'object' && error !== null) {
        if ("MarketNotFound" in error) {
          throw new Error("Market not found");
        } else if ("Unauthorized" in error) {
          throw new Error("You are not authorized to modify this market");
        }
      }
      throw new Error(
        `Failed to set market featured status: ${JSON.stringify(result.Err)}`,
      );
    }
    notificationsStore.add({
      title: featured ? "Market Featured" : "Market Unfeatured",
      message: `Market ${marketId} has been ${featured ? 'featured' : 'unfeatured'}`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to set market featured status:", error);
    throw error;
  }
}
