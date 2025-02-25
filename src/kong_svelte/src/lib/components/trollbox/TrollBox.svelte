<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/services/auth';
  import { MessagesSquare, X, Smile, AlertCircle, HelpCircle } from 'lucide-svelte';
  import { slide, fade, crossfade } from 'svelte/transition';
  import * as trollboxApi from '$lib/api/trollbox';
  import type { Message } from '$lib/api/trollbox';
  import { browser } from '$app/environment';
  import MessageItem from './MessageItem.svelte';
  import InstructionsPanel from './InstructionsPanel.svelte';
  import PendingMessageItem from './PendingMessageItem.svelte';
  import { Principal } from '@dfinity/principal';

  let messages: Message[] = [];
  let messageInput = '';
  let chatContainer: HTMLElement;
  let isOpen = false;
  let nextCursor: bigint | null = null;
  let isLoading = false;
  let pendingMessages: Array<{ message: string; created_at: bigint; id: string }> = [];
  let isLoadingMore = false;
  let hasMoreMessages = true;
  let showEmojiPicker = false;
  let emojiPickerContainer: HTMLElement;
  let emojiButton: HTMLElement;
  let windowWidth: number;
  let pollInterval: ReturnType<typeof setInterval>;
  let errorMessage: string = '';
  let errorTimeout: ReturnType<typeof setTimeout> | null = null;
  let isUserAdmin = false;
  let deletingMessageIds: Set<bigint> = new Set();
  let confirmingMessageIds: Set<bigint> = new Set();
  let showInstructions = false;
  let bannedUsers: Map<string, bigint> = new Map();
  let banningUsers: Set<string> = new Set();

  // Create a crossfade transition
  const [send, receive] = crossfade({
    duration: 300,
    fallback: (node) => {
      return {
        duration: 300,
        css: (t) => `
          opacity: ${t};
          transform: scale(${t});
        `
      };
    }
  });

  async function checkAdminStatus() {
    isUserAdmin = await trollboxApi.isAdmin();
  }

  async function initialize() {
    if (browser) {
      await import('emoji-picker-element');
    }
    loadMessages();
    if ($auth.isConnected) {
      checkAdminStatus();
    }
    
    // Check for banned users periodically
    checkBannedUsers();
  }

  onMount(() => {
    initialize();
    
    // Start polling for new messages
    pollInterval = setInterval(loadMessages, 7000);

    // Watch auth changes to check admin status when user connects
    const unsubscribe = auth.subscribe(async (authState) => {
      if (authState.isConnected) {
        checkAdminStatus();
      } else {
        isUserAdmin = false;
      }
    });

    // Handle clicking outside of emoji picker
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && 
          emojiPickerContainer && 
          !emojiPickerContainer.contains(event.target as Node) &&
          !emojiButton.contains(event.target as Node)) {
        showEmojiPicker = false;
      }
    };

    const handleResize = () => {
      windowWidth = window.innerWidth;
    };

    handleResize();
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      clearInterval(pollInterval);
      unsubscribe();
      if (errorTimeout) clearTimeout(errorTimeout);
    };
  });

  function isNearBottom() {
    if (!chatContainer) return false;
    const threshold = 100; // pixels from bottom
    return (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < threshold;
  }

  async function loadMessages() {
    try {
      isLoading = true;
      const wasAtBottom = isNearBottom();
      // Load initial messages without a cursor to get newest messages
      const result = await trollboxApi.getMessages();
      
      if (messages.length === 0) {
        // First load - set all messages
        messages = result.messages.sort((a, b) => Number(a.created_at - b.created_at));
        nextCursor = result.next_cursor;
        hasMoreMessages = result.next_cursor !== null;
        setTimeout(scrollToBottom, 0);
        
        // Check for banned users
        await checkBannedUsers();
      } else {
        // Interval update - only add new messages that we don't have
        const latestMessageTime = messages[messages.length - 1].created_at;
        const newMessages = result.messages.filter(msg => msg.created_at > latestMessageTime);
        
        if (newMessages.length > 0) {
          messages = [...messages, ...newMessages.sort((a, b) => Number(a.created_at - b.created_at))];
          // Only scroll to bottom if user was already at bottom
          if (wasAtBottom) {
            setTimeout(scrollToBottom, 0);
          }
          
          // Check for banned users if we have new messages
          await checkBannedUsers();
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadMoreMessages() {
    if (nextCursor === null || isLoadingMore || !hasMoreMessages) return;

    try {
      isLoadingMore = true;
      const oldHeight = chatContainer.scrollHeight;
      const oldScroll = chatContainer.scrollTop;
      
      // Load older messages using the timestamp cursor
      const result = await trollboxApi.getMessages({
        cursor: nextCursor,  // cursor is already a bigint
        limit: BigInt(20)
      });

      if (result.messages.length === 0) {
        hasMoreMessages = false;
        return;
      }

      // Sort and add older messages at the beginning (they should appear at the top)
      const oldMessages = result.messages.sort((a, b) => Number(a.created_at - b.created_at));
      messages = [...oldMessages, ...messages];
      nextCursor = result.next_cursor;
      hasMoreMessages = result.next_cursor !== null;

      // Maintain scroll position after loading older messages
      setTimeout(() => {
        const newHeight = chatContainer.scrollHeight;
        chatContainer.scrollTop = newHeight - oldHeight + oldScroll;
      }, 0);
    } catch (error) {
      console.error('Error loading more messages:', error);
      hasMoreMessages = false;
    } finally {
      isLoadingMore = false;
    }
  }

  $: if (windowWidth < 640 && showEmojiPicker) {
    // Scroll chat to bottom when emoji picker opens on mobile
    setTimeout(scrollToBottom, 0);
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function showError(message: string, duration: number = 5000) {
    errorMessage = message;
    
    // Clear any existing timeout
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    
    // Set a new timeout to clear the error message
    errorTimeout = setTimeout(() => {
      errorMessage = '';
    }, duration);
  }

  async function handleSubmit() {
    if (!messageInput.trim() || !$auth.isConnected) return;

    const message = messageInput.trim();
    messageInput = '';
    
    // Add pending message with unique id
    const pendingId = crypto.randomUUID();
    const pendingMessage = {
      message,
      created_at: BigInt(Date.now() * 1000000),
      id: pendingId
    };
    pendingMessages = [...pendingMessages, pendingMessage];
    
    // Scroll to bottom after adding pending message
    setTimeout(scrollToBottom, 0);

    try {
      const newMessage = await trollboxApi.createMessage({ message });
      // Remove pending message and add confirmed message
      pendingMessages = pendingMessages.filter(msg => msg.id !== pendingId);
      messages = [...messages, newMessage];
      
      // Scroll to bottom after message is added
      setTimeout(scrollToBottom, 0);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove pending message on error
      pendingMessages = pendingMessages.filter(msg => msg.id !== pendingId);
      
      // Display error message to user
      if (error instanceof Error) {
        showError(error.message);
      } else if (typeof error === 'string') {
        showError(error);
      } else {
        showError('Failed to send message. Please try again later.');
      }
      
      messageInput = message; // Restore message input on error
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const scrollThreshold = 100;
    
    if (target.scrollTop <= scrollThreshold && nextCursor !== null && !isLoadingMore && hasMoreMessages) {
      loadMoreMessages();
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }

  function handleEmojiSelect(event: CustomEvent) {
    const emoji = event.detail.unicode;
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    
    messageInput = messageInput.slice(0, start) + emoji + messageInput.slice(end);
    
    // Set cursor position after emoji
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + emoji.length;
      input.focus();
    }, 0);
  }

  function requestDeleteConfirmation(messageId: bigint) {
    confirmingMessageIds = new Set(confirmingMessageIds).add(messageId);
  }

  function cancelDeleteConfirmation(messageId: bigint) {
    const newSet = new Set(confirmingMessageIds);
    newSet.delete(messageId);
    confirmingMessageIds = newSet;
  }

  async function handleDeleteMessage(messageId: bigint) {
    // Skip confirmation if already confirmed
    if (!confirmingMessageIds.has(messageId)) {
      requestDeleteConfirmation(messageId);
      return;
    }

    // Clear confirmation state
    const newConfirmingIds = new Set(confirmingMessageIds);
    newConfirmingIds.delete(messageId);
    confirmingMessageIds = newConfirmingIds;
    
    try {
      deletingMessageIds = new Set(deletingMessageIds).add(messageId);
      
      // Small delay to show the deletion animation before actually deleting
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await trollboxApi.deleteMessage(messageId);
      
      // Small delay after deletion for visual feedback
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Remove message from the local state
      messages = messages.filter(msg => msg.id !== messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      if (error instanceof Error) {
        showError(error.message);
      } else {
        showError('Failed to delete message');
      }
    } finally {
      const newDeletingIds = new Set(deletingMessageIds);
      newDeletingIds.delete(messageId);
      deletingMessageIds = newDeletingIds;
    }
  }

  function toggleInstructions() {
    showInstructions = !showInstructions;
    // Remove automatic scrolling to preserve user's scroll position
  }

  // Check the ban status of all unique users in the messages
  async function checkBannedUsers() {
    if (!messages.length) return;
    
    // Get all unique user principals
    const uniqueUsers = [...new Set(messages.map(m => m.principal.toText()))];
    
    // Check ban status for each user
    for (const principalText of uniqueUsers) {
      try {
        const principal = Principal.fromText(principalText);
        const remainingTime = await trollboxApi.checkBanStatus(principal);
        
        if (remainingTime !== null) {
          // User is banned
          bannedUsers.set(principalText, remainingTime);
        } else {
          // User is not banned, remove from the map if they were previously banned
          if (bannedUsers.has(principalText)) {
            bannedUsers.delete(principalText);
          }
        }
      } catch (error) {
        console.error('Error checking ban status:', error);
      }
    }
    
    // Force update
    bannedUsers = bannedUsers;
  }

  // Ban a user for the specified number of days
  async function handleBanUser(principal: Principal, days: number) {
    if (!isUserAdmin) return;
    
    const principalText = principal.toText();
    // Prevent multiple ban operations on the same user
    if (banningUsers.has(principalText)) return;
    
    try {
      banningUsers.add(principalText);
      await trollboxApi.banUser(principal, BigInt(days));
      
      // Update the banned users map
      const banSeconds = days * 24 * 60 * 60;
      bannedUsers.set(principalText, BigInt(banSeconds));
      bannedUsers = bannedUsers; // Force update
      
      // Show success message
      showError(`User banned for ${days} day${days > 1 ? 's' : ''}.`, 3000);
    } catch (error) {
      console.error('Error banning user:', error);
      showError('Failed to ban user. Please try again.');
    } finally {
      banningUsers.delete(principalText);
    }
  }

  // Unban a user
  async function handleUnbanUser(principal: Principal) {
    if (!isUserAdmin) return;
    
    const principalText = principal.toText();
    // Prevent multiple operations on the same user
    if (banningUsers.has(principalText)) return;
    
    try {
      banningUsers.add(principalText);
      await trollboxApi.unbanUser(principal);
      
      // Update the banned users map
      if (bannedUsers.has(principalText)) {
        bannedUsers.delete(principalText);
        bannedUsers = bannedUsers; // Force update
      }
      
      // Show success message
      showError('User has been unbanned.', 3000);
    } catch (error) {
      console.error('Error unbanning user:', error);
      showError('Failed to unban user. Please try again.');
    } finally {
      banningUsers.delete(principalText);
    }
  }
</script>

<!-- Fixed button and chat container -->
<div class="fixed bottom-0 right-4 z-50 flex flex-col items-end gap-1 pb-4">
  <!-- Chat Window -->
  {#if isOpen}
    <div 
      class="flex flex-col bg-kong-surface-dark rounded-lg border border-kong-pm-border shadow-lg
             sm:w-96
             fixed w-[95vw] max-w-lg bottom-16 left-1/2 -translate-x-1/2
             sm:static sm:transform-none mb-2 overflow-hidden"
      style="height: {window.innerWidth < 640 ? 'calc(100vh - 8rem)' : '420px'}"
      transition:fade={{ duration: 200 }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-2.5 border-b border-kong-pm-border bg-kong-surface-dark">
        <div class="flex items-center gap-2">
          <MessagesSquare class="w-5 h-5 text-kong-accent-purple" />
          <h3 class="text-base font-medium text-kong-text-primary">TrollBox</h3>
          {#if isUserAdmin}
            <span class="bg-kong-accent-purple px-1.5 py-0.5 text-white text-xs rounded-sm">Admin</span>
          {/if}
        </div>
        <div class="flex items-center gap-1.5">
          <button 
            on:click={toggleInstructions}
            class="text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors p-1.5 rounded-full"
            title="Help & Tips"
          >
            <HelpCircle class="w-4.5 h-4.5" />
          </button>
          <button 
            on:click={toggleChat}
            class="text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors p-1.5 rounded-full"
          >
            <X class="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <!-- Chat messages -->
      <div 
        bind:this={chatContainer}
        on:scroll={handleScroll}
        class="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-custom relative bg-kong-surface-dark"
      >
        {#if showInstructions}
          <InstructionsPanel onHide={toggleInstructions} />
        {/if}

        {#if isLoadingMore}
          <div class="text-center text-kong-pm-text-secondary py-2 flex items-center justify-center gap-2 text-sm" transition:fade>
            <div class="w-3.5 h-3.5 rounded-full border border-kong-pm-text-secondary border-t-transparent animate-spin"></div>
            <span>Loading older messages...</span>
          </div>
        {:else if !hasMoreMessages && messages.length > 0}
          <div class="text-center text-kong-pm-text-secondary py-1.5 text-xs" transition:fade>
            No more messages
          </div>
        {/if}

        {#if isLoading && !messages.length}
          <div class="text-center text-kong-pm-text-secondary flex items-center justify-center gap-2 py-4 text-sm">
            <div class="w-4 h-4 rounded-full border border-kong-pm-text-secondary border-t-transparent animate-spin"></div>
            <span>Loading messages...</span>
          </div>
        {/if}

        {#each messages as message (message.id)}
          <MessageItem 
            {message}
            {isUserAdmin}
            isDeleting={deletingMessageIds.has(message.id)}
            isConfirming={confirmingMessageIds.has(message.id)}
            onRequestDelete={requestDeleteConfirmation}
            onCancelDelete={cancelDeleteConfirmation}
            onConfirmDelete={handleDeleteMessage}
            onBanUser={handleBanUser}
            onUnbanUser={handleUnbanUser}
            {bannedUsers}
          />
        {/each}

        {#each pendingMessages as pending (pending.id)}
          <PendingMessageItem {pending} avatar={$auth.account.owner.toString() || 'pending'} />
        {/each}
      </div>

      <!-- Error message -->
      {#if errorMessage}
        <div class="px-3.5 py-2.5 bg-red-900/30 border-t border-kong-pm-border flex items-center gap-2" transition:slide={{ duration: 200 }}>
          <AlertCircle class="w-4 h-4 text-red-400 shrink-0" />
          <p class="text-sm text-red-200">{errorMessage}</p>
        </div>
      {/if}

      <!-- Message input -->
      <div class="p-2.5 border-t border-kong-pm-border bg-kong-surface-dark">
        {#if $auth.isConnected}
          <div class="flex gap-2 relative">
            <!-- Emoji button -->
            <button
              bind:this={emojiButton}
              on:click={() => showEmojiPicker = !showEmojiPicker}
              class="shrink-0 p-2 text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors rounded-full"
            >
              <Smile class="w-5 h-5" />
            </button>
            
            <!-- Message input -->
            <input
              type="text"
              bind:value={messageInput}
              on:keypress={handleKeyPress}
              placeholder="Message..."
              class="flex-1 min-w-0 bg-kong-pm-dark text-kong-text-primary text-sm rounded-full px-3.5 py-2 border border-kong-pm-border focus:outline-none focus:border-kong-pm-accent transition-colors"
            />
            
            <!-- Send button - only show when there's text -->
            {#if messageInput.trim()}
              <button
                on:click={handleSubmit}
                class="shrink-0 p-2 rounded-full bg-kong-accent-purple text-white transition-opacity hover:opacity-90 flex items-center justify-center"
                transition:fade={{ duration: 100 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 14 21 3m0 0-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1L21 3"/>
                </svg>
              </button>
            {/if}
            
            <!-- Emoji picker -->
            {#if showEmojiPicker}
              <div 
                bind:this={emojiPickerContainer}
                class="absolute bottom-full mb-2 right-0 z-50 shadow-lg"
                transition:fade={{ duration: 150 }}
              >
                <emoji-picker
                  on:emoji-click={handleEmojiSelect}
                  class="light"
                ></emoji-picker>
              </div>
            {/if}
          </div>
        {:else}
          <div class="text-center text-sm text-kong-pm-text-secondary py-2.5 border border-dashed border-kong-pm-border/30 rounded-md">
            Connect your wallet to chat
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Toggle Button -->
  <button
    on:click={toggleChat}
    class="bg-kong-accent-purple text-white p-3 rounded-full shadow-lg transition-opacity hover:opacity-90 active:opacity-100 flex items-center justify-center"
    style="width: 45px; height: 45px;"
  >
    <MessagesSquare class="w-6 h-6" />
  </button>
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
    background: rgb(var(--pm-border));
    border-radius: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--pm-text-secondary));
  }

  /* Add animation for the progress bar */
  .progress-bar {
    width: 100%;
    animation: progress-animation 2s infinite linear;
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.7) 50%, rgba(239, 68, 68, 0.2) 100%);
    background-size: 200% 100%;
  }

  @keyframes progress-animation {
    0% { background-position: 200% 0; }
    100% { background-position: 0 0; }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .scale-98 {
    transform: scale(0.98);
  }

  :global(emoji-picker) {
    --background: rgb(var(--surface-dark));
    --border-color: rgb(var(--pm-border));
    --indicator-color: rgb(var(--pm-accent));
    --input-border-color: rgb(var(--pm-border));
    --input-font-color: rgb(var(--text-primary));
    --input-placeholder-color: rgb(var(--pm-text-secondary));
    --category-font-color: rgb(var(--text-primary));
    height: 300px;
    width: 100%;
    max-width: 384px; /* 24rem (sm:w-96) */
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  @media (min-width: 640px) {
    :global(emoji-picker) {
      height: 300px;
      width: 100%;
      max-width: 384px;
    }
  }
</style> 