<script lang="ts">
  import { fade } from 'svelte/transition';
  import MessageItem from './MessageItem.svelte';
  import PendingMessageItem from './PendingMessageItem.svelte';
  import InstructionsPanel from './InstructionsPanel.svelte';
  import { auth } from '$lib/services/auth';
  
  // Props
  export let messages = [];
  export let pendingMessages = [];
  export let isLoading = false;
  export let isLoadingMore = false;
  export let hasMoreMessages = true;
  export let showInstructions = false;
  export let isUserAdmin = false;
  export let deletingMessageIds: Set<bigint> = new Set();
  export let confirmingMessageIds: Set<bigint> = new Set();
  export let bannedUsers: Map<string, bigint> = new Map();
  
  // Element bindings
  export let chatContainer: HTMLElement;
  
  // Event handlers as props
  export let onScroll: (event: Event) => void;
  export let onToggleInstructions: () => void;
  export let onRequestDelete: (messageId: bigint) => void;
  export let onCancelDelete: (messageId: bigint) => void;
  export let onConfirmDelete: (messageId: bigint) => void;
  export let onBanUser: (principal: any, days: number) => void;
  export let onUnbanUser: (principal: any) => void;
</script>

<div 
  bind:this={chatContainer}
  on:scroll={onScroll}
  class="h-full overflow-y-auto p-3 space-y-2.5 scrollbar-custom relative bg-kong-bg-dark"
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
      onRequestDelete={onRequestDelete}
      onCancelDelete={onCancelDelete}
      onConfirmDelete={onConfirmDelete}
      onBanUser={onBanUser}
      onUnbanUser={onUnbanUser}
      {bannedUsers}
    />
  {/each}

  {#each pendingMessages as pending, index (`pending-${pending.id}-${index}`)}
    <PendingMessageItem {pending} avatar={$auth.account.owner.toString() || 'pending'} />
  {/each}
</div>

<style>
  /* Custom scrollbar styling */
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