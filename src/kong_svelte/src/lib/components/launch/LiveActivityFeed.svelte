<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';

  export let recentEvents = [];
  
  // Track new events to apply flashing effect
  let newEventIndices = [];
  let lastEventsLength = 0;
  let randomFlashInterval;
  
  // Function to make an event flash
  function flashEvent(index) {
    newEventIndices.push(index);
    // Remove from flashing after 3 flashes (about 1.5 seconds)
    setTimeout(() => {
      newEventIndices = newEventIndices.filter(i => i !== index);
    }, 1500);
  }
  
  // After component updates, check for new events
  afterUpdate(() => {
    if (recentEvents.length > lastEventsLength) {
      // New events were added
      for (let i = lastEventsLength; i < recentEvents.length; i++) {
        flashEvent(i);
      }
      lastEventsLength = recentEvents.length;
    }
  });
  
  // Random flashing effect for existing events
  onMount(() => {
    randomFlashInterval = setInterval(() => {
      if (recentEvents.length > 0 && !newEventIndices.includes(recentEvents.length - 1)) {
        // Randomly flash an existing event (not the newest one)
        const randomIndex = Math.floor(Math.random() * (recentEvents.length - 1));
        flashEvent(randomIndex);
      }
    }, 5000); // Every 5 seconds
    
    return () => {
      clearInterval(randomFlashInterval);
    };
  });
</script>

<!-- LIVE ACTIVITY FEED -->
<div class="mb-6 overflow-hidden">
  <div class="flex items-center gap-2 mb-2">
    <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
    <h3 class="text-lg font-bold text-gray-300">LIVE ACTIVITY</h3>
  </div>
  
  <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-3 overflow-x-auto">
    <div class="flex gap-3 items-center">
      {#each recentEvents as event, i}
        <div 
          class="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm flex-shrink-0 animate-slide-in transition-all duration-200"
          class:bg-gray-800={!newEventIndices.includes(i)}
          class:bg-pink-600={newEventIndices.includes(i)}
          class:shadow-glow={newEventIndices.includes(i)}
        >
          {event.text}
        </div>
      {/each}
      
      {#if recentEvents.length === 0}
        <div class="text-gray-500 italic">Waiting for activity...</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .shadow-glow {
    box-shadow: 0 0 10px 2px rgba(236, 72, 153, 0.7);
    animation: flash 0.5s ease-in-out 3;
  }
  
  @keyframes flash {
    0%, 100% { 
      background-color: rgba(236, 72, 153, 0.8);
      box-shadow: 0 0 10px 2px rgba(236, 72, 153, 0.7);
    }
    50% { 
      background-color: rgba(236, 72, 153, 0.3);
      box-shadow: 0 0 15px 5px rgba(236, 72, 153, 0.9);
    }
  }
</style> 