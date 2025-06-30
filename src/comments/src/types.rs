use candid::{CandidType, Deserialize, Principal};
use ic_stable_structures::Storable;
use serde::Serialize;

// Constants
pub const MAX_COMMENT_LENGTH: usize = 500; // Longer for detailed content analysis
pub const MAX_COMMENTS_PER_CONTEXT: usize = 5000; // Keep more comments per context
pub const DEFAULT_PAGE_SIZE: usize = 20;

// Comment structure for generic contexts
#[derive(Debug, Clone, CandidType, Deserialize, Serialize)]
pub struct Comment {
    pub id: u64,
    pub context_id: String,  // ID of the context (e.g., prediction market, discussion thread, etc.)
    pub content: String,
    pub author: Principal,
    pub created_at: u64,
    pub parent_id: Option<u64>,  // For threaded comments
    pub likes: u32,
    pub is_edited: bool,
    pub edited_at: Option<u64>,
}

impl Storable for Comment { 
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let bytes = serde_json::to_vec(&self).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

// Response type that includes whether current user has liked the comment
#[derive(Debug, Clone, CandidType, Deserialize, Serialize)]
pub struct CommentResponse {
    pub id: u64,
    pub context_id: String,
    pub content: String,
    pub author: Principal,
    pub created_at: u64,
    pub parent_id: Option<u64>,
    pub likes: u32,
    pub is_edited: bool,
    pub edited_at: Option<u64>,
    pub has_liked: bool,  // Whether the current user has liked this comment
}

#[derive(CandidType, Deserialize)]
pub struct PaginationParams {
    pub cursor: Option<u64>,  // Timestamp in nanoseconds
    pub limit: Option<u64>,   // nat64 in Candid
}

#[derive(CandidType)]
pub struct CommentsPage {
    pub comments: Vec<CommentResponse>,  // Changed back to Vec<CommentResponse>
    pub next_cursor: Option<u64>,
}

#[derive(CandidType, Deserialize)]
pub struct CreateCommentRequest {
    pub context_id: String,
    pub content: String,
    pub parent_id: Option<u64>,
}

#[derive(CandidType, Deserialize)]
pub struct EditCommentRequest {
    pub comment_id: u64,
    pub content: String,
}

#[derive(CandidType, Deserialize)]
pub struct GetCommentsRequest {
    pub context_id: String,
    pub pagination: Option<PaginationParams>,
    pub check_likes_for: Option<Principal>,  // Optional principal to check likes for
}

#[derive(CandidType, Deserialize)]
pub struct BatchCommentCountRequest {
    pub context_ids: Vec<String>,
}

#[derive(CandidType, Serialize)]
pub struct ContextCommentCount {
    pub context_id: String,
    pub count: u32,
} 