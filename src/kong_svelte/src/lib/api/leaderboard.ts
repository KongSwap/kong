import { API_URL } from "./index";

interface LeaderboardEntry {
  user_id: number;
  principal_id: string;
  volume: number;
  // Additional fields might be present in the actual API response
}

interface VolumeLeaderboardResponse {
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
  limit: number = 10
): Promise<VolumeLeaderboardResponse> {
  const url = new URL(`${API_URL}/api/leaderboard/volume`);
  url.searchParams.set('period', period);
  url.searchParams.set('limit', limit.toString());
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }
  
  return response.json();
}
