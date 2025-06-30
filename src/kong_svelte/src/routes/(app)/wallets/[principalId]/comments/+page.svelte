<script lang="ts">
  import { Principal } from "@dfinity/principal";
  import { commentsApi } from "$lib/api/comments";
  import Card from "$lib/components/common/Card.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatDistanceToNow } from "$lib/utils/dateUtils";
  import {
    MessageSquare,
    Calendar,
    Edit,
    Trash2,
    ExternalLink,
  } from "lucide-svelte";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import type { Comment } from "$lib/api/comments";

  let { data } = $props();
  let { principalId } = data;

  let comments = $state<Comment[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Check if this is the current user's wallet
  const isOwnWallet = $derived($auth.account?.owner === principalId);

  // Load user comments
  async function loadUserComments() {
    try {
      loading = true;
      error = null;
      const principal = Principal.fromText(principalId);
      comments = await commentsApi.getUserComments(principal, 100);
    } catch (err) {
      console.error("Failed to load comments:", err);
      error = "Failed to load comments";
    } finally {
      loading = false;
    }
  }

  // Navigate to the context where the comment was made
  function navigateToContext(comment: Comment) {
    // Parse context ID to determine where to navigate
    if (comment.context_id.startsWith("market:")) {
      const marketId = comment.context_id.replace("market:", "");
      goto(`/predict/${marketId}`);
    } else if (comment.context_id.startsWith("token:")) {
      const tokenId = comment.context_id.replace("token:", "");
      goto(`/tokens/${tokenId}`);
    } else if (comment.context_id.startsWith("pool:")) {
      const poolId = comment.context_id.replace("pool:", "");
      goto(`/pools/${poolId}`);
    }
  }

  // Format context name for display
  function formatContextName(contextId: string): string {
    if (contextId.startsWith("market:")) {
      return `Market #${contextId.replace("market:", "")}`;
    } else if (contextId.startsWith("token:")) {
      return `Token Discussion`;
    } else if (contextId.startsWith("pool:")) {
      return `Pool Discussion`;
    }
    return contextId;
  }

  // Load comments on mount
  $effect(() => {
    loadUserComments();
  });
</script>

<Panel className="mt-4">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-2">
      <MessageSquare class="w-5 h-5 text-kong-text-secondary" />
      <h2 class="text-xl font-semibold">
        {isOwnWallet ? "Your Comments" : "User Comments"}
      </h2>
    </div>
    <span class="text-sm text-kong-text-secondary">
      {comments.length} comment{comments.length !== 1 ? "s" : ""}
    </span>
  </div>

  {#if loading}
    <div class="flex justify-center py-8">
      <div class="text-kong-text-secondary">Loading comments...</div>
    </div>
  {:else if error}
    <div class="text-center py-8 text-kong-error">
      {error}
    </div>
  {:else if comments.length === 0}
    <div class="text-center py-8 text-kong-text-secondary">
      {isOwnWallet
        ? "You haven't made any comments yet."
        : "This user hasn't made any comments yet."}
    </div>
  {:else}
    <div class="space-y-4">
      {#each comments as comment}
        <Card
          className="p-4 hover:bg-kong-bg-tertiary/50 transition-colors cursor-pointer"
          onclick={() => navigateToContext(comment)}
        >
          <div class="flex flex-col gap-3">
            <!-- Header with context and timestamp -->
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2 text-kong-text-secondary">
                <span class="font-medium text-kong-text-primary">
                  {formatContextName(comment.context_id)}
                </span>
                <span>•</span>
                <Calendar class="w-3 h-3" />
                <span
                  >{formatDistanceToNow(
                    Number(comment.created_at) / 1_000_000,
                  )}</span
                >
                {#if comment.is_edited}
                  <span class="text-xs text-kong-text-secondary/60"
                    >(edited)</span
                  >
                {/if}
              </div>
              <ExternalLink class="w-4 h-4 text-kong-text-secondary" />
            </div>

            <!-- Comment content -->
            <div class="text-kong-text-primary">
              {comment.content}
            </div>

            <!-- Footer with likes and actions -->
            <div class="flex items-center justify-between">
              <div
                class="flex items-center gap-4 text-sm text-kong-text-secondary"
              >
                <span>{comment.likes} like{comment.likes !== 1 ? "s" : ""}</span
                >
                {#if comment.parent_id}
                  <span class="text-xs">Reply to comment</span>
                {/if}
              </div>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</Panel>

<style>
  /* Custom styles if needed */
</style>
