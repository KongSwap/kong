use ic_cdk::api::time;
use crate::state::*;
use crate::types::*;
use std::collections::HashSet;

#[ic_cdk::update]
pub fn create_comment(request: CreateCommentRequest) -> Result<CommentResponse, String> {
    ic_cdk::println!("create_comment called with context_id: {}", request.context_id);
    
    let caller = ic_cdk::api::caller();
    let current_time = time();
    
    ic_cdk::println!("Caller: {}, Time: {}", caller, current_time);
    
    // Check if user is banned
    if let Some(remaining_ban_seconds) = is_user_banned(&caller) {
        return Err(format!(
            "You are banned from posting for {} more {} until your ban expires.",
            remaining_ban_seconds,
            if remaining_ban_seconds == 1 { "second" } else { "seconds" }
        ));
    }
    
    // Check if user is sending comments too quickly
    let can_send = LAST_COMMENT_TIME.with(|last_time_map| {
        let mut map = last_time_map.borrow_mut();
        if let Some(last_time) = map.get(&caller) {
            if current_time - last_time < MIN_COMMENT_INTERVAL_NS {
                false
            } else {
                map.insert(caller, current_time);
                true
            }
        } else {
            map.insert(caller, current_time);
            true
        }
    });
    
    if !can_send {
        return Err(format!(
            "You're posting comments too quickly. Please wait at least {} seconds between comments.", 
            MIN_COMMENT_INTERVAL_NS / 1_000_000_000
        ));
    }
    
    // Validate parent comment exists if replying
    if let Some(parent_id) = request.parent_id {
        let parent_exists = COMMENT_STORE.with(|store| {
            store.borrow().contains_key(&parent_id)
        });
        if !parent_exists {
            return Err("Parent comment not found".to_string());
        }
    }

    ic_cdk::println!("Validating comment content...");
    let censored_content = validate_comment(&request.content)?;
    ic_cdk::println!("Comment validated successfully");

    let id = COMMENT_COUNTER.with(|counter| {
        let next_id = *counter.borrow();
        ic_cdk::println!("Current comment counter: {}", next_id);
        *counter.borrow_mut() = next_id + 1;
        next_id
    });

    let comment = Comment {
        id,
        context_id: request.context_id.clone(),
        content: censored_content,
        author: caller.clone(),
        created_at: current_time,
        parent_id: request.parent_id,
        likes: 0,
        is_edited: false,
        edited_at: None,
    };

    // Store in stable memory
    COMMENT_STORE.with(|store| {
        store.borrow_mut().insert(id, comment.clone());
    });
    
    // Update context comment count
    CONTEXT_COMMENT_COUNT.with(|counts| {
        let mut counts = counts.borrow_mut();
        let current_count = counts.get(&request.context_id).copied().unwrap_or(0);
        counts.insert(request.context_id, current_count + 1);
    });

    // Convert to CommentResponse
    Ok(CommentResponse {
        id: comment.id,
        context_id: comment.context_id,
        content: comment.content,
        author: comment.author,
        created_at: comment.created_at,
        parent_id: comment.parent_id,
        likes: comment.likes,
        is_edited: comment.is_edited,
        edited_at: comment.edited_at,
        has_liked: false,  // New comments are not liked by the creator
    })
}

#[ic_cdk::update]
pub fn edit_comment(request: EditCommentRequest) -> Result<CommentResponse, String> {
    let caller = ic_cdk::api::caller();
    let current_time = time();
    
    // Get the comment
    let mut comment = COMMENT_STORE.with(|store| {
        store.borrow().get(&request.comment_id)
    }).ok_or("Comment not found")?;
    
    // Check if caller is the author
    if comment.author != caller {
        return Err("You can only edit your own comments".to_string());
    }
    
    // Validate new content
    let censored_content = validate_comment(&request.content)?;
    
    // Update comment
    comment.content = censored_content;
    comment.is_edited = true;
    comment.edited_at = Some(current_time);
    
    // Save updated comment
    COMMENT_STORE.with(|store| {
        store.borrow_mut().insert(comment.id, comment.clone());
    });
    
    // Check if the user has liked this comment
    let has_liked = USER_LIKES.with(|likes| {
        likes.borrow()
            .get(&caller)
            .map(|user_likes| user_likes.contains(&comment.id))
            .unwrap_or(false)
    });
    
    // Convert to CommentResponse
    Ok(CommentResponse {
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
    })
}

#[ic_cdk::update]
pub fn like_comment(comment_id: u64) -> Result<u32, String> {
    let caller = ic_cdk::api::caller();
    
    // Check if comment exists
    let mut comment = COMMENT_STORE.with(|store| {
        store.borrow().get(&comment_id)
    }).ok_or("Comment not found")?;
    
    // Check if user already liked this comment
    let already_liked = USER_LIKES.with(|likes| {
        let mut likes = likes.borrow_mut();
        let user_likes = likes.entry(caller).or_insert_with(HashSet::new);
        !user_likes.insert(comment_id)
    });
    
    if already_liked {
        return Err("You have already liked this comment".to_string());
    }
    
    // Increment like count
    comment.likes += 1;
    
    // Save updated comment
    COMMENT_STORE.with(|store| {
        store.borrow_mut().insert(comment.id, comment.clone());
    });
    
    Ok(comment.likes)
}

#[ic_cdk::update]
pub fn unlike_comment(comment_id: u64) -> Result<u32, String> {
    let caller = ic_cdk::api::caller();
    
    // Check if comment exists
    let mut comment = COMMENT_STORE.with(|store| {
        store.borrow().get(&comment_id)
    }).ok_or("Comment not found")?;
    
    // Check if user has liked this comment
    let was_liked = USER_LIKES.with(|likes| {
        let mut likes = likes.borrow_mut();
        if let Some(user_likes) = likes.get_mut(&caller) {
            user_likes.remove(&comment_id)
        } else {
            false
        }
    });
    
    if !was_liked {
        return Err("You haven't liked this comment".to_string());
    }
    
    // Decrement like count
    comment.likes = comment.likes.saturating_sub(1);
    
    // Save updated comment
    COMMENT_STORE.with(|store| {
        store.borrow_mut().insert(comment.id, comment.clone());
    });
    
    Ok(comment.likes)
} 