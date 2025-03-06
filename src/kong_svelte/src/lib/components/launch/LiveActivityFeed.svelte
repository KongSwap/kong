<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { goto } from '$app/navigation';

  export let recentEvents = [];
  
  // Track new events to apply flashing effect
  let newEventIndices = [];
  let lastEventsLength = 0;
  let randomFlashInterval;
  let feedContainer;
  
  // Function to make an event flash
  function flashEvent(index) {
    newEventIndices.push(index);
    // Flash more intensely with multiple pulses
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (newEventIndices.includes(index)) {
          // Keep the index in the array to maintain flashing
        }
      }, i * 300);
    }
    // Remove from flashing after multiple flashes
    setTimeout(() => {
      newEventIndices = newEventIndices.filter(i => i !== index);
    }, 2500);
  }
  
  // After component updates, check for new events
  afterUpdate(() => {
    if (recentEvents.length > lastEventsLength) {
      // New events were added
      for (let i = lastEventsLength; i < recentEvents.length; i++) {
        flashEvent(i);
      }
      lastEventsLength = recentEvents.length;
      
      // Scroll to the right end to show newest events
      if (feedContainer) {
        setTimeout(() => {
          feedContainer.scrollLeft = feedContainer.scrollWidth;
        }, 100);
      }
    }
  });
  
  // Random flashing effect for existing events
  onMount(() => {
    randomFlashInterval = setInterval(() => {
      if (recentEvents.length > 0) {
        // Randomly flash an existing event
        const randomIndex = Math.floor(Math.random() * recentEvents.length);
        flashEvent(randomIndex);
      }
    }, 5000); // Every 5 seconds
    
    return () => {
      clearInterval(randomFlashInterval);
    };
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
    if ((event.eventType === 'token_connected' || event.eventType === 'mining_started') && 
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
  
  // Handle click on event card
  function handleEventClick(event) {
    const tokenId = extractTokenId(event);
    if (tokenId) {
      goto(`/launch/token/${tokenId}`);
    }
  }
</script>

<!-- LIVE ACTIVITY FEED -->
<div class="mb-6 overflow-hidden">
  <div class="flex items-center gap-2 mb-2">
    <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
    <h3 class="text-lg font-bold text-gray-300">LIVE ACTIVITY</h3>
  </div>
  
  <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
    <div 
      bind:this={feedContainer}
      class="flex gap-3 items-stretch overflow-x-auto pb-2 max-w-full snap-x snap-mandatory"
    >
      {#if recentEvents.length === 0}
        <div class="text-gray-500 italic px-4 py-2">Waiting for activity...</div>
      {:else}
        {#each recentEvents as event, i}
          <div 
            class="card-container snap-start"
            class:animate-intense-flash={newEventIndices.includes(i)}
          >
            <div 
              class="min-w-[180px] max-w-[180px] h-full rounded-lg px-3 py-2 flex flex-col justify-between border transition-all duration-200 {newEventIndices.includes(i) ? 'bg-pink-900/70' : 'bg-gray-800'} {newEventIndices.includes(i) ? 'border-pink-500' : 'border-gray-700'} {newEventIndices.includes(i) ? 'shadow-glow' : ''} {extractTokenId(event) ? 'cursor-pointer hover:bg-gray-700' : ''}"
              on:click={() => handleEventClick(event)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && handleEventClick(event)}
            >
              <div class="text-sm font-medium mb-1">
                {event.text}
                {#if extractTokenId(event)}
                  <span class="text-xs text-pink-400 ml-1">🔗</span>
                {/if}
              </div>
              <div class="text-xs text-gray-400 mt-auto">{formatTime(event.timestamp)}</div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .shadow-glow {
    box-shadow: 0 0 15px 2px rgba(236, 72, 153, 0.7);
  }
  
  .card-container {
    flex-shrink: 0;
  }
  
  /* Enhanced flashing animation */
  @keyframes intense-flash {
    0%, 100% { 
      transform: translateY(0);
      box-shadow: 0 0 10px 2px rgba(236, 72, 153, 0.7);
    }
    10% { 
      transform: translateY(-2px);
      box-shadow: 0 0 20px 5px rgba(236, 72, 153, 0.9);
    }
    20% { 
      transform: translateY(0);
      box-shadow: 0 0 10px 2px rgba(236, 72, 153, 0.7);
    }
    30% { 
      transform: translateY(-1px);
      box-shadow: 0 0 15px 3px rgba(236, 72, 153, 0.8);
    }
    40% { 
      transform: translateY(0);
      box-shadow: 0 0 10px 2px rgba(236, 72, 153, 0.7);
    }
    50% { 
      transform: translateY(-2px);
      box-shadow: 0 0 20px 5px rgba(236, 72, 153, 0.9);
    }
    60% { 
      transform: translateY(0);
      box-shadow: 0 0 10px 2px rgba(236, 72, 153, 0.7);
    }
  }
  
  .animate-intense-flash {
    animation: intense-flash 1.5s ease-in-out;
  }
  
  /* Custom scrollbar for the feed */
  div::-webkit-scrollbar {
    height: 6px;
  }
  
  div::-webkit-scrollbar-track {
    background: rgba(31, 41, 55, 0.5);
    border-radius: 10px;
  }
  
  div::-webkit-scrollbar-thumb {
    background: rgba(236, 72, 153, 0.5);
    border-radius: 10px;
  }
  
  div::-webkit-scrollbar-thumb:hover {
    background: rgba(236, 72, 153, 0.8);
  }
</style> 