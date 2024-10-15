use super::user_balances_reply::UserBalancesReply;
use super::user_balances_reply::UserBalancesReply::LP;

pub trait USDBalance {
    fn usd_balance(&self) -> f64;
}

impl USDBalance for UserBalancesReply {
    fn usd_balance(&self) -> f64 {
        match self {
            LP(token) => token.usd_balance,
        }
    }
}
