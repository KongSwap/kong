use rand::distributions::{Alphanumeric, DistString};
use rand::rngs::StdRng;

use crate::stable_memory::USER_MAP;

// default referral interval is 180 days
// 180 days = 24 * 60 * 60 * 1_000_000_000
pub const REFERRAL_INTERVAL: u64 = 15550000000000000;
// referral code length
const REFERRAL_LENGTH: usize = 8;

pub fn generate_referral_code(rng: &mut StdRng) -> String {
    loop {
        let referral_code = Alphanumeric.sample_string(rng, REFERRAL_LENGTH);
        let code_exists = USER_MAP.with(|m| m.borrow().iter().any(|(_, v)| v.my_referral_code == referral_code));
        if !code_exists {
            return referral_code;
        }
    }
}
