import { API_URL } from "./index";
import { browser } from "$app/environment";
import { UserSerializer } from "../serializers/UserSerializer";

export interface LeaderboardEntry {
  user_id: number;
  principal_id: string;
  total_volume_usd: number;
  swap_count: number;
  traded_token_canister_ids?: string[];
}

export interface VolumeLeaderboardResponse {
  items: LeaderboardEntry[];
  period: string;
  limit: number;
}

/**
 * Fetches the volume leaderboard data
 * @param period Time period for the leaderboard (day, week, month)
 * @param limit Maximum number of users to return
 * @returns Promise with leaderboard data
 */
export async function fetchVolumeLeaderboard(
  period: 'day' | 'week' | 'month' = 'day',
  limit: number = 20
): Promise<LeaderboardEntry[] | VolumeLeaderboardResponse> {
  if (!browser) {
    throw new Error("API calls can only be made in the browser");
  }
  
  const url = new URL(`${API_URL}/api/leaderboard/volume`);
  url.searchParams.set('period', period);
  url.searchParams.set('limit', limit.toString());
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }
  
  const rawData = await response.json();
  
  // Process the response with UserSerializer to clean principal IDs
  if (Array.isArray(rawData)) {
    return UserSerializer.serializeUsers(rawData) as LeaderboardEntry[];
  } else if (rawData && typeof rawData === 'object' && Array.isArray(rawData.items)) {
    return {
      ...rawData,
      items: UserSerializer.serializeUsers(rawData.items) as LeaderboardEntry[]
    };
  }
  
  return rawData;
}
