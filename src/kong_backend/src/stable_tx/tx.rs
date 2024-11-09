pub trait Tx {
    fn user_id(&self) -> u32;
    fn ts(&self) -> u64;
}
