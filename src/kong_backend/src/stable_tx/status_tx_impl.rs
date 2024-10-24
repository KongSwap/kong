use super::status_tx::StatusTx;

impl std::fmt::Display for StatusTx {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            StatusTx::Success => write!(f, "Success"),
            StatusTx::Failed => write!(f, "Failed"),
        }
    }
}
