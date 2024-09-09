use candid::Nat;
use num::BigRational;
use num_bigint::{BigInt, BigUint, Sign};
use num_traits::{ToPrimitive, Zero};
use std::cmp::Ordering;

pub fn nat_zero() -> Nat {
    Nat::from(BigUint::zero())
}

pub fn nat_is_zero(n: &Nat) -> bool {
    n.0.is_zero()
}

#[allow(dead_code)]
pub fn nat_to_biguint(n: &Nat) -> BigUint {
    BigUint::from_bytes_be(&n.0.to_bytes_be())
}

pub fn nat_to_bigint(n: &Nat) -> BigInt {
    BigInt::from_bytes_be(Sign::Plus, &n.0.to_bytes_be())
}

pub fn nat_to_u128(n: &Nat) -> Option<u128> {
    n.0.to_u128()
}

pub fn nat_to_u64(n: &Nat) -> Option<u64> {
    n.0.to_u64()
}

#[allow(dead_code)]
pub fn nat_to_f64(n: &Nat) -> Option<f64> {
    n.0.to_f64()
}

#[allow(dead_code)]
pub fn nat_10pow(n: u32) -> Nat {
    Nat::from(10_u128.pow(n))
}

// convert Nat from one decimal precision to another
// to convert from BTC (8 digit precision) to ETH (18 digit precision), call nat_to_decimals(n, 8, 18)
pub fn nat_to_decimals(n: &Nat, from_decimals: u8, to_decimals: u8) -> Nat {
    match from_decimals.cmp(&to_decimals) {
        Ordering::Equal => n.clone(),
        Ordering::Less => {
            let decimal_diff = to_decimals - from_decimals;
            n.clone() * 10_u128.pow(decimal_diff as u32)
        }
        Ordering::Greater => {
            let decimal_diff = from_decimals - to_decimals;
            n.clone() / 10_u128.pow(decimal_diff as u32)
        }
    }
}

// both Nat must have the same decimal precision
pub fn nat_add(n1: &Nat, n2: &Nat) -> Nat {
    n1.clone() + n2.clone()
}

pub fn nat_subtract(n1: &Nat, n2: &Nat) -> Option<Nat> {
    if n1 < n2 {
        None?
    }
    Some(n1.clone() - n2.clone())
}

pub fn nat_multiply(n1: &Nat, n2: &Nat) -> Nat {
    n1.clone() * n2.clone()
}

pub fn nat_multiply_rational(n1: &Nat, n2: &BigRational) -> Option<Nat> {
    let numerator = nat_multiply(n1, &Nat::from(n2.numer().to_biguint()?));
    nat_divide(&numerator, &Nat::from(n2.denom().to_biguint()?))
}

pub fn nat_multiply_f64(n1: &Nat, n2: f64) -> Option<Nat> {
    let n2 = BigRational::from_float(n2)?;
    nat_multiply_rational(n1, &n2)
}

// integer division
pub fn nat_divide(numerator: &Nat, denominator: &Nat) -> Option<Nat> {
    if nat_is_zero(numerator) {
        return Some(nat_zero());
    }
    if nat_is_zero(denominator) {
        None?
    }
    Some(numerator.clone() / denominator.clone())
}

// division with decimal precision
pub fn nat_divide_as_f64(numerator: &Nat, denominator: &Nat) -> Option<f64> {
    if nat_is_zero(numerator) {
        return Some(0_f64);
    }
    if nat_is_zero(denominator) {
        None?
    }
    numerator.0.to_f64().and_then(|n| denominator.0.to_f64().map(|d| n / d))
}

pub fn nat_sqrt(n: &Nat) -> Nat {
    Nat::from(n.0.sqrt())
}
