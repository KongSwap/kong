import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { PREDICTION_MARKETS_CANISTER_ID } from "$lib/constants/canisterConstants";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { auth } from "$lib/services/auth";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { get } from "svelte/store";

export async function getMarket(marketId: number) {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const market = await actor.get_market(marketId);
  return market;
}

export async function getAllMarkets() {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const markets = await actor.get_all_markets();
  return markets;
}

export async function getMarketsByStatus() {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const marketsByStatus = await actor.get_markets_by_status();
  return marketsByStatus;
}

export async function getMarketBets(marketId: number) {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const bets = await actor.get_market_bets(marketId);
  return bets;
}

export async function getUserHistory(principal: string) {
  const actor = auth.pnp.getActor(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
    {
      anon: false,
      requiresSigning: false,
    },
  );
  try {
    const principalObj = Principal.fromText(principal);
    const history = await actor.get_user_history(principalObj);
    console.log("User history:", history);
    return history;
  } catch (error) {
    console.error("Error in getUserHistory:", error);
    throw error;
  }
}

export async function getUserBalance(principal: string) {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const balance = await actor.get_balance(principal);
  return balance;
}

export interface CreateMarketParams {
  question: string;
  category: any; // MarketCategory type from candid
  rules: string;
  outcomes: string[];
  resolutionMethod: any; // ResolutionMethod type from candid
  endTimeSpec: any; // MarketEndTime type from candid
}

export async function createMarket(params: CreateMarketParams) {
  const actor = auth.pnp.getActor(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
    {
      anon: false,
      requiresSigning: true,
    },
  );
  const result = await actor.create_market(
    params.question,
    params.category,
    params.rules,
    params.outcomes,
    params.resolutionMethod,
    params.endTimeSpec,
  );
  return result;
}

export async function placeBet(
  token: FE.Token,
  marketId: number,
  outcomeIndex: number,
  amount: string,
) {
  try {
    // Request a large allowance (100x the bet amount) to allow for multiple bets
    const largeAllowance = BigInt(token.metrics.total_supply);

    // Check and request allowance if needed
    await IcrcService.checkAndRequestIcrc2Allowances(
      token,
      largeAllowance,
      PREDICTION_MARKETS_CANISTER_ID,
    );

    // Place the bet using an authenticated actor
    const actor = auth.pnp.getActor(
      PREDICTION_MARKETS_CANISTER_ID,
      canisterIDLs.prediction_markets_backend,
      {
        anon: false,
        requiresSigning: false,
      },
    );

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
      }

      switch (result.Err) {
        case "MarketNotFound":
          throw new Error("Market not found");
        case "MarketClosed":
          throw new Error("Market is closed");
        case "InvalidOutcome":
          throw new Error("Invalid outcome selected");
        case "InsufficientBalance":
          throw new Error("Insufficient KONG balance");
        default:
          throw new Error(`Bet failed: ${JSON.stringify(result.Err)}`);
      }
    }

    console.log("Bet placed successfully:", result);
    return result;
  } catch (error) {
    console.error("Place bet error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to place bet: ${JSON.stringify(error)}`);
  }
}

export async function resolveMarketViaAdmin(
  marketId: string,
  winningOutcome: number,
): Promise<void> {
  try {
    const actor = auth.pnp.getActor(
      PREDICTION_MARKETS_CANISTER_ID,
      canisterIDLs.prediction_markets_backend,
      { anon: false, requiresSigning: false },
    );

    const result = await actor.resolve_via_admin(marketId, [winningOutcome]);

    if ("Err" in result) {
      switch (result.Err) {
        case "MarketNotFound":
          throw new Error("Market not found");
        case "MarketStillOpen":
          throw new Error("Market is still open");
        case "AlreadyResolved":
          throw new Error("Market has already been resolved");
        case "Unauthorized":
          throw new Error("You are not authorized to resolve this market");
        default:
          throw new Error(
            `Failed to resolve market: ${JSON.stringify(result.Err)}`,
          );
      }
    }
  } catch (error) {
    console.error("Failed to resolve market via admin:", error);
    throw error;
  }
}

export async function resolveMarketViaOracle(
  marketId: number,
  outcomeIndices: number[],
  signature: Uint8Array,
) {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const result = await actor.resolve_via_oracle(
    marketId,
    outcomeIndices,
    Array.from(signature),
  );
  return result;
}

export async function getAllBets(fromIndex: number = 0, toIndex: number = 10) {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const bets = await actor.get_all_bets(
    BigInt(fromIndex),
    BigInt(toIndex),
    true,
  );
  return bets;
}

export async function getAllCategories() {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  const categories = await actor.get_all_categories();
  return categories;
}

export async function isAdmin(principal: Principal) {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  return await actor.is_admin(principal);
}

export async function getAdminPrincipals() {
  const actor = createAnonymousActorHelper(
    PREDICTION_MARKETS_CANISTER_ID,
    canisterIDLs.prediction_markets_backend,
  );
  return await actor.get_admin_principals();
}
