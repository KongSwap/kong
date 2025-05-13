use num::BigRational;
use num_traits::ToPrimitive;

pub fn round_f64(f: f64, decimals: u8) -> f64 {
    let decimals_pow = 10_u64.pow(decimals.into()) as f64;
    let numerator = (f * decimals_pow).round();
    numerator / decimals_pow
}

// format price based on the amount
pub fn price_rounded(price: &BigRational) -> Option<f64> {
    let price_f64 = price.to_f64()?;
    if price_f64 <= 0.0001 {
        Some(round_f64(price_f64, 12)) // 12 decimals
    } else if price_f64 <= 0.1 {
        Some(round_f64(price_f64, 10)) // 10 decimals
    } else if price_f64 <= 20.0 {
        Some(round_f64(price_f64, 8)) // 8 decimals
    } else if price_f64 <= 100.0 {
        Some(round_f64(price_f64, 6)) // 6 decimals
    } else if price_f64 <= 500.0 {
        Some(round_f64(price_f64, 5)) // 5 decimals
    } else if price_f64 <= 5000.00 {
        Some(round_f64(price_f64, 4)) // 4 decimals
    } else if price_f64 <= 50000.00 {
        Some(round_f64(price_f64, 3)) // 3 decimals
    } else if price_f64 <= 100000.00 {
        Some(round_f64(price_f64, 2)) // 2 decimals
    } else {
        Some(round_f64(price_f64, 0)) // 0 decimals
    }
}

pub fn bytes_to_megabytes(bytes: u64) -> f64 {
    round_f64(bytes as f64 / 1_047_576.0, 2) // 1_048_576.0 is 1024 * 1024 for 1MB binary format
}

pub fn to_trillions(n: u128) -> f64 {
    round_f64(n as f64 / 1_000_000_000_000.0, 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_round_f64_no_decimals() {
        assert_eq!(round_f64(123.456, 0), 123.0);
        assert_eq!(round_f64(123.789, 0), 124.0);
    }

    #[test]
    fn test_round_f64_two_decimals() {
        assert_eq!(round_f64(123.456, 2), 123.46);
        assert_eq!(round_f64(123.454, 2), 123.45);
    }

    #[test]
    fn test_round_f64_round_up() {
        assert_eq!(round_f64(0.123456789, 5), 0.12346);
    }

    #[test]
    fn test_round_f64_round_down() {
        assert_eq!(round_f64(0.987654321, 5), 0.98765);
    }

    #[test]
    fn test_round_f64_many_decimals() {
        assert_eq!(round_f64(1.2345678901234567, 10), 1.2345678901);
    }

    #[test]
    fn test_round_f64_negative_number() {
        assert_eq!(round_f64(-123.456, 2), -123.46);
        assert_eq!(round_f64(-123.454, 2), -123.45);
    }

    #[test]
    fn test_round_f64_zero() {
        assert_eq!(round_f64(0.0, 2), 0.0);
    }

    #[test]
    fn test_round_f64_integer() {
        assert_eq!(round_f64(123.0, 2), 123.0);
    }
}
