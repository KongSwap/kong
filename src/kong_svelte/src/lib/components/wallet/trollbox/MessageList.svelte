<script lang="ts">
  import { fade } from 'svelte/transition';
  import MessageItem from './MessageItem.svelte';
  import PendingMessageItem from './PendingMessageItem.svelte';
  import InstructionsPanel from './InstructionsPanel.svelte';
  import { auth } from '$lib/stores/auth';
  
  // Props and event handlers
  let {
    messages = [],
    pendingMessages = [],
    isLoading = false,
    isLoadingMore = false,
    hasMoreMessages = true,
    showInstructions = false,
    isUserAdmin = false,
    deletingMessageIds = new Set<bigint>(),
    confirmingMessageIds = new Set<bigint>(),
    bannedUsers = new Map<string, bigint>(),
    chatContainer = $bindable<HTMLElement>(),
    onScroll,
    onToggleInstructions,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onBanUser,
    onUnbanUser,
  } = $props<{
    messages?: any[];
    pendingMessages?: any[];
    isLoading?: boolean;
    isLoadingMore?: boolean;
    hasMoreMessages?: boolean;
    showInstructions?: boolean;
    isUserAdmin?: boolean;
    deletingMessageIds?: Set<bigint>;
    confirmingMessageIds?: Set<bigint>;
    bannedUsers?: Map<string, bigint>;
    chatContainer?: HTMLElement;
    onScroll: (event: Event) => void;
    onToggleInstructions: () => void;
    onRequestDelete: (messageId: bigint) => void;
    onCancelDelete: (messageId: bigint) => void;
    onConfirmDelete: (messageId: bigint) => void;
    onBanUser: (principal: any, days: number) => void;
    onUnbanUser: (principal: any) => void;
  }>();

  // State
  let shouldAutoScroll = $state(true);
  let lastMessageCount = $state(0);
  let lastPendingCount = $state(0);

  // Effect to handle scrolling
  $effect(() => {
    const totalMessages = messages.length + pendingMessages.length;
    const hasNewMessages = totalMessages > lastMessageCount + lastPendingCount;
    
    if (chatContainer && (shouldAutoScroll || hasNewMessages)) {
      scrollToBottom();
    }
    
    // Update message counts
    lastMessageCount = messages.length;
    lastPendingCount = pendingMessages.length;
  });

  // Scroll to bottom function
  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // Enhanced scroll handler
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    shouldAutoScroll = isNearBottom;
    
    // Call the original onScroll handler
    onScroll(event);
  }
</script>

<div 
  bind:this={chatContainer}
  on:scroll={handleScroll}
  class="h-full overflow-y-auto p-3 space-y-2.5 scrollbar-custom relative bg-kong-bg-primary"
>
  {#if showInstructions}
    <InstructionsPanel onHide={onToggleInstructions} />
  {/if}

  {#if isLoadingMore}
    <div class="text-center text-kong-text-secondary py-2 flex items-center justify-center gap-2 text-sm" transition:fade>
      <div class="w-3.5 h-3.5 rounded-full border border-kong-text-secondary border-t-transparent animate-spin"></div>
      <span>Loading older messages...</span>
    </div>
  {:else if !hasMoreMessages && messages.length > 0}
    <div class="text-center text-kong-text-secondary py-1.5 text-xs" transition:fade>
      No more messages
    </div>
  {/if}

  {#if isLoading && !messages.length}
    <div class="text-center text-kong-text-secondary flex items-center justify-center gap-2 py-4 text-sm">
      <div class="w-4 h-4 rounded-full border border-kong-text-secondary border-t-transparent animate-spin"></div>
      <span>Loading messages...</span>
    </div>
  {/if}

  {#each messages as message, index (`${message.id.toString()}-${index}`)}
    <MessageItem 
      {message}
      {isUserAdmin}
      isDeleting={deletingMessageIds.has(message.id)}
      isConfirming={confirmingMessageIds.has(message.id)}
      {onRequestDelete}
      {onCancelDelete}
      {onConfirmDelete}
      {onBanUser}
      {onUnbanUser}
      {bannedUsers}
    />
  {/each}

  {#each pendingMessages as pending, index (`pending-${pending.id}-${index}`)}
    <PendingMessageItem {pending} avatar={$auth.account.owner || 'pending'} />
  {/each}
</div>

<style scoped>
  .scrollbar-custom::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    background: rgb(var(--border));
    border-radius: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--text-secondary));
  }
</style> 