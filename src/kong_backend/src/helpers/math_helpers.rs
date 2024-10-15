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
    } else if price_f64 <= 10.0 {
        Some(round_f64(price_f64, 8)) // 8 decimals
    } else if price_f64 <= 100.0 {
        Some(round_f64(price_f64, 6)) // 6 decimals
    } else if price_f64 <= 10000.00 {
        Some(round_f64(price_f64, 4)) // 4 decimals
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
