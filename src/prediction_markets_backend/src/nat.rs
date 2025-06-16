use candid::Nat;
use ic_stable_structures::{storable::Bound, Storable};
use num_traits::{CheckedAdd, CheckedMul, ToPrimitive, Zero};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::fmt;
// Hash is automatically derived with #[derive(Hash)]
use std::ops::{Add, Div, Mul, Sub};
use std::str::FromStr;

// Wrapper around candid::Nat that implements Storable
#[derive(candid::CandidType, Serialize, Deserialize, Debug, PartialEq, Eq, Clone, Hash)]
pub struct StorableNat(pub Nat);

impl StorableNat {
    pub fn to_f64(&self) -> f64 {
        self.to_u64() as f64
    }

    pub fn to_u64(&self) -> u64 {
        self.0 .0.to_u64().unwrap_or(0)
    }

    pub fn is_zero(&self) -> bool {
        self.0 .0.to_u64().unwrap_or(0) == 0
    }

    pub fn from_u64(value: u64) -> Self {
        Self(candid::Nat::from(value))
    }

    pub fn inner(&self) -> &candid::Nat {
        &self.0
    }
}

impl Default for StorableNat {
    fn default() -> Self {
        Self(candid::Nat::from(0u64))
    }
}

impl PartialOrd for StorableNat {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.0 .0.partial_cmp(&other.0 .0)
    }
}

impl Ord for StorableNat {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0 .0.to_u64().unwrap_or(0).cmp(&other.0 .0.to_u64().unwrap_or(0))
    }
}

// Implement Display to allow .to_string() calls
impl fmt::Display for StorableNat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0 .0.to_u64().unwrap_or(0))
    }
}

impl PartialEq<StorableNat> for u64 {
    fn eq(&self, other: &StorableNat) -> bool {
        *self == other.to_u64()
    }
}

impl PartialOrd<StorableNat> for u64 {
    fn partial_cmp(&self, other: &StorableNat) -> Option<std::cmp::Ordering> {
        Some(self.cmp(&other.to_u64()))
    }
}

impl PartialEq<u64> for StorableNat {
    fn eq(&self, other: &u64) -> bool {
        self.to_u64() == *other
    }
}

impl PartialEq<usize> for StorableNat {
    fn eq(&self, other: &usize) -> bool {
        self.to_u64() as usize == *other
    }
}

impl PartialOrd<usize> for StorableNat {
    fn partial_cmp(&self, other: &usize) -> Option<std::cmp::Ordering> {
        Some((self.to_u64() as usize).cmp(other))
    }
}

impl PartialOrd<u64> for StorableNat {
    fn partial_cmp(&self, other: &u64) -> Option<std::cmp::Ordering> {
        self.to_u64().partial_cmp(other)
    }
}

impl From<u64> for StorableNat {
    fn from(value: u64) -> Self {
        Self::from_u64(value)
    }
}

impl From<StorableNat> for u64 {
    fn from(value: StorableNat) -> Self {
        value.to_u64()
    }
}

impl From<StorableNat> for candid::Nat {
    fn from(value: StorableNat) -> Self {
        value.0.clone()
    }
}

impl Add for StorableNat {
    type Output = Self;
    fn add(self, other: Self) -> Self {
        Self(candid::Nat::from(
            CheckedAdd::checked_add(&self.0 .0, &other.0 .0).unwrap_or_else(Zero::zero),
        ))
    }
}

impl Add<u64> for StorableNat {
    type Output = Self;
    fn add(self, other: u64) -> Self {
        self + Self::from(other)
    }
}

impl std::ops::AddAssign for StorableNat {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}

impl Sub for StorableNat {
    type Output = Self;
    fn sub(self, other: Self) -> Self {
        if self.0 .0 >= other.0 .0 {
            Self(candid::Nat::from(self.0 .0 - other.0 .0))
        } else {
            Self::default()
        }
    }
}

impl Sub<u64> for StorableNat {
    type Output = Self;
    fn sub(self, other: u64) -> Self {
        self - Self::from(other)
    }
}

impl Mul for StorableNat {
    type Output = Self;
    fn mul(self, other: Self) -> Self {
        Self(candid::Nat::from(
            CheckedMul::checked_mul(&self.0 .0, &other.0 .0).unwrap_or_else(Zero::zero),
        ))
    }
}

impl Mul<u64> for StorableNat {
    type Output = Self;
    fn mul(self, other: u64) -> Self {
        self * Self::from(other)
    }
}

impl Div<u64> for StorableNat {
    type Output = Self;
    fn div(self, other: u64) -> Self {
        if other == 0 {
            Self::default()
        } else {
            Self(candid::Nat::from(self.0 .0 / num_bigint::BigUint::from(other)))
        }
    }
}

impl std::iter::Sum for StorableNat {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Self(candid::Nat::from(0u64)), |a, b| a + b)
    }
}

impl Storable for StorableNat {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// Hash implementation is provided by the #[derive(Hash)] attribute

// Legacy type definition - use types.rs module for new code
pub type MarketId = StorableNat;
pub type Timestamp = StorableNat;

pub fn serialize_nat<S>(nat: &StorableNat, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&nat.inner().to_string())
}

pub fn deserialize_nat<'de, D>(deserializer: D) -> Result<StorableNat, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    let nat = candid::Nat::from_str(&s).map_err(serde::de::Error::custom)?;
    Ok(StorableNat(nat))
}
