use candid::Nat;
use num::BigRational;
use num_bigint::{BigInt, BigUint, Sign};
use num_traits::{pow, ToPrimitive, Zero};
use std::cmp::Ordering;

use crate::helpers::math_helpers::round_f64;

pub fn nat_zero() -> Nat {
    Nat::from(0_u128)
}

pub fn nat_is_zero(n: &Nat) -> bool {
    n.0.is_zero()
}

pub fn nat_to_biguint(n: &Nat) -> BigUint {
    BigUint::from_bytes_be(&n.0.to_bytes_be())
}

pub fn nat_to_bigint(n: &Nat) -> BigInt {
    BigInt::from_bytes_be(Sign::Plus, &n.0.to_bytes_be())
}

#[allow(dead_code)]
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
pub fn nat_10pow(n: u8) -> Nat {
    Nat::from(10_u128.pow(n as u32))
}

/// Convert Nat to f64 with decimals
pub fn nat_to_decimals_f64(decimals: u8, amount: &Nat) -> Option<f64> {
    let numerator = nat_to_biguint(amount);
    let denominator = pow(BigInt::from(10), decimals.into());
    let real_amount = BigRational::new(numerator.into(), denominator).to_f64()?;
    Some(round_f64(real_amount, decimals))
}

// convert Nat from one decimal precision to another
// to convert from BTC (8 digit precision) to ETH (18 digit precision), call nat_to_decimals(n, 8, 18)
pub fn nat_to_decimal_precision(n: &Nat, from_decimal_precision: u8, to_decimal_precision: u8) -> Nat {
    match from_decimal_precision.cmp(&to_decimal_precision) {
        Ordering::Equal => n.clone(),
        Ordering::Less => {
            let decimal_diff = to_decimal_precision - from_decimal_precision;
            n.clone() * 10_u128.pow(decimal_diff as u32)
        }
        Ordering::Greater => {
            let decimal_diff = from_decimal_precision - to_decimal_precision;
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

#[allow(dead_code)]
pub fn nat_multiply_rational(n1: &Nat, n2: &BigRational) -> Option<Nat> {
    let numerator = nat_multiply(n1, &Nat::from(n2.numer().to_biguint()?));
    nat_divide(&numerator, &Nat::from(n2.denom().to_biguint()?))
}

pub fn nat_multiply_f64(n1: &Nat, n2: f64) -> Option<Nat> {
    let n2 = BigRational::from_float(n2)?;
    nat_multiply_rational(n1, &n2)
}

// integer division
#[allow(dead_code)]
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
#[allow(dead_code)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nat_to_biguint() {
        let s1 = String::from("100_000_000_000_000_000_000_000_000_000_000");
        let n1 = Nat::parse(s1.as_bytes()).unwrap();
        let b1 = nat_to_biguint(&n1);
        assert_eq!(n1.0, b1);

        let s2 = 1_u128;
        let n2 = nat_to_decimal_precision(&Nat::from(s2), 0, 18);
        assert_eq!(n2, Nat::from(1_000_000_000_000_000_000_u128));

        let precision = Nat::from(1_000_u128);
        let div = n1 * precision / n2;
        let x = div.to_string();
        println!("x: {}", x);
    }

    #[test]
    fn test_nat_to_decimal() {
        let n = Nat::from(1_000_000_000_000_000_000_u128);

        let x = nat_to_decimal_precision(&n, 18, 0);
        assert_eq!(x, Nat::from(1_u128));

        let x = nat_to_decimal_precision(&n, 18, 8);
        assert_eq!(x, Nat::from(100_000_000_u128));

        let x = nat_to_decimal_precision(&n, 18, 4);
        assert_eq!(x, Nat::from(10_000_u128));

        // lose precision
        let n = Nat::from(1_000_000_u128);
        let x = nat_to_decimal_precision(&n, 18, 8);
        assert_eq!(x, Nat::from(0_u128));
        let n = Nat::from(12_222_222_222_u128);
        let x = nat_to_decimal_precision(&n, 18, 8);
        assert_eq!(x, Nat::from(1_u128));

        let n = Nat::from(100_000_000_u128);
        let x = nat_to_decimal_precision(&n, 8, 12);
        assert_eq!(x, Nat::from(1_000_000_000_000_u128));

        let x = nat_to_decimal_precision(&n, 8, 18);
        assert_eq!(x, Nat::from(1_000_000_000_000_000_000_u128));
    }

    #[test]
    fn test_nat_add() {
        let n1 = Nat::from(1_u128);
        let n2 = Nat::from(2_u128);
        let x = nat_add(&n1, &n2);
        assert_eq!(x, Nat::from(3_u128));
    }

    #[test]
    fn test_nat_subtract() {
        let n1 = Nat::from(1_u128);
        let n2 = Nat::from(2_u128);
        let x = nat_subtract(&n1, &n2);
        assert_eq!(x, None);

        let n1 = Nat::from(2_u128);
        let n2 = Nat::from(1_u128);
        let x = nat_subtract(&n1, &n2);
        assert_eq!(x, Some(Nat::from(1_u128)));
    }

    #[test]
    fn test_nat_multiply() {
        let n1 = Nat::from(1_000_000_000_u128);
        let n2 = Nat::from(500_000_000_u128);
        let x = nat_multiply(&n1, &n2);
        assert_eq!(x, Nat::from(500_000_000_000_000_000_u128));

        let n0 = Nat::from(200_000_000_u128);
        let n1 = Nat::from(47_471_602_527_u128);
        let n2 = nat_multiply(&n0, &n1);
        let n3 = Nat::from(18_977_254_u128);
        let n4 = Nat::from(500_300_000_000_u128);
        let n5 = nat_multiply(&n3, &n4);
        println!("n2: {} n5: {}", n2, n5);
        assert_eq!(n2, n5);
    }

    #[test]
    fn test_nat_divide() {
        let n1 = Nat::from(5_000_000_000_u128);
        let n2 = Nat::from(0_u128);
        let x = nat_divide(&n1, &n2);
        assert_eq!(x, None);

        let n1 = Nat::from(5_000_000_000_u128);
        let n2 = Nat::from(1_000_000_000_u128);
        let x = nat_divide(&n1, &n2);
        assert_eq!(x, Some(Nat::from(5_u128)));
    }

    #[test]
    fn test_nat_divide_f64() {
        let n1 = Nat::from(5_000_000_000_u128);
        let n2 = Nat::from(0_u128);
        let x = nat_divide_as_f64(&n1, &n2);
        assert_eq!(x, None);

        let n1 = Nat::from(5_000_000_000_u128);
        let n2 = Nat::from(1_000_000_000_u128);
        let x = nat_divide_as_f64(&n1, &n2);
        assert_eq!(x, Some(5.0_f64));
    }

    #[test]
    fn test_nat_sqrt() {
        let n = Nat::from(0_u128);
        let x = nat_sqrt(&n);
        assert_eq!(x, Nat::from(0_u128));

        let n = Nat::from(9_u128);
        let x = nat_sqrt(&n);
        assert_eq!(x, Nat::from(3_u128));

        let n = Nat::from(18_u128);
        let x = nat_sqrt(&n);
        assert_eq!(x, Nat::from(4_u128));

        let n = Nat::from(24_u128);
        let x = nat_sqrt(&n);
        assert_eq!(x, Nat::from(4_u128));

        let base = BigUint::from(10_u32);
        let precision = base.pow(18_u32);
        let n = Nat::from(24_u64 * &precision);
        let x = nat_sqrt(&n);
        assert_eq!(x, Nat::from(4_898_979_485_u64));
    }
}
