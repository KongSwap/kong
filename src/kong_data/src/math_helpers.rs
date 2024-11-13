pub fn round_f64(f: f64, decimals: u8) -> f64 {
    let decimals_pow = 10_u64.pow(decimals.into()) as f64;
    let numerator = (f * decimals_pow).round();
    numerator / decimals_pow
}

pub fn bytes_to_megabytes(bytes: u64) -> f64 {
    round_f64(bytes as f64 / 1_047_576.0, 2) // 1_048_576.0 is 1024 * 1024 for 1MB binary format
}

pub fn to_trillions(n: u128) -> f64 {
    round_f64(n as f64 / 1_000_000_000_000.0, 2)
}
