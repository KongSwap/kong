<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/services/auth';
  import { MessageSquare, X, Smile, AlertCircle } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  import * as trollboxApi from '$lib/api/trollbox';
  import type { Message } from '$lib/api/trollbox';
  import { browser } from '$app/environment';

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
  let tokenCache: Record<string, string> = {};
  let pollInterval: ReturnType<typeof setInterval>;
  let errorMessage: string = '';
  let errorTimeout: ReturnType<typeof setTimeout> | null = null;

  async function initialize() {
    if (browser) {
      await import('emoji-picker-element');
    }
    loadMessages();
  }

  onMount(() => {
    initialize();
    
    // Start polling for new messages
    pollInterval = setInterval(loadMessages, 7000);

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
</script>

<!-- Fixed button and chat container -->
<div class="fixed bottom-0 right-4 z-50 flex flex-col items-end gap-1 pb-4">
  <!-- Chat Window -->
  {#if isOpen}
    <div 
      class="flex flex-col bg-kong-surface-dark rounded-lg border border-kong-pm-border shadow-lg
             sm:w-96
             fixed w-[95vw] max-w-lg bottom-16 left-1/2 -translate-x-1/2
             sm:static sm:transform-none mb-2"
      style="height: {window.innerWidth < 640 ? 'calc(100vh - 8rem)' : '420px'}"
      transition:fade={{ duration: 150 }}
    >
      <div class="flex items-center justify-between p-2 sm:p-3 border-b border-kong-pm-border">
        <div class="flex items-center gap-2">
          <MessageSquare class="w-4 h-4 text-kong-pm-text-secondary" />
          <h3 class="text-sm font-medium text-kong-text-primary">TrollBox</h3>
        </div>
        <button 
          on:click={toggleChat}
          class="text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors p-1 rounded hover:bg-kong-pm-dark"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Chat messages -->
      <div 
        bind:this={chatContainer}
        on:scroll={handleScroll}
        class="flex-1 overflow-y-auto p-2 sm:p-3 space-y-3 scrollbar-custom"
      >
        {#if isLoadingMore}
          <div class="text-center text-kong-pm-text-secondary py-2" transition:fade>
            Loading older messages...
          </div>
        {:else if !hasMoreMessages}
          <div class="text-center text-kong-pm-text-secondary py-2" transition:fade>
            No more messages
          </div>
        {/if}

        {#if isLoading && !messages.length}
          <div class="text-center text-kong-pm-text-secondary">
            Loading messages...
          </div>
        {/if}

        {#each messages as message}
          <div class="flex flex-col space-y-1">
            <div class="flex items-center gap-2">
              <img
                src={`https://api.dicebear.com/7.x/notionists-neutral/svg?seed=${message.principal.toText()}&size=20`}
                alt="avatar"
                class="w-5 h-5 rounded-full bg-kong-pm-dark"
              />
              <span class="text-xs font-medium text-kong-accent-purple">{message.principal.toText().slice(0, 10)}</span>
              <span class="text-xs text-kong-pm-text-secondary">
                {new Date(Number(message.created_at / BigInt(1000000))).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p class="text-sm text-kong-text-primary break-words">{@html message.message}</p>
          </div>
        {/each}

        {#each pendingMessages as pending}
          <div class="flex flex-col space-y-1 opacity-50">
            <div class="flex items-center gap-2">
              <img
                src={`https://api.dicebear.com/7.x/notionists-neutral/svg?seed=${$auth.account.owner.toString() || 'pending'}&size=20`}
                alt="avatar"
                class="w-5 h-5 rounded-full bg-kong-pm-dark"
              />
              <span class="text-xs font-medium text-kong-accent-purple">Sending...</span>
              <span class="text-xs text-kong-pm-text-secondary">
                {new Date(Number(pending.created_at / BigInt(1000000))).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p class="text-sm text-kong-text-primary break-words">{@html pending.message}</p>
          </div>
        {/each}
      </div>

      <!-- Error message -->
      {#if errorMessage}
        <div class="px-3 py-2 bg-red-900/40 border-t border-b border-red-800 flex items-center gap-2" transition:slide={{ duration: 200 }}>
          <AlertCircle class="w-4 h-4 text-red-400 shrink-0" />
          <p class="text-sm text-red-200">{errorMessage}</p>
        </div>
      {/if}

      <!-- Message input -->
      <div class="p-2 border-t border-kong-pm-border">
        {#if $auth.isConnected}
          <div class="flex gap-1 relative">
            <button
              bind:this={emojiButton}
              on:click={() => showEmojiPicker = !showEmojiPicker}
              class="shrink-0 p-1.5 bg-kong-pm-dark text-kong-text-primary rounded-md border border-kong-pm-border hover:bg-kong-pm-dark/80 transition-colors"
            >
              <Smile class="w-4 h-4" />
            </button>
            <input
              type="text"
              bind:value={messageInput}
              on:keypress={handleKeyPress}
              placeholder="Type a message..."
              class="flex-1 min-w-0 bg-kong-pm-dark text-kong-text-primary text-sm rounded-md px-2 py-1.5 border border-kong-pm-border focus:outline-none focus:border-kong-pm-accent transition-colors"
            />
            <button
              on:click={handleSubmit}
              disabled={!messageInput.trim()}
              class="shrink-0 px-3 py-1.5 bg-kong-pm-accent hover:bg-kong-pm-accent/90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
            
            {#if showEmojiPicker}
              <div 
                bind:this={emojiPickerContainer}
                class="absolute bottom-full mb-2 left-[50%] -translate-x-[50%] z-50"
                transition:fade={{ duration: 100 }}
              >
                <emoji-picker
                  on:emoji-click={handleEmojiSelect}
                  class="light"
                ></emoji-picker>
              </div>
            {/if}
          </div>
        {:else}
          <div class="text-center text-sm text-kong-pm-text-secondary">
            Connect your wallet to chat
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Toggle Button -->
  <button
    on:click={toggleChat}
    class="bg-kong-pm-accent hover:bg-kong-pm-accent/90 text-white p-2 sm:p-3 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 z-50"
  >
    <MessageSquare class="w-5 h-5" />
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

  :global(emoji-picker) {
    --background: rgb(var(--surface-dark));
    --border-color: rgb(var(--pm-border));
    --indicator-color: rgb(var(--pm-accent));
    --input-border-color: rgb(var(--pm-border));
    --input-font-color: rgb(var(--text-primary));
    --input-placeholder-color: rgb(var(--pm-text-secondary));
    --category-font-color: rgb(var(--text-primary));
    height: 250px;
    width: 100%;
    max-width: 300px;
  }

  @media (min-width: 640px) {
    :global(emoji-picker) {
      height: 300px;
      width: 300px;
    }
  }
</style> 