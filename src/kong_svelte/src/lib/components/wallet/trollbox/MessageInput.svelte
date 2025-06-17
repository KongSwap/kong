<script lang="ts">
  import { Smile } from 'lucide-svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  
  export let isConnected = false;
  export let messageInput = '';
  export let showEmojiPicker = false;
  
  let emojiPickerContainer: HTMLElement;
  let emojiButton: HTMLElement;
  
  const dispatch = createEventDispatcher();
  
  onMount(async () => {
    if (typeof window !== 'undefined') {
      await import('emoji-picker-element');
    }
  });
  
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
  
  function handleSubmit() {
    if (!messageInput.trim() || !isConnected) return;
    dispatch('submit', { message: messageInput.trim() });
    messageInput = '';
  }
  
  function toggleEmojiPicker() {
    showEmojiPicker = !showEmojiPicker;
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

<div class="p-2.5 bg-kong-bg-primary relative">
  {#if isConnected}
    <div class="flex gap-2 relative">
      <!-- Emoji button -->
      <button
        bind:this={emojiButton}
        onclick={toggleEmojiPicker}
        class="shrink-0 p-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors rounded-full"
      >
        <Smile class="w-5 h-5" />
      </button>
      
      <!-- Message input -->
      <input
        type="text"
        bind:value={messageInput}
        onkeypress={handleKeyPress}
        placeholder="Message..."
        class="flex-1 min-w-0 bg-kong-bg-secondary text-kong-text-primary text-sm rounded-full px-3.5 py-2 border border-kong-border focus:outline-none focus:border-kong-accent-blue transition-colors"
      />
      
      <!-- Send button - only show when there's text -->
      {#if messageInput.trim()}
        <button
          onclick={handleSubmit}
          class="shrink-0 p-2 rounded-full bg-kong-primary text-white transition-opacity hover:opacity-90 flex items-center justify-center"
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
            onemoji-click={handleEmojiSelect}
            class="light"
          ></emoji-picker>
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-center text-sm text-kong-text-secondary py-2.5 border border-dashed border-kong-border/30 rounded-md">
      Connect your wallet to chat
    </div>
  {/if}
</div> 