use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

// Wrapper around candid::Nat that implements Storable
#[derive(candid::CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct StorableVec<T>(pub Vec<T>);

impl<T> StorableVec<T>
{
    // pub fn to_f64(&self) -> f64 {
    //     self.to_u64() as f64
    // }

    // pub fn to_u64(&self) -> u64 {
    //     self.0 .0.to_u64().unwrap_or(0)
    // }

    // pub fn is_zero(&self) -> bool {
    //     self.0 .0.to_u64().unwrap_or(0) == 0
    // }

    pub fn iter(&self) -> std::slice::Iter<'_, T>
    {
        self.0.iter()
    }

    pub fn from_vec(v: Vec<T>) -> Self {
        StorableVec { 0: v }
        // Self(candid::Nat::from(value))
    }

    pub fn inner(&self) -> &Vec<T> {
        &self.0
    }
}

impl<T> Default for StorableVec<T> {
    fn default() -> Self {
        Self(Vec::new())
    }
}

impl<T> From<Vec<T>> for StorableVec<T>
where
    T: Storable,
{
    fn from(value: Vec<T>) -> Self {
        Self::from_vec(value)
    }
}

impl<T> Storable for StorableVec<T>
where
    T: Serialize + for<'de> Deserialize<'de>,
{
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(&self.inner()).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let vec: Vec<T> = match bytes {
            Cow::Borrowed(b) => serde_json::from_slice(b).unwrap(),
            Cow::Owned(o) => serde_json::from_slice(&o).unwrap(),
        };

        StorableVec::from_vec(vec) 
    }

    const BOUND: Bound = Bound::Unbounded;
}

// pub fn serialize_nat<S, T>(nat: &StorableVec<T>, serializer: S) -> Result<S::Ok, S::Error>
// where
//     S: serde::Serializer,
// {
//     serializer.serialize_str(&nat.inner().to_string())
// }

// pub fn deserialize_nat<'de, D, T>(deserializer: D) -> Result<StorableVec<T>, D::Error>
// where
//     D: serde::Deserializer<'de>,
// {
//     let s = String::deserialize(deserializer)?;
//     let nat = candid::Nat::from_str(&s).map_err(serde::de::Error::custom)?;
//     Ok(StorableVec(nat))
// }
