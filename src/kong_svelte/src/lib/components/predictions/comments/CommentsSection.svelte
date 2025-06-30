<script lang="ts">
  import { commentsApi } from "$lib/api/comments";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import CommentItem from "./CommentItem.svelte";
  import CommentInput from "./CommentInput.svelte";
  import Card from "$lib/components/common/Card.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { MessageSquare, Loader2 } from "lucide-svelte";
  import { Principal } from "@dfinity/principal";

  let { contextId, className = "" } = $props<{
    contextId: string;
    className?: string;
  }>();

  // State - consolidated into a single reactive object for better performance
  let state = $state({
    comments: [] as any[],
    loading: true,
    loadingMore: false,
    nextCursor: null as bigint | null,
    commentCount: 0,
    error: null as string | null,
    editingCommentId: null as bigint | null,
    isAdmin: false,
  });

  // Load comments - optimized with early returns and cleaner state updates
  async function loadComments(append = false, isBackgroundRefresh = false) {
    if (append && (!state.nextCursor || state.loadingMore)) return;

    // Don't show loading state for background refreshes
    if (!isBackgroundRefresh) {
      state.loadingMore = append;
      state.loading = !append;
      state.error = null;
    }

    try {
      const checkLikesFor = $auth.account?.owner
        ? Principal.fromText($auth.account.owner)
        : undefined;

      const [response, count] = await Promise.all([
        commentsApi.getCommentsByContext({
          context_id: contextId,
          pagination: {
            cursor: append ? state.nextCursor : undefined,
            limit: BigInt(20),
          },
          check_likes_for: checkLikesFor,
        }),
        // Only fetch count on initial load
        !append
          ? commentsApi.getContextCommentCount(contextId)
          : Promise.resolve(state.commentCount),
      ]);

      // For background refresh, only update if there are new comments
      if (isBackgroundRefresh && !append) {
        const hasNewComments =
          response.comments.length > 0 &&
          (!state.comments.length ||
            response.comments[0].id !== state.comments[0].id);

        if (hasNewComments) {
          // Show a subtle notification
          toastStore.info("New comments available");
        }
      }

      state.comments = append
        ? [...state.comments, ...response.comments]
        : response.comments;
      state.nextCursor = response.next_cursor;
      state.commentCount = count;
    } catch (e) {
      console.error("Failed to load comments:", e);
      if (!isBackgroundRefresh) {
        state.error =
          e instanceof Error ? e.message : "Failed to load comments";
        if (!append) toastStore.error("Failed to load comments");
      }
    } finally {
      if (!isBackgroundRefresh) {
        state.loading = false;
        state.loadingMore = false;
      }
    }
  }

  // Optimized handlers with better state management
  const handlers = {
    loadMore: () => loadComments(true),

    commentCreated: async (newComment?: any) => {
      if (newComment) {
        // Optimistically add the comment instead of reloading all
        state.comments = [newComment, ...state.comments];
        state.commentCount++;
      } else {
        await loadComments();
      }
    },

    commentDeleted: (commentId: bigint) => {
      state.comments = state.comments.filter((c) => c.id !== commentId);
      state.commentCount = Math.max(0, state.commentCount - 1);
    },

    commentEdited: (comment: any) => {
      const index = state.comments.findIndex((c) => c.id === comment.id);
      if (index !== -1) {
        state.comments[index] = comment;
      }
    },

    startEdit: (commentId: bigint) => {
      state.editingCommentId = commentId;
    },

    cancelEdit: () => {
      state.editingCommentId = null;
    },
  };

  // Optimized comment tree building with single pass
  let commentTree = $derived.by(() => {
    if (!state.comments.length) return [];

    const tree: any[] = [];
    const commentMap = new Map<bigint, any>();

    // Single pass: build map and identify roots
    for (const comment of state.comments) {
      const node = { ...comment, replies: [] };
      commentMap.set(comment.id, node);

      if (!comment.parent_id) {
        tree.push(node);
      }
    }

    // Attach children to parents
    for (const comment of state.comments) {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        } else {
          // Orphaned comment - add to root
          tree.push(commentMap.get(comment.id));
        }
      }
    }

    // Sort root comments by newest first
    return tree.sort((a, b) => Number(b.created_at - a.created_at));
  });

  // Check if current user is admin
  async function checkAdminStatus() {
    if ($auth.account?.owner) {
      try {
        state.isAdmin = await commentsApi.isAdmin($auth.account.owner);
      } catch (e) {
        console.error("Failed to check admin status:", e);
        state.isAdmin = false;
      }
    }
  }

  // Load comments on mount with AbortController for cleanup and polling
  $effect(() => {
    const controller = new AbortController();
    let pollInterval: number | null = null;

    // Initial load
    loadComments();

    // Check admin status
    checkAdminStatus();

    // Set up polling every 15 seconds
    pollInterval = window.setInterval(() => {
      if (!controller.signal.aborted && !state.loading && !state.loadingMore) {
        loadComments(false, true); // false = not append, true = background refresh
      }
    }, 15000);

    // Listen for refresh events
    const handleRefresh = () => {
      if (!controller.signal.aborted) {
        loadComments();
      }
    };

    window.addEventListener("refreshComments", handleRefresh);

    return () => {
      controller.abort();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("refreshComments", handleRefresh);
    };
  });

  // Re-check admin status when auth changes
  $effect(() => {
    if ($auth.account?.owner) {
      checkAdminStatus();
    } else {
      state.isAdmin = false;
    }
  });
</script>

<Card className="p-4 sm:p-6 {className}">
  <div class="flex items-center justify-between mb-4">
    <h3
      class="text-lg font-semibold text-kong-text-primary flex items-center gap-2"
    >
      <MessageSquare size={20} />
      Comments
      {#if state.commentCount > 0}
        <span class="text-sm font-normal text-kong-text-secondary">
          ({state.commentCount})
        </span>
      {/if}
    </h3>
  </div>

  {#if $auth.isConnected}
    <div class="mb-4">
      <CommentInput {contextId} onCommentCreated={handlers.commentCreated} />
    </div>
  {/if}

  {#if state.loading}
    <div class="flex items-center justify-center py-8">
      <Loader2 class="w-6 h-6 animate-spin text-kong-text-secondary" />
    </div>
  {:else if state.error}
    <div class="text-center py-8">
      <p class="text-kong-error">{state.error}</p>
    </div>
  {:else if commentTree.length === 0}
    <div class="text-center py-8">
      {#if $auth.isConnected}
        <p class="text-kong-text-secondary">
          Be the first to comment on this market!
        </p>
      {:else}
        <div class="text-center py-4 bg-kong-bg-secondary/30 rounded-lg">
          <p class="text-kong-text-secondary mb-3">
            No comments yet. Connect your wallet to join the conversation.
          </p>
          <ButtonV2
            onclick={() => walletProviderStore.open()}
            theme="primary"
            size="lg"
          >
            Connect Wallet
          </ButtonV2>
        </div>
      {/if}
    </div>
  {:else}
    <div class="space-y-4">
      {#each commentTree as comment (comment.id)}
        <CommentItem
          {comment}
          {contextId}
          isEditing={state.editingCommentId === comment.id}
          isAdmin={state.isAdmin}
          onDeleted={handlers.commentDeleted}
          onEdited={handlers.commentEdited}
          onStartEdit={handlers.startEdit}
          onCancelEdit={handlers.cancelEdit}
        />
      {/each}

      {#if state.nextCursor}
        <div class="flex justify-center pt-4">
          <button
            onclick={handlers.loadMore}
            disabled={state.loadingMore}
            class="text-sm text-kong-primary hover:text-kong-primary-hover
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center gap-2"
          >
            {#if state.loadingMore}
              <Loader2 class="w-4 h-4 animate-spin" />
              Loading more...
            {:else}
              Load more comments
            {/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</Card>
