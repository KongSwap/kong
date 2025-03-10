<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Activity, Zap, Hash, Award, ArrowRight } from 'lucide-svelte';
  import { fly, scale, crossfade, fade } from 'svelte/transition';
  import { elasticOut, backOut, cubicInOut } from 'svelte/easing';
  import { formatBalance } from "$lib/utils/numberFormatUtils";

  export let recentEvents = [];
  
  // Track new events to apply highlighting effect
  let newEventIndices = [];
  let lastEventsLength = 0;
  let feedContainer;
  let showPulse = false;
  
  // For empty state animation
  let emptyStateMessage = "CONNECTED TO NETWORK SUCCESSFULLY";
  let messageIndex = 0;
  const emptyStateMessages = [
    "CONNECTED TO NETWORK SUCCESSFULLY",
    "WAITING FOR EVENTS...",
    "MONITORING TRANSACTIONS...",
    "LISTENING FOR ACTIVITY..."
  ];
  
  // Cycle through empty state messages
  onMount(() => {
    const interval = setInterval(() => {
      if (recentEvents.length === 0) {
        messageIndex = (messageIndex + 1) % emptyStateMessages.length;
        emptyStateMessage = emptyStateMessages[messageIndex];
      }
    }, 3000);
    
    return () => clearInterval(interval);
  });
  
  // Create crossfade transition
  const [send, receive] = crossfade({
    duration: 600,
    fallback(node) {
      return scale(node, { 
        start: 0.8, 
        opacity: 0,
        duration: 400,
        easing: backOut
      });
    }
  });
  
  // Function to highlight a new event
  function highlightEvent(index) {
    newEventIndices.push(index);
    // Trigger the pulse animation
    showPulse = true;
    setTimeout(() => {
      showPulse = false;
    }, 300);
    
    setTimeout(() => {
      newEventIndices = newEventIndices.filter(i => i !== index);
    }, 5000);
  }
  
  // After component updates, check for new events
  afterUpdate(() => {
    if (recentEvents.length > lastEventsLength) {
      // New events were added
      for (let i = lastEventsLength; i < recentEvents.length; i++) {
        highlightEvent(i);
      }
      lastEventsLength = recentEvents.length;
      
      // Scroll to the right to show newest events
      if (feedContainer) {
        setTimeout(() => {
          feedContainer.scrollLeft = feedContainer.scrollWidth;
        }, 100);
      }
    }
  });
  
  // Format timestamp
  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  
  // Extract token ID from event text
  function extractTokenId(event) {
    // If we have the original data and it's a token event
    if (event.eventType === 'canister_registered' && 
        event.originalData?.canister_type === 'token_backend' && 
        event.originalData?.canister_id) {
      return event.originalData.canister_id;
    }
    
    // If we have token_connected or mining_started event
    if ((event.eventType === 'token_connected' || event.eventType === 'mining_started' || event.eventType === 'solution_found') && 
        event.originalData?.token_id) {
      return event.originalData.token_id;
    }
    
    // Fallback to text parsing if we don't have the original data
    if (event.text.includes('TOKEN') && event.text.includes(':')) {
      // Extract the token ID (canister ID) from the text
      const match = event.text.match(/([a-zA-Z0-9]{8})\.{3}/);
      if (match && match[1]) {
        // We only have the shortened ID
        return match[1];
      }
    }
    
    return null;
  }
  
  // Handle click on event
  function handleEventClick(event) {
    const tokenId = extractTokenId(event);
    if (tokenId) {
      goto(`/launch/token/${tokenId}`);
    }
  }
  
  // Get event type for styling
  function getEventTypeClass(event) {
    if (event.eventType === 'canister_registered') return 'event-type-register';
    if (event.eventType === 'token_connected') return 'event-type-connect';
    if (event.eventType === 'mining_started') return 'event-type-mining';
    if (event.eventType === 'solution_found') return 'event-type-mining';
    return 'event-type-default';
  }
  
  // Get event icon based on type
  function getEventIcon(event) {
    if (event.eventType === 'mining_started' || event.eventType === 'solution_found') return 'mining';
    if (event.eventType === 'token_connected') return 'connect';
    if (event.eventType === 'canister_registered') return 'register';
    return 'default';
  }
  
  // Generate a unique ID for each event for animation purposes
  function getEventId(event, index) {
    return `event-${event.eventType || 'unknown'}-${index}-${event.timestamp || Date.now()}`;
  }
  
  // Calculate a stable delay for animations
  function getAnimationDelay(index) {
    // Use a stable calculation that won't cause jitter on re-renders
    return Math.min(index * 80, 400);
  }

  // Format block height
  function formatBlockHeight(height) {
    return height?.toString().padStart(3, '0') || '000';
  }
  
  // Filter out system messages
  $: filteredEvents = recentEvents.filter(event => {
    // Filter out system messages like "REFRESHING CANISTER REGISTRY" or "MONITORING NETWORK ACTIVITY"
    if (event.text && (
        event.text.includes("REFRESHING CANISTER REGISTRY") || 
        event.text.includes("MONITORING NETWORK ACTIVITY") ||
        event.text.startsWith("🔄") ||
        event.text.startsWith("👀")
      )) {
      return false;
    }
    return true;
  });
</script>

<!-- NETWORK ACTIVITY FEED -->
<div class="mb-6 relative">
  <!-- Event Feed Container -->
  <div class="relative">
    <div 
      bind:this={feedContainer}
      class="flex gap-4 overflow-x-auto overflow-y-visible feed-container scroll-smooth"
    >
      {#if filteredEvents.length === 0}
        <!-- Simplified Empty State -->
        <div class="flex items-center justify-center w-full py-12">
          <div class="text-center">
            <p class="text-lg text-blue-400/90 font-mono tracking-wider mb-2" in:fade={{ duration: 300 }} out:fade={{ duration: 300 }}>
              {emptyStateMessage}
            </p>
            <div class="status-indicator flex items-center justify-center gap-2">
              <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style="animation-delay: 0.3s"></div>
              <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style="animation-delay: 0.6s"></div>
            </div>
          </div>
        </div>
      {:else}
        {#each filteredEvents as event, i (getEventId(event, i))}
          <!-- Event Card -->
          {#if event.eventType === 'solution_found'}
            <div 
              class="flex-shrink-0 cursor-pointer event-card-wrapper"
              on:click={() => handleEventClick(event)}
              in:fly={{ y: 20, duration: 400, delay: i * 30, easing: elasticOut }}
              out:scale={{ duration: 200 }}
            >
              <div class="mining-event-card">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <div class="token-logo mining" title="{event.originalData?.ticker || 'Unknown Token'}">
                      <span class="text-lg font-bold">
                        {event.originalData?.ticker?.[0] || '?'}
                      </span>
                    </div>
                    <div class="text-sm font-medium text-white">Solution Found</div>
                  </div>
                  <div class="time-badge">
                    {formatTime(event.timestamp)}
                  </div>
                </div>
                
                <div class="flex items-center gap-3 mb-2">
                  <div class="flex items-center gap-2">
                    <div class="block-badge">
                      #{formatBlockHeight(event.originalData?.block_height)}
                    </div>
                    <div class="text-xs font-mono text-yellow-500">
                      {event.originalData?.ticker || 'Unknown'}
                    </div>
                  </div>
                  <div class="ml-auto">
                    <div class="bg-[#141925] px-3 py-1.5 rounded-md border border-yellow-500/20">
                      <div class="flex items-center gap-2">
                        <Award class="h-4 w-4 text-yellow-500" />
                        <span class="text-sm font-mono text-yellow-500">
                          {formatBalance(event.originalData?.reward || '0', event.originalData?.decimals || 8)} 
                          <span class="text-yellow-500/70">{event.originalData?.ticker || ''}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center justify-between text-xs font-mono border-t border-blue-900/20 pt-2 mt-2">
                  <span class="text-gray-400">Canister ID:</span>
                  <div class="flex items-center gap-1">
                    <span class="text-gray-400">{extractTokenId(event)?.substring(0, 8)}...</span>
                    <ArrowRight size={14} class="text-blue-400" />
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <div 
              class="flex-shrink-0 {extractTokenId(event) ? 'cursor-pointer' : ''} event-card-wrapper"
              class:highlight={newEventIndices.includes(i)}
              on:click={() => handleEventClick(event)}
              in:fly={{ y: 20, duration: 400, delay: i * 30, easing: elasticOut }}
              out:scale={{ duration: 200 }}
            >
              <div class="event-card {getEventTypeClass(event)}">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="event-icon-container {getEventTypeClass(event)}">
                      {#if getEventIcon(event) === 'connect'}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-green-400">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                      {:else if getEventIcon(event) === 'mining'}
                        <Zap class="h-4 w-4 text-yellow-500" />
                      {:else if getEventIcon(event) === 'register'}
                        <Hash class="h-4 w-4 text-blue-400" />
                      {:else}
                        <Activity class="h-4 w-4 text-blue-400" />
                      {/if}
                    </div>
                    <div class="text-sm font-medium text-white">
                      {event.eventType.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div class="time-badge">
                    {formatTime(event.timestamp)}
                  </div>
                </div>

                <div class="text-sm font-mono text-gray-200 mb-4 pl-11">
                  {event.text}
                </div>

                {#if extractTokenId(event)}
                  <div class="flex items-center justify-end gap-2 border-t border-blue-900/20 pt-3 mt-2">
                    <span class="text-xs font-mono text-gray-400">{extractTokenId(event).substring(0, 8)}...</span>
                    <ArrowRight size={14} class="text-blue-400" />
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .event-card-wrapper {
    @apply min-w-[310px] max-w-[380px] pt-2 pb-2;
    transition: padding 0.3s ease;
  }

  .event-card,
  .mining-event-card {
    @apply relative bg-[#0B0E17] p-5 rounded-lg;
    @apply border border-blue-900/30;
    @apply transition-all duration-300;
    background: linear-gradient(180deg, #0D1118 0%, rgba(13, 17, 24, 0.9) 100%);
    will-change: transform;
  }

  .event-card-wrapper:hover .event-card,
  .event-card-wrapper:hover .mining-event-card {
    @apply border-blue-500/40;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.3);
  }

  .time-badge {
    @apply text-xs font-mono text-gray-500 bg-[#111520] px-2 py-1 rounded-md;
  }
  
  .block-badge {
    @apply text-xs font-mono text-white bg-[#141925] px-2 py-1 rounded-md border border-blue-900/30;
  }

  .event-type-register {
    &-text { @apply text-blue-400; }
  }

  .event-type-connect {
    &-text { @apply text-green-400; }
  }

  .event-type-mining {
    &-text { @apply text-yellow-500; }
  }

  .event-icon-container {
    @apply w-10 h-10 rounded-full flex items-center justify-center;
    @apply bg-[#111520] border border-blue-900/40;
  }

  .token-logo {
    @apply w-10 h-10 rounded-full flex items-center justify-center;
    @apply bg-[#111520] border border-blue-900/40;
    &.mining {
      @apply border-yellow-500/30 bg-yellow-500/5;
      @apply text-yellow-500;
    }
  }

  /* Improved scrollbar styling */
  .feed-container {
    scrollbar-width: thin;
    scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
  }

  .feed-container::-webkit-scrollbar {
    @apply h-2;
  }

  .feed-container::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .feed-container::-webkit-scrollbar-thumb {
    @apply bg-blue-500/20 hover:bg-blue-500/30 rounded-full transition-colors duration-200;
  }

  .highlight .event-card {
    @apply border-blue-500/30;
    animation: card-highlight 1s cubic-bezier(0.4, 0, 0.6, 1);
  }

  @keyframes card-highlight {
    0%, 100% { border-color: rgba(59, 130, 246, 0.3); }
    50% { border-color: rgba(59, 130, 246, 0.6); }
  }
</style> 