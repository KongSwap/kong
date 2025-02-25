<script lang="ts">
  // ... existing code ...
</script>

<div class="w-full h-full flex flex-col bg-kong-surface-dark border border-kong-pm-border rounded-md overflow-hidden">
  <!-- Header -->
  <div class="flex items-center justify-between p-2.5 border-b border-kong-pm-border">
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
    </div>
  </div>

  <!-- Chat messages -->
  <div 
    bind:this={chatContainer}
    on:scroll={handleScroll}
    class="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-custom relative"
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
      <svelte:component 
        this={MessageItem} 
        {message}
        {isUserAdmin}
        isDeleting={deletingMessageIds.has(message.id)}
        isConfirming={confirmingMessageIds.has(message.id)}
        onRequestDelete={requestDeleteConfirmation}
        onCancelDelete={cancelDeleteConfirmation}
        onConfirmDelete={handleDeleteMessage}
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
  <div class="p-2.5 border-t border-kong-pm-border">
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
  
  /* Emoji picker styling */
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
    max-width: 384px;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
</style> 