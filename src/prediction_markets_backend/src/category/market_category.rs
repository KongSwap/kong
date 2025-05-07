use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::fmt::{Display, Formatter, Result};
use strum::EnumIter;

/// Represents different categories of prediction markets
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, EnumIter, PartialEq)]
pub enum MarketCategory {
    Crypto,      // Cryptocurrency related predictions
    Memes,       // Internet culture and meme predictions
    Sports,      // Sports events and outcomes
    Politics,    // Political events and outcomes
    KongMadness, // Kong Madness tournament predictions
    AI,          // Artificial Intelligence related predictions
    Other,       // Other categories not covered above
}

impl Display for MarketCategory {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        match self {
            MarketCategory::Crypto => write!(f, "Crypto"),
            MarketCategory::Memes => write!(f, "Memes"),
            MarketCategory::Sports => write!(f, "Sports"),
            MarketCategory::Politics => write!(f, "Politics"),
            MarketCategory::KongMadness => write!(f, "KongMadness"),
            MarketCategory::AI => write!(f, "AI"),
            MarketCategory::Other => write!(f, "Other"),
        }
    }
}

impl Storable for MarketCategory {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut buf = vec![];
        ciborium::ser::into_writer(self, &mut buf).expect("Failed to serialize MarketCategory");
        Cow::Owned(buf)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).expect("Failed to deserialize MarketCategory")
    }

    const BOUND: Bound = Bound::Unbounded;
}
