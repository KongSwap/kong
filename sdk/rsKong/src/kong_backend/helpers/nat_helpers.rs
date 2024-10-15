#![allow(dead_code)]

use candid::Nat;
use num_traits::{ToPrimitive, Zero};

pub fn nat_zero() -> Nat {
    Nat::from(0_u128)
}

pub fn nat_is_zero(n: &Nat) -> bool {
    n.0.is_zero()
}

pub fn nat_10pow(n: u32) -> Nat {
    Nat::from(10_u128.pow(n))
}

// both Nat must have the same decimal precision
pub fn nat_add(n1: &Nat, n2: &Nat) -> Nat {
    n1.clone() + n2.clone()
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
