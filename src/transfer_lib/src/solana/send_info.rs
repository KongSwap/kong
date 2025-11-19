pub struct SendInfo {
    pub request_id: u64,
    pub user_id: u32,
    pub ts: Option<u64>,
}

impl Default for SendInfo {
    fn default() -> Self {
        Self { request_id: Default::default(), user_id: Default::default(), ts: None }
    }
}