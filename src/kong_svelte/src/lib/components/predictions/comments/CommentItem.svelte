<script lang="ts">
  import { commentsApi } from "$lib/api/comments";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import CommentInput from "./CommentInput.svelte";
  import { formatDistanceToNow } from "date-fns";
  import { parseBasicMarkdown } from "$lib/utils/markdown";
  import ImageModal from "./ImageModal.svelte";
  import {
    Heart,
    MessageCircle,
    Edit2,
    Trash2,
    MoreVertical,
    ChevronDown,
    ChevronUp,
  } from "lucide-svelte";

  let {
    comment,
    contextId,
    isEditing = false,
    isAdmin = false,
    depth = 0,
    onDeleted,
    onEdited,
    onStartEdit,
    onCancelEdit,
  } = $props<{
    comment: any;
    contextId: string;
    isEditing?: boolean;
    isAdmin?: boolean;
    depth?: number;
    onDeleted: (commentId: bigint) => void;
    onEdited: (comment: any) => void;
    onStartEdit: (commentId: bigint) => void;
    onCancelEdit: () => void;
  }>();

  // Consolidated state
  let state = $state({
    isReplying: false,
    isDeleting: false,
    showActions: false,
    hasLiked: comment.has_liked || false,
    likeCount: comment.likes,
    showReplies: true,
    likingInProgress: false,
    modalImage: null as { url: string; alt: string } | null,
  });

  // Constants
  const MAX_DEPTH = 2;
  const AVATAR_SIZE = depth > 0 ? 32 : 40;

  // Memoized derived values
  let isAuthor = $derived(
    $auth.isConnected && $auth.account?.owner === comment.author.toText(),
  );

  let formattedTime = $derived.by(() => {
    try {
      const timestamp = Number(comment.created_at) / 1_000_000;
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "recently";
    }
  });

  let authorName = $derived.by(() => {
    const principal = comment.author.toText();
    return `${principal.slice(0, 5)}...${principal.slice(-3)}`;
  });

  // Optimized handlers
  async function toggleLike() {
    if (!$auth.isConnected || state.likingInProgress) return;

    state.likingInProgress = true;
    const previousState = {
      hasLiked: state.hasLiked,
      likeCount: state.likeCount,
    };

    // Optimistic update
    state.hasLiked = !state.hasLiked;
    state.likeCount += state.hasLiked ? 1 : -1;

    try {
      const newLikes = state.hasLiked
        ? await commentsApi.likeComment(comment.id)
        : await commentsApi.unlikeComment(comment.id);
      state.likeCount = newLikes;
    } catch (e) {
      // Rollback on error
      state.hasLiked = previousState.hasLiked;
      state.likeCount = previousState.likeCount;
      console.error("Failed to toggle like:", e);
      toastStore.error("Failed to update like");
    } finally {
      state.likingInProgress = false;
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    state.isDeleting = true;

    try {
      await commentsApi.deleteComment(comment.id);
      toastStore.success("Comment deleted");
      onDeleted(comment.id);
    } catch (e) {
      console.error("Failed to delete comment:", e);
      toastStore.error("Failed to delete comment");
      state.isDeleting = false;
    }
  }

  function handleEdit() {
    state.showActions = false;
    onStartEdit(comment.id);
  }

  function handleCommentEdited(editedComment: any) {
    onEdited(editedComment);
    onCancelEdit();
  }

  function handleReplyCreated() {
    state.isReplying = false;
    window.dispatchEvent(new CustomEvent("refreshComments"));
  }

  function handleContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      target.tagName === "IMG" &&
      target.classList.contains("comment-image")
    ) {
      const img = target as HTMLImageElement;
      state.modalImage = { url: img.src, alt: img.alt || "" };
    }
  }

  // Click outside handler for actions menu
  $effect(() => {
    if (!state.showActions) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".actions-menu")) {
        state.showActions = false;
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });
</script>

<div class="comment-item {depth > 0 ? 'ml-8 sm:ml-12' : ''}">
  <div class="flex gap-3">
    <!-- Avatar -->
    <div class="flex-shrink-0">
      <img
        src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${comment.author.toText()}&size=${AVATAR_SIZE}`}
        alt="{authorName} avatar"
        class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-kong-dark
               border border-kong-border shadow-sm"
        loading="lazy"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-1">
        <a
          href="/wallets/{comment.author.toText()}"
          class="text-sm font-medium text-kong-text-primary hover:text-kong-primary transition-colors"
        >
          {authorName}
        </a>
        {#if isAdmin && isAuthor}
          <span
            class="text-xs px-1.5 py-0.5 bg-kong-primary/10 text-kong-primary rounded-md font-medium"
          >
            Admin
          </span>
        {/if}
        <span class="text-xs text-kong-text-secondary">
          {formattedTime}
        </span>
        {#if comment.is_edited}
          <span class="text-xs text-kong-text-secondary italic">
            (edited)
          </span>
        {/if}

        {#if isAuthor || isAdmin}
          <div class="ml-auto relative actions-menu">
            <button
              onclick={() => (state.showActions = !state.showActions)}
              class="p-1 rounded hover:bg-kong-bg-secondary/30 transition-colors
                     text-kong-text-secondary hover:text-kong-text-primary"
            >
              <MoreVertical size={16} />
            </button>

            {#if state.showActions}
              <div
                class="absolute right-0 top-full mt-1 bg-kong-bg-secondary
                          border border-kong-border rounded-md shadow-lg py-1 z-10
                          min-w-[120px]"
              >
                {#if isAuthor}
                  <button
                    onclick={handleEdit}
                    class="w-full px-3 py-2 text-sm text-left hover:bg-kong-bg-tertiary/30
                           transition-colors flex items-center gap-2"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                {/if}
                <button
                  onclick={handleDelete}
                  disabled={state.isDeleting}
                  class="w-full px-3 py-2 text-sm text-left hover:bg-kong-bg-tertiary/30
                         transition-colors flex items-center gap-2 text-kong-error
                         disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  {state.isDeleting
                    ? "Deleting..."
                    : isAdmin && !isAuthor
                      ? "Delete (Admin)"
                      : "Delete"}
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Comment content or edit form -->
      {#if isEditing}
        <CommentInput
          {contextId}
          parentId={null}
          editingComment={comment}
          onCommentCreated={handleCommentEdited}
          onCancel={onCancelEdit}
        />
      {:else}
        <p
          class="text-sm text-kong-text-primary whitespace-pre-wrap break-all mb-2 comment-content"
          onclick={handleContentClick}
        >
          {@html parseBasicMarkdown(comment.content)}
        </p>

        <!-- Actions -->
        <div class="flex items-center gap-4">
          <button
            onclick={toggleLike}
            disabled={!$auth.isConnected || state.likingInProgress}
            class="flex items-center gap-1 text-xs transition-colors
                   {state.hasLiked
              ? 'text-kong-error'
              : 'text-kong-text-secondary hover:text-kong-error'}
                   disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Heart size={14} fill={state.hasLiked ? "currentColor" : "none"} />
            {state.likeCount > 0 ? state.likeCount : ""}
          </button>

          {#if $auth.isConnected && depth < MAX_DEPTH}
            <button
              onclick={() => (state.isReplying = !state.isReplying)}
              class="flex items-center gap-1 text-xs text-kong-text-secondary
                     hover:text-kong-primary transition-colors"
            >
              <MessageCircle size={14} />
              Reply
            </button>
          {/if}

          {#if comment.replies?.length > 0}
            <button
              onclick={() => (state.showReplies = !state.showReplies)}
              class="flex items-center gap-1 text-xs text-kong-text-secondary
                     hover:text-kong-primary transition-colors"
            >
              {#if state.showReplies}
                <ChevronUp size={14} />
              {:else}
                <ChevronDown size={14} />
              {/if}
              {comment.replies.length}
              {comment.replies.length === 1 ? "reply" : "replies"}
            </button>
          {/if}
        </div>

        <!-- Reply input -->
        {#if state.isReplying}
          <div class="mt-3">
            <CommentInput
              {contextId}
              parentId={comment.id}
              onCommentCreated={handleReplyCreated}
              onCancel={() => (state.isReplying = false)}
              placeholder="Write a reply..."
            />
          </div>
        {/if}
      {/if}

      <!-- Nested replies -->
      {#if state.showReplies && comment.replies?.length > 0}
        <div class="mt-3 space-y-3">
          {#each comment.replies as reply (reply.id)}
            <svelte:self
              comment={reply}
              {contextId}
              depth={depth + 1}
              {isAdmin}
              {onDeleted}
              {onEdited}
              {onStartEdit}
              {onCancelEdit}
              isEditing={false}
            />
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<ImageModal
  imageUrl={state.modalImage?.url || ""}
  altText={state.modalImage?.alt || ""}
  isOpen={!!state.modalImage}
  onClose={() => (state.modalImage = null)}
/>

<style lang="postcss">
  .comment-item {
    @apply relative;
  }

  .comment-item:not(:last-child) {
    @apply pb-3 mb-3 border-b border-kong-border/20;
  }

  /* Global styles for comment content */
  :global(.comment-content strong) {
    @apply font-semibold text-kong-text-primary;
  }

  :global(.comment-content em) {
    @apply italic;
  }

  :global(.comment-content a) {
    @apply text-kong-primary hover:underline;
  }

  :global(.comment-content code) {
    @apply px-1 py-0.5 bg-kong-bg-secondary rounded text-xs;
    @apply font-mono text-kong-primary;
  }

  :global(.comment-content pre) {
    @apply p-3 my-2 bg-kong-bg-secondary rounded overflow-x-auto;
  }

  :global(.comment-content pre code) {
    @apply p-0 bg-transparent;
  }

  :global(.comment-content blockquote) {
    @apply pl-3 border-l-2 border-kong-border/50 text-kong-text-secondary;
    @apply my-2 italic;
  }

  :global(.comment-content ul),
  :global(.comment-content ol) {
    @apply ml-4 my-2 space-y-1;
  }

  :global(.comment-content ul li) {
    @apply list-disc ml-2;
  }

  :global(.comment-content ol li) {
    @apply list-decimal ml-2;
  }

  :global(.comment-content img) {
    @apply block rounded-md my-2 cursor-pointer;
    max-width: min(100%, 400px);
    height: auto;
    max-height: 300px;
    object-fit: contain;
  }

  :global(.comment-content img:hover) {
    @apply opacity-90;
  }

  /* Specific class for images added via markdown */
  :global(.comment-content .comment-image) {
    @apply shadow-sm border border-kong-border/20;
  }
</style>
