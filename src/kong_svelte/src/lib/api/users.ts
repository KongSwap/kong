import { API_URL } from "./index";

interface UsersResponse {
  items: Array<{
    user_id: number;
    principal_id: string;
    my_referral_code: string;
    referred_by: string | null;
    fee_level: number;
  }>;
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
}

export async function fetchUsers(principal_id?: string): Promise<UsersResponse> {
  const url = new URL(`${API_URL}/api/users`);
  if (principal_id) {
    url.searchParams.set('principal_id', principal_id);
  }
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }
  
  return response.json();
}