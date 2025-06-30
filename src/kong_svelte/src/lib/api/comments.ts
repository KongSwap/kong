import { Principal } from '@dfinity/principal';
import { commentsActor } from '$lib/stores/auth';

// Helper functions to create context IDs for different use cases
export const contextId = {
  market: (marketId: string) => `market:${marketId}`,
  token: (canisterId: string) => `token:${canisterId}`,
  pool: (poolId: string) => `pool:${poolId}`,
  page: (path: string) => `page:${path}`,
  custom: (type: string, id: string) => `${type}:${id}`
};

export interface Comment {
  id: bigint;
  context_id: string;
  content: string;
  author: Principal;
  created_at: bigint;
  parent_id: bigint | null;
  likes: number;
  is_edited: boolean;
  edited_at: bigint | null;
  has_liked: boolean;
}

export interface CreateCommentRequest {
  context_id: string;
  content: string;
  parent_id: bigint | null;
}

export interface EditCommentRequest {
  comment_id: bigint;
  content: string;
}

export interface GetCommentsRequest {
  context_id: string;
  pagination?: {
    cursor?: bigint;
    limit?: bigint;
  };
  check_likes_for?: Principal;
}

export interface CommentsPage {
  comments: Comment[];
  next_cursor: bigint | null;
}

export interface BatchCommentCountRequest {
  context_ids: string[];
}

export interface ContextCommentCount {
  context_id: string;
  count: number;
}

class CommentsApiClient {
  private getActor(options?: { anon?: boolean, requiresSigning?: boolean }) {
    const { anon = true, requiresSigning = false } = options || {};
    try {
      return commentsActor({ anon, requiresSigning });
    } catch (error) {
      console.error('Error creating comments actor:', error);
      throw new Error('Failed to create comments actor');
    }
  }

  async createComment(request: CreateCommentRequest): Promise<Comment> {
    try {
      // Try without requiresSigning first to see if that's the issue
      const actor = this.getActor({ anon: false, requiresSigning: false });
      console.log('Creating comment with:', request);
      console.log('Actor:', actor);
      
      const result = await actor.create_comment({
        context_id: request.context_id,
        content: request.content,
        parent_id: request.parent_id ? [request.parent_id] : []
      });

      if ('Err' in result) {
        throw new Error(result.Err);
      }

      return this.transformComment(result.Ok);
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  async editComment(request: EditCommentRequest): Promise<Comment> {
    const actor = this.getActor({ anon: false, requiresSigning: true });
    const result = await actor.edit_comment({
      comment_id: request.comment_id,
      content: request.content
    });

    if ('Err' in result) {
      throw new Error(result.Err);
    }

    return this.transformComment(result.Ok);
  }

  async deleteComment(commentId: bigint): Promise<void> {
    const actor = this.getActor({ anon: false, requiresSigning: true });
    const result = await actor.delete_comment(commentId);

    if ('Err' in result) {
      throw new Error(result.Err);
    }
  }

  async isAdmin(principal: string): Promise<boolean> {
    const actor = this.getActor();
    return await actor.is_admin(principal);
  }

  async likeComment(commentId: bigint): Promise<number> {
    const actor = this.getActor({ anon: false, requiresSigning: true });
    const result = await actor.like_comment(commentId);

    if ('Err' in result) {
      throw new Error(result.Err);
    }

    return Number(result.Ok);
  }

  async unlikeComment(commentId: bigint): Promise<number> {
    const actor = this.getActor({ anon: false, requiresSigning: true });
    const result = await actor.unlike_comment(commentId);

    if ('Err' in result) {
      throw new Error(result.Err);
    }

    return Number(result.Ok);
  }

  async getCommentsByContext(request: GetCommentsRequest): Promise<CommentsPage> {
    const actor = this.getActor();
    const result = await actor.get_comments_by_context({
      context_id: request.context_id,
      pagination: request.pagination ? [{
        cursor: request.pagination.cursor ? [request.pagination.cursor] : [],
        limit: request.pagination.limit ? [request.pagination.limit] : []
      }] : [],
      check_likes_for: request.check_likes_for ? [request.check_likes_for] : []
    });

    return {
      comments: result.comments.map(c => this.transformComment(c)),
      next_cursor: result.next_cursor[0] || null
    };
  }

  async getContextCommentCount(contextId: string): Promise<number> {
    const actor = this.getActor();
    const count = await actor.get_context_comment_count(contextId);
    return Number(count);
  }

  async getBatchContextCommentCounts(contextIds: string[]): Promise<ContextCommentCount[]> {
    const actor = this.getActor();
    const result = await actor.get_batch_context_comment_counts({
      context_ids: contextIds
    });
    return result.map(r => ({
      context_id: r.context_id,
      count: Number(r.count)
    }));
  }

  async getUserComments(principal: Principal, limit?: number): Promise<Comment[]> {
    const actor = this.getActor();
    const comments = await actor.get_user_comments(
      principal, 
      limit ? [limit] : []
    );
    return comments.map(c => this.transformComment(c));
  }

  private transformComment(raw: any): Comment {
    return {
      id: raw.id,
      context_id: raw.context_id,
      content: raw.content,
      author: raw.author,
      created_at: raw.created_at,
      parent_id: raw.parent_id[0] || null,
      likes: Number(raw.likes),
      is_edited: raw.is_edited,
      edited_at: raw.edited_at[0] || null,
      has_liked: raw.has_liked || false
    };
  }
}

export const commentsApi = new CommentsApiClient();