<!-- TrollboxPanel.svelte -->
<script lang="ts">
  import { MessagesSquare } from "lucide-svelte";
  import { fade, slide } from "svelte/transition";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Badge from "$lib/components/common/Badge.svelte";
  import { auth } from "$lib/stores/auth";
  
  // TrollBox imports
  import { trollboxStore } from "$lib/components/wallet/trollbox/trollboxStore";
  import MessageList from "$lib/components/wallet/trollbox/MessageList.svelte";
  import MessageInput from "$lib/components/wallet/trollbox/MessageInput.svelte";

  // Props type definition
  type TrollboxPanelProps = {
    onClose?: () => void;
  };

  // Destructure props with defaults
  let { 
    onClose = () => {} 
  }: TrollboxPanelProps = $props();

  // TrollBox state variables
  let chatContainer = $state<HTMLElement | null>(null);
  let messageInput = $state('');
  let showEmojiPicker = $state(false);
  let isUserAdmin = $state(false);
  let deletingMessageIds = $state<Set<bigint>>(new Set());
  let confirmingMessageIds = $state<Set<bigint>>(new Set());
  let errorMessage = $state('');
  let showInstructions = $state(false);
  let documentHidden = $state(false);
  
  // Expose trollbox store values using $derived instead of $:
  const messages = $derived($trollboxStore.messages);
  const pendingMessages = $derived($trollboxStore.pendingMessages);
  const pendingMessageIds = $derived($trollboxStore.pendingMessageIds);
  const isLoading = $derived($trollboxStore.isLoading);
  const isLoadingMore = $derived($trollboxStore.isLoadingMore);
  const hasMoreMessages = $derived($trollboxStore.hasMoreMessages);
  const bannedUsers = $derived($trollboxStore.bannedUsers);
  
  // Initialize trollbox functionality
  async function initializeTrollbox() {
    if (!chatContainer) return; // Wait until chat container is available
    
    // Load pending messages from localStorage
    trollboxStore.loadPendingMessagesFromStorage();
    
    // Load messages
    loadMessages(true);
    
    // Check for banned users
    await checkBannedUsers();
    
    // Ensure we scroll to bottom after initialization
    setTimeout(scrollToBottom, 500);
  }

  // Window focus/visibility handling for chat
  let visibilityChangeHandler: () => void;
  
  onMount(() => {
    if (browser) {
      // Set up visibility change handler
      visibilityChangeHandler = () => {
        documentHidden = document.hidden;
        if (!documentHidden) {
          // Refresh when becoming visible again
          loadMessages();
        }
      };
      
      document.addEventListener('visibilitychange', visibilityChangeHandler);
      
      // Initialize async processes
      initializeAsync();
    }
    
    // This is the cleanup function
    return () => {
      if (browser) {
        if (visibilityChangeHandler) {
          document.removeEventListener('visibilitychange', visibilityChangeHandler);
        }
      }
    };
  });
  
  // Moved async initialization logic to a separate function
  async function initializeAsync() {
    // Check if user is admin for trollbox
    if ($auth.isConnected) {
      try {
        const trollboxApi = await import('$lib/api/trollbox');
        isUserAdmin = await trollboxApi.isAdmin();
      } catch (e) {
        console.error("Error checking admin status:", e);
      }
    }
    
    // Initialize trollbox
    initializeTrollbox();
  }
  
  function scrollToBottom() {
    if (chatContainer) {
      // Set scrollTop to the maximum possible value to ensure we're at the very bottom
      chatContainer.scrollTop = chatContainer.scrollHeight - chatContainer.clientHeight;
    }
  }
  
  function loadMessages(scrollAfterLoad = false) {
    const wasAtBottom = isNearBottom();
    trollboxStore.loadMessages(wasAtBottom || scrollAfterLoad, () => {
      if (wasAtBottom || scrollAfterLoad) {
        scrollToBottom();
      }
    });
  }
  
  function isNearBottom() {
    if (!chatContainer) return false;
    const threshold = 100; // pixels from bottom
    return (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < threshold;
  }
  
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const scrollThreshold = 100;
    
    if (target.scrollTop <= scrollThreshold && !isLoadingMore && hasMoreMessages) {
      loadMoreMessages();
    }
  }
  
  async function loadMoreMessages() {
    if (!chatContainer) return;
    
    // Find the first visible message element
    const messageElements = chatContainer.querySelectorAll('.message-item');
    
    // Call the store method with the container reference
    trollboxStore.loadMoreMessages(chatContainer);
  }
  
  // Handle message submission
  async function handleSubmit(e: CustomEvent) {
    const message = e.detail.message;
    
    // Add pending message with unique id
    trollboxStore.addPendingMessage(message);
    
    // Scroll to bottom after adding pending message
    setTimeout(scrollToBottom, 0);

    try {
      // Import the trollbox API dynamically
      const trollboxApi = await import('$lib/api/trollbox');
      
      // Submit message to backend
      const newMessage = await trollboxApi.createMessage({ message });
      
      // Find and remove from pending if it exists
      const pendingToRemove = [...pendingMessageIds].find(id => {
        const pending = pendingMessages.find(p => p.id === id);
        return pending && pending.message === message;
      });
      
      if (pendingToRemove) {
        trollboxStore.removePendingMessage(pendingToRemove);
      }
      
      // Add confirmed message
      trollboxStore.addMessage(newMessage);
      
      // Scroll to bottom after message is added
      setTimeout(() => {
        scrollToBottom();
        // Force UI update by triggering another load to ensure message appears
        setTimeout(() => {
          loadMessages(true);
        }, 50);
      }, 10);
    } catch (error) {
      console.error('Error sending message:', error);
      messageInput = message; // Restore message input on error
    }
  }
  
  // Close the sidebar
  function handleClose() {
    onClose();
  }
  
  // Request confirmation before deleting a message
  function requestDeleteConfirmation(messageId: bigint) {
    confirmingMessageIds = new Set(confirmingMessageIds).add(messageId);
  }

  // Cancel delete confirmation
  function cancelDeleteConfirmation(messageId: bigint) {
    const newSet = new Set(confirmingMessageIds);
    newSet.delete(messageId);
    confirmingMessageIds = newSet;
  }

  // Handle message deletion
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
      
      // Short delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Perform deletion on backend
      const trollboxApi = await import('$lib/api/trollbox');
      await trollboxApi.deleteMessage(messageId);
      
      // Remove message from the local state
      trollboxStore.deleteMessage(messageId);
      
      // Do a refresh to keep things in sync
      loadMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      const newDeletingIds = new Set(deletingMessageIds);
      newDeletingIds.delete(messageId);
      deletingMessageIds = newDeletingIds;
    }
  }

  // Check the ban status of all users in messages
  async function checkBannedUsers() {
    trollboxStore.checkBannedUsers();
  }

  // Ban a user for specified number of days
  async function handleBanUser(principal: any, days: number) {
    if (!isUserAdmin) return;
    
    try {
      const trollboxApi = await import('$lib/api/trollbox');
      await trollboxApi.banUser(principal, BigInt(days));
      
      // Update the banned users map
      bannedUsers.set(principal.toText(), BigInt(days * 24 * 60 * 60));
      
      // Trigger a refresh to update UI
      trollboxStore.checkBannedUsers();
    } catch (error) {
      console.error('Error banning user:', error);
    }
  }

  // Unban a user
  async function handleUnbanUser(principal: any) {
    if (!isUserAdmin) return;
    
    try {
      const trollboxApi = await import('$lib/api/trollbox');
      await trollboxApi.unbanUser(principal);
      
      // Update banned users map
      if (bannedUsers.has(principal.toText())) {
        bannedUsers.delete(principal.toText());
      }
      
      // Trigger a refresh to update UI
      trollboxStore.checkBannedUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
    }
  }

  // Toggle instructions panel
  function toggleInstructions() {
    showInstructions = !showInstructions;
  }

  export function initialize() {
    initializeTrollbox();
  }
</script>

<!-- Overall container with fixed height to ensure the input is visible -->
<div class="flex flex-col h-full">
  <!-- Chat Header -->
  <header class="flex items-center justify-between p-5 border-b border-kong-border bg-kong-bg-primary/95 backdrop-blur-sm" style="box-shadow: 0 4px 15px -8px rgba(0, 0, 0, 0.2);">
    <div class="flex items-center gap-2">
      <MessagesSquare size={18} class="text-kong-primary" />
      <h2 class="text-base font-semibold text-kong-text-primary" style="letter-spacing: -0.01em;">Chat</h2>
    </div>
    
    <div class="flex items-center gap-2">
      <button 
        class="px-3 py-1.5 text-xs font-medium text-kong-text-secondary hover:text-kong-text-primary transition-colors rounded-md bg-kong-text-primary/5 hover:bg-kong-text-primary/10" 
        onclick={() => loadMessages(true)}
      >
        Refresh
      </button>
    </div>
  </header>

  <!-- Error message display -->
  {#if errorMessage}
    <div class="bg-kong-error/10 border-l-4 border-kong-error text-kong-error p-3 text-sm" transition:slide|local={{ duration: 150 }}>
      {errorMessage}
    </div>
  {/if}

  <!-- Chat Messages Container - Explicitly set to be scrollable -->
  <div class="flex-1 min-h-0 overflow-auto">
    <MessageList
      bind:chatContainer
      messages={messages}
      pendingMessages={pendingMessages}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMoreMessages={hasMoreMessages}
      showInstructions={showInstructions}
      isUserAdmin={isUserAdmin}
      deletingMessageIds={deletingMessageIds}
      confirmingMessageIds={confirmingMessageIds}
      bannedUsers={bannedUsers}
      onScroll={handleScroll}
      onToggleInstructions={toggleInstructions}
      onRequestDelete={requestDeleteConfirmation}
      onCancelDelete={cancelDeleteConfirmation}
      onConfirmDelete={handleDeleteMessage}
      onBanUser={handleBanUser}
      onUnbanUser={handleUnbanUser}
    />
  </div>
  
  <!-- Message Input - Always at the bottom -->
  <div class="border-t border-kong-border bg-kong-bg-primary flex-shrink-0">
    <MessageInput 
      isConnected={$auth.isConnected}
      bind:messageInput
      bind:showEmojiPicker
      on:submit={handleSubmit}
    />
    {#if !$auth.isConnected}
      <div class="text-center text-xs text-kong-text-secondary mt-0 pb-3">
        Connect your wallet to chat
      </div>
    {/if}
  </div>
</div>

<style>
  /* Token link styling for chat */
  :global(.token-link) {
    text-decoration: none;
    cursor: pointer;
    display: inline-block;
  }
  
  :global(.token-link:hover) {
    opacity: 0.9;
  }
  
  :global(.token-link span) {
    display: inline-flex;
    align-items: center;
  }
  
  :global(.token-link:hover span) {
    background-color: rgba(var(--primary), 0.3) !important;
    transition: background-color 0.15s ease;
  }
  
  :global(.token-link:active span) {
    transform: scale(0.98);
  }

  :global(emoji-picker) {
    --background: rgb(var(--bg-tertiary));
    --border-color: rgb(var(--border));
    --indicator-color: rgb(var(--accent-blue));
    --input-border-color: rgb(var(--border));
    --input-font-color: rgb(var(--text-primary));
    --input-placeholder-color: rgb(var(--text-secondary));
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