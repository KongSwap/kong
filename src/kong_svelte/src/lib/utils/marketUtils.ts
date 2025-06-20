import type { MarketFormState } from "$lib/utils/validators/marketValidators";
import type { CreateMarketParams } from "$lib/api/predictionMarket";

/**
 * Build the candid-compatible endTime spec for a market.
 */
export function getEndTimeSpec(s: MarketFormState): CreateMarketParams['endTimeSpec'] {
  return s.endTimeType === "Duration"
    ? { Duration: BigInt(s.duration * 60 * 60) }
    : { SpecificDate: BigInt(Math.floor(new Date(`${s.specificDate}T${s.specificTime}`).getTime() / 1000)) };
}

/**
 * Build the candid-compatible resolution method spec for a market.
 */
export function getResolutionSpec(
  method: MarketFormState['resolutionMethod']
): CreateMarketParams['resolutionMethod'] {
  switch (method) {
    case "Admin":
      return { Admin: null };
    case "Decentralized":
      return { Decentralized: { quorum: 100n } };
    case "Oracle":
      return { Oracle: { oracle_principals: [], required_confirmations: 1n } };
    default:
      throw new Error(`Unknown resolution method: ${method}`);
  }
}

/**
 * Package the entire market form into CreateMarketParams for the API.
 */
export function buildCreateMarketInput(
  s: MarketFormState & { imageUrl: string | null; uses_time_weighting: boolean; time_weight_alpha?: number; token_id: string }
): CreateMarketParams {
  return {
    question: s.question,
    category: { [s.category]: null },
    rules: s.rules,
    outcomes: s.outcomes.filter(o => o.trim()),
    resolutionMethod: getResolutionSpec(s.resolutionMethod),
    endTimeSpec: getEndTimeSpec(s),
    image_url: s.imageUrl ?? undefined,
    uses_time_weighting: s.uses_time_weighting,
    time_weight_alpha: s.time_weight_alpha,
    token_id: s.token_id,
  };
} 