<script lang="ts">
  // --- Framework imports ---
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  
  // --- Service imports ---
  import { auth } from '$lib/services/auth';
  import * as trollboxApi from '$lib/api/trollbox';
  import { Principal } from '@dfinity/principal';
  
  // --- Component imports ---
  import { MessagesSquare } from 'lucide-svelte';
  import MessageList from './MessageList.svelte';
  import TrollboxHeader from './TrollboxHeader.svelte';
  import MessageInput from './MessageInput.svelte';
  import Notifications from './Notifications.svelte';
  
  // --- Store imports ---
  import { trollboxStore } from './trollboxStore';
  
  // --- Constants ---
  const MESSAGE_SUBMISSION_FLAG = 'trollbox_message_submission';
  
  // --- Component state ---
  let isOpen = false;
  let chatContainer: HTMLElement;
  let messageInput = '';
  let showEmojiPicker = false;
  let windowWidth: number;
  let pollInterval: ReturnType<typeof setInterval>;
  let errorMessage: string = '';
  let errorTimeout: ReturnType<typeof setTimeout> | null = null;
  let isUserAdmin = false;
  let deletingMessageIds: Set<bigint> = new Set();
  let confirmingMessageIds: Set<bigint> = new Set();
  let showInstructions = false;
  let banningUsers: Set<string> = new Set();
  let showRefreshPrompt = false;
  let documentHidden = false;
  let visibilityChangeHandler: () => void;
  
  // Expose store values in component
  $: messages = $trollboxStore.messages;
  $: pendingMessages = $trollboxStore.pendingMessages;
  $: pendingMessageIds = $trollboxStore.pendingMessageIds;
  $: isLoading = $trollboxStore.isLoading;
  $: isLoadingMore = $trollboxStore.isLoadingMore;
  $: hasMoreMessages = $trollboxStore.hasMoreMessages;
  $: bannedUsers = $trollboxStore.bannedUsers;
  
  async function checkAdminStatus() {
    isUserAdmin = await trollboxApi.isAdmin();
  }

  async function initialize() {
    if (browser) {
      // Load pending messages from localStorage on initialization
      trollboxStore.loadPendingMessagesFromStorage();
      
      // Check if we have a pending message submission from previous session
      const submissionFlag = localStorage.getItem(MESSAGE_SUBMISSION_FLAG);
      if (submissionFlag) {
        // Clear the flag
        localStorage.removeItem(MESSAGE_SUBMISSION_FLAG);
        // Immediately trigger a message refresh
        setTimeout(() => safeRefresh(true), 500);
        // Set flag to show refresh prompt
        showRefreshPrompt = true;
        
        // Aggressive polling for the first 30 seconds
        for (let i = 1; i <= 5; i++) {
          setTimeout(() => loadMessages(true), i * 2000);
        }
      } else {
        // Standard initialization
        safeRefresh(true);
      }
    } else {
      // Always do a load on initialization
      loadMessages(true);
    }
    
    if ($auth.isConnected) {
      checkAdminStatus();
    }
    
    // Check for banned users periodically
    checkBannedUsers();
    
    // Ensure we scroll to bottom after initialization
    setTimeout(scrollToBottom, 500);
  }

  onMount(() => {
    initialize();
    
    // Start polling for new messages - less frequent polling to reduce overhead
    pollInterval = setInterval(loadMessages, 10000); // 10 seconds

    // Handle window focus - refresh messages when window regains focus
    const handleWindowFocus = () => {
      // Force immediate refresh on window focus regardless of pending messages
      loadMessages();
    };

    // Handle visibility change
    visibilityChangeHandler = () => {
      documentHidden = document.hidden;
      if (!documentHidden) {
        // Refresh when becoming visible again
        loadMessages();
      }
    };

    // Add document-level click handler for token links
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // First try to find the direct token-link
      let tokenLink = target.closest('.token-link') as HTMLAnchorElement;
      
      // If not found and we're clicking on an element inside a message-content, 
      // try to find the closest token link within that message
      if (!tokenLink && target.closest('.message-content')) {
        // Find all token links in this message element
        const messageContent = target.closest('.message-content');
        if (messageContent) {
          // Get the bounding rectangle for the clicked element
          const rect = target.getBoundingClientRect();
          const clickX = event.clientX;
          const clickY = event.clientY;
          
          // Find all token links in this message
          const allTokenLinks = messageContent.querySelectorAll('.token-link');
          
          // Check if the click was inside any of these token links
          for (const link of allTokenLinks) {
            const linkRect = link.getBoundingClientRect();
            if (
              clickX >= linkRect.left && 
              clickX <= linkRect.right && 
              clickY >= linkRect.top && 
              clickY <= linkRect.bottom
            ) {
              tokenLink = link as HTMLAnchorElement;
              break;
            }
          }
        }
      }
      
      if (tokenLink) {        
        // Prevent default behavior and stop propagation
        event.preventDefault();
        event.stopPropagation();
        
        // Get the href and navigate programmatically using goto
        const href = tokenLink.getAttribute('href');
        if (href) {
          // Use timeout to ensure event handling is complete
          setTimeout(() => {
            goto(href);
          }, 10);
        } else {
          console.error("[TrollBox] Token link missing href attribute");
        }
        
        return false;
      }
    };
    
    // Add the event listener
    document.addEventListener('click', handleDocumentClick);

    // Watch auth changes to check admin status when user connects
    const unsubscribe = auth.subscribe(async (authState) => {
      if (authState.isConnected) {
        checkAdminStatus();
      } else {
        isUserAdmin = false;
      }
    });

    const handleResize = () => {
      windowWidth = window.innerWidth;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', visibilityChangeHandler);

    // Ensure we scroll to the bottom when the component is mounted
    // Use a small delay to ensure the DOM is fully rendered
    setTimeout(scrollToBottom, 500);
    
    // Also scroll to bottom after initial messages are loaded
    trollboxStore.loadMessages(true, scrollToBottom);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      document.removeEventListener('click', handleDocumentClick);
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

  function loadMessages(scrollAfterLoad = false) {
    const wasAtBottom = isNearBottom();
    trollboxStore.loadMessages(wasAtBottom || scrollAfterLoad, () => {
      if (wasAtBottom || scrollAfterLoad) {
        scrollToBottom();
      }
    });
  }

  // Safe refresh method that ensures a complete state recovery
  function safeRefresh(forceScrollToBottom = false) {
    // First check if we're at the bottom
    const wasAtBottom = isNearBottom() || forceScrollToBottom;
    
    // Perform a refresh
    loadMessages(forceScrollToBottom);
    
    // Add just one additional refresh with a reasonable delay
    setTimeout(() => {
      loadMessages(forceScrollToBottom);
      
      // Scroll to bottom if we were at the bottom or force scroll is requested
      if (wasAtBottom) {
        setTimeout(scrollToBottom, 50);
      }
    }, 800);
  }

  async function loadMoreMessages() {
    if (!chatContainer) return;
    
    // Find the first visible message element
    const messageElements = chatContainer.querySelectorAll('.message-item');
    let firstVisibleMessageId = null;
    
    if (messageElements.length > 0) {
      for (let i = 0; i < messageElements.length; i++) {
        const element = messageElements[i] as HTMLElement;
        const rect = element.getBoundingClientRect();
        // If the element is visible in the viewport
        if (rect.top >= 0 || rect.bottom > 0) {
          firstVisibleMessageId = element.getAttribute('data-message-id');
          break;
        }
      }
    }
    
    // Call the store method with the container reference
    trollboxStore.loadMoreMessages(chatContainer);
  }

  $: if (windowWidth < 640 && showEmojiPicker) {
    // Scroll chat to bottom when emoji picker opens on mobile
    setTimeout(scrollToBottom, 0);
  }

  function scrollToBottom() {
    if (chatContainer) {
      // Set scrollTop to the maximum possible value to ensure we're at the very bottom
      chatContainer.scrollTop = chatContainer.scrollHeight - chatContainer.clientHeight;
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

  async function handleSubmit(e: CustomEvent) {
    const message = e.detail.message;
    
    // Add pending message with unique id
    trollboxStore.addPendingMessage(message);
    
    // Scroll to bottom after adding pending message
    setTimeout(scrollToBottom, 0);

    try {
      // Submit message to backend
      const newMessage = await trollboxApi.createMessage({ message });
      
      // Clear submission flag
      if (browser) {
        localStorage.removeItem(MESSAGE_SUBMISSION_FLAG);
      }
      
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
      setTimeout(scrollToBottom, 0);
      
      // Perform safe refresh to ensure state is consistent
      safeRefresh();
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Check for specific wallet interruption errors
      const isWalletInterruption = 
        error instanceof Error && 
        (error.message.includes('cancelled') || 
         error.message.includes('rejected') ||
         error.message.includes('timeout'));
      
      if (!isWalletInterruption) {
        // Only remove if it's truly an error (not a wallet interruption)
        const pendingToRemove = [...pendingMessageIds].find(id => {
          const pending = pendingMessages.find(p => p.id === id);
          return pending && pending.message === message;
        });
        
        if (pendingToRemove) {
          trollboxStore.removePendingMessage(pendingToRemove);
        }
        
        // Display error message to user
        if (error instanceof Error) {
          showError(error.message);
        } else if (typeof error === 'string') {
          showError(error);
        } else {
          showError('Failed to send message. Please try again later.');
        }
        
        messageInput = message; // Restore message input on error
      } else {
        // This is a wallet interruption - keep the pending message
        // and show refresh prompt to let the user know to refresh
        showRefreshPrompt = true;
        console.log("[TrollBox] Wallet interruption detected, keeping pending message");
      }
    }
  }

  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const scrollThreshold = 100;
    
    if (target.scrollTop <= scrollThreshold && !isLoadingMore && hasMoreMessages) {
      loadMoreMessages();
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      // Reload messages when opening the trollbox
      loadMessages(true);
      setTimeout(scrollToBottom, 100);
    }
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
      
      // Shorter animation delay - just enough for visual feedback
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Save pendingMessages to restore later
      const savedPendingMessages = [...pendingMessages];
      const savedPendingIds = new Set(pendingMessageIds);
      
      // Perform deletion on backend
      await trollboxApi.deleteMessage(messageId);
      
      // Remove message from the local state immediately without additional delay
      trollboxStore.deleteMessage(messageId);
      
      // Do a single refresh to keep things in sync
      loadMessages();
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
  }

  // Check the ban status of all unique users in the messages
  async function checkBannedUsers() {
    trollboxStore.checkBannedUsers();
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

  // Force refresh messages
  function refreshMessages() {
    // Use safe refresh instead of simple refresh
    safeRefresh();
    showRefreshPrompt = false;
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
      style="height: {window.innerWidth < 640 ? 'calc(100vh - 10.2rem)' : '570px'}"
      transition:fade={{ duration: 200 }}
    >
      <!-- Header Component -->
      <TrollboxHeader 
        {isUserAdmin}
        {isLoading}
        onRefresh={refreshMessages}
        onToggleInstructions={toggleInstructions}
        onClose={toggleChat}
      />

      <!-- Message List Component -->
      <MessageList
        bind:chatContainer
        {messages}
        {pendingMessages}
        {isLoading}
        {isLoadingMore}
        {hasMoreMessages}
        {showInstructions}
        {isUserAdmin}
        {deletingMessageIds}
        {confirmingMessageIds}
        {bannedUsers}
        onScroll={handleScroll}
        onToggleInstructions={toggleInstructions}
        onRequestDelete={requestDeleteConfirmation}
        onCancelDelete={cancelDeleteConfirmation}
        onConfirmDelete={handleDeleteMessage}
        onBanUser={handleBanUser}
        onUnbanUser={handleUnbanUser}
      />

      <!-- Notifications -->
      <Notifications 
        {errorMessage} 
        {showRefreshPrompt} 
        onRefresh={refreshMessages} 
      />

      <!-- Message Input Component -->
      <MessageInput 
        isConnected={$auth.isConnected}
        bind:messageInput
        bind:showEmojiPicker
        on:submit={handleSubmit}
      />
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

<style scoped lang="postcss">
  /* Token link styling */
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