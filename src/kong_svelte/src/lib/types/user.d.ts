declare global {
  interface User {
    account_id: string;
    user_name: string;
    fee_level_expires_at?: bigint;
    referred_by?: string;
    user_id: number;
    fee_level: number;
    principal_id: string;
    referred_by_expires_at?: bigint;
    campaign1_flags: boolean[];
    my_referral_code: string;
  }
}

export {};
