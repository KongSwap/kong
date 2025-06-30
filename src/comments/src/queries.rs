use crate::state::*;
use crate::types::*;
use candid::Principal;

// Helper function to convert Comment to CommentResponse
fn to_comment_response(comment: Comment, caller: &Principal) -> CommentResponse {
    let has_liked = USER_LIKES.with(|likes| {
        likes.borrow()
            .get(caller)
            .map(|user_likes| user_likes.contains(&comment.id))
            .unwrap_or(false)
    });

    CommentResponse {
        id: comment.id,
        context_id: comment.context_id,
        content: comment.content,
        author: comment.author,
        created_at: comment.created_at,
        parent_id: comment.parent_id,
        likes: comment.likes,
        is_edited: comment.is_edited,
        edited_at: comment.edited_at,
        has_liked,
    }
}

#[ic_cdk::query]
pub fn get_comments_by_context(request: GetCommentsRequest) -> CommentsPage {
    let params = request.pagination.unwrap_or(PaginationParams {
        cursor: None,
        limit: None,
    });
    
    // Convert u64 limit to usize, with bounds checking
    let limit = params.limit
        .map(|l| l.try_into().unwrap_or(DEFAULT_PAGE_SIZE))
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .min(MAX_COMMENTS_PER_CONTEXT);

    COMMENT_STORE.with(|store| {
        let store = store.borrow();
        
        // Return early if there are no comments
        if store.len() == 0 {
            return CommentsPage {
                comments: Vec::new(),
                next_cursor: None,
            };
        }

        // Collect comments for the specific context
        let mut comments: Vec<Comment> = store.iter()
            .filter_map(|(_, comment)| {
                if comment.context_id == request.context_id {
                    Some(comment.clone())
                } else {
                    None
                }
            })
            .collect();
        
        // Sort by newest first (using timestamp)
        comments.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        // Apply cursor-based pagination using timestamps
        let start_idx = match params.cursor {
            Some(cursor_timestamp) => comments
                .iter()
                .position(|comment| comment.created_at <= cursor_timestamp)
                .unwrap_or(comments.len()),
            None => 0,
        };

        // Get the page of comments and convert to CommentResponse
        let comments: Vec<CommentResponse> = comments
            .into_iter()
            .skip(start_idx)
            .take(limit)
            .map(|comment| {
                if let Some(principal) = &request.check_likes_for {
                    to_comment_response(comment, principal)
                } else {
                    // No principal provided, so has_liked is always false
                    CommentResponse {
                        id: comment.id,
                        context_id: comment.context_id,
                        content: comment.content,
                        author: comment.author,
                        created_at: comment.created_at,
                        parent_id: comment.parent_id,
                        likes: comment.likes,
                        is_edited: comment.is_edited,
                        edited_at: comment.edited_at,
                        has_liked: false,
                    }
                }
            })
            .collect();

        // Set next cursor to the timestamp of the last comment if we have more comments
        let next_cursor = if comments.len() == limit {
            comments.last().map(|comment| comment.created_at)
        } else {
            None
        };

        CommentsPage {
            comments,
            next_cursor,
        }
    })
}

#[ic_cdk::query]
pub fn get_comment(id: u64) -> Option<Comment> {
    COMMENT_STORE.with(|store| {
        store.borrow().get(&id)
    })
}

#[ic_cdk::query]
pub fn get_context_comment_count(context_id: String) -> u32 {
    CONTEXT_COMMENT_COUNT.with(|counts| {
        counts.borrow().get(&context_id).copied().unwrap_or(0)
    })
}

#[ic_cdk::query]
pub fn get_user_comments(principal: Principal, limit: Option<u32>) -> Vec<Comment> {
    let limit = limit.unwrap_or(50).min(100) as usize;
    
    COMMENT_STORE.with(|store| {
        let mut comments: Vec<Comment> = store.borrow()
            .iter()
            .filter_map(|(_, comment)| {
                if comment.author == principal {
                    Some(comment.clone())
                } else {
                    None
                }
            })
            .collect();
        
        comments.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        comments.truncate(limit);
        comments
    })
}

// New authenticated query to get liked comment IDs for the current user
#[ic_cdk::query]
pub fn get_user_liked_comments() -> Vec<u64> {
    let caller = ic_cdk::api::caller();
    
    USER_LIKES.with(|likes| {
        likes.borrow()
            .get(&caller)
            .map(|user_likes| user_likes.iter().copied().collect())
            .unwrap_or_default()
    })
}

// Batch query to get comment counts for multiple contexts
#[ic_cdk::query]
pub fn get_batch_context_comment_counts(request: BatchCommentCountRequest) -> Vec<ContextCommentCount> {
    CONTEXT_COMMENT_COUNT.with(|counts| {
        let counts_ref = counts.borrow();
        request.context_ids
            .into_iter()
            .map(|context_id| {
                let count = counts_ref.get(&context_id).copied().unwrap_or(0);
                ContextCommentCount {
                    context_id,
                    count,
                }
            })
            .collect()
    })
} 