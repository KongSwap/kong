<script lang="ts">
  export let flashEvent = null;
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  
  // Track multiple events for the bubble-up effect
  let activeEvents = [];
  let eventTimeouts = {};
  
  // Watch for changes to flashEvent
  $: if (flashEvent && flashEvent.id) {
    // For mining events, we want to show the bubble-up animations but not the full-screen effects
    const isMiningEvent = flashEvent.type === 'mining' || 
                          flashEvent.type === 'solution_found' || 
                          flashEvent.type === 'token_connected' || 
                          flashEvent.type === 'mining_started';
    
    if (!isMiningEvent) {
      // Add the new event to our active events for non-mining events
      const randomX = Math.floor(Math.random() * 80) + 10; // Random position 10-90% across screen
      const newEvent = {
        ...flashEvent,
        position: randomX,
        scale: Math.random() * 0.4 + 0.8, // Random scale between 0.8 and 1.2
        rotation: Math.random() * 10 - 5, // Random rotation -5 to 5 degrees
      };
      
      activeEvents = [...activeEvents, newEvent];
      
      // Set a timeout to remove this event
      eventTimeouts[flashEvent.id] = setTimeout(() => {
        activeEvents = activeEvents.filter(e => e.id !== flashEvent.id);
        delete eventTimeouts[flashEvent.id];
      }, 6000);
    }
  }
  
  // Clean up timeouts on component destroy
  onDestroy(() => {
    Object.values(eventTimeouts).forEach(timeout => {
      if (timeout) clearTimeout(timeout as number);
    });
  });
  
  // Helper function to get icon for event type
  function getEventIcon(eventType) {
    if (eventType.includes('token')) return 'TOKEN';
    if (eventType.includes('miner')) return 'MINER';
    if (eventType === 'mining') return 'BLOCK';
    return 'DEPLOY';
  }
  
  // Helper function to get title for event type
  function getEventTitle(eventType) {
    if (eventType.includes('token')) return 'NEW TOKEN';
    if (eventType.includes('miner')) return 'NEW MINER';
    if (eventType === 'mining') return 'BLOCK MINED';
    return 'NEW DEPLOYMENT';
  }
  
  // Helper function to get details for event
  function getEventDetails(event) {
    if (event.type === 'mining') {
      return `${event.data?.reward} ${event.data?.ticker || 'TOKENS'}`;
    }
    if (event.data?.canister_id) {
      return `ID: ${event.data.canister_id.substring(0, 8)}...`;
    }
    return '';
  }
</script>

<!-- Floating event bubbles -->
{#each activeEvents as event (event.id)}
  <div 
    in:fly={{ y: 100, duration: 800, delay: 100 }}
    out:fade={{ duration: 500 }}
    class="fixed z-40 pointer-events-none"
    style="bottom: {Math.random() * 30 + 20}vh; left: {event.position}vw; transform: scale({event.scale}) rotate({event.rotation}deg);"
  >
    <div class="animate-float-up">
      <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-4 border border-blue-500 shadow-lg animate-pulse-subtle">
        <div class="flex flex-col items-center gap-2 text-center">
          <div>
            <p class="font-bold text-lg text-white uppercase tracking-wider">
              {getEventTitle(event.type)}
            </p>
            <p class="text-sm font-medium text-blue-200">
              {getEventDetails(event)}
            </p>
          </div>
        </div>
      </div>
      
      <!-- Small trailing animation -->
      <div class="absolute -z-10 bottom-0 left-1/2 transform -translate-x-1/2">
        <div class="w-2 h-10 bg-gradient-to-t from-blue-500 to-transparent opacity-50"></div>
      </div>
    </div>
  </div>
{/each}

<!-- Simplified notification for token and miner deployments -->
{#if flashEvent && (flashEvent.type.includes('token') || flashEvent.type.includes('miner')) && !flashEvent.type.includes('mining')}
  <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
    <!-- Light overlay -->
    <div class="absolute inset-0 bg-black/20"></div>
    
    <!-- Main content -->
    <div class="relative w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 z-50">
      <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 border border-blue-500 shadow-lg">
        <div class="flex flex-col items-center gap-4 text-center">
          <div>
            <p class="font-bold text-2xl text-white mb-2 uppercase tracking-wider">
              {flashEvent.type.includes('token') ? 'NEW TOKEN DEPLOYED' : 'NEW MINER DEPLOYED'}
            </p>
            <p class="text-xl font-medium text-blue-200">
              {flashEvent.data?.canister_id ? `ID: ${flashEvent.data.canister_id.substring(0, 8)}...` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes float {
    0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
  }
  
  .animate-float {
    animation: float 8s linear infinite;
  }
  
  @keyframes float-up {
    0% { transform: translateY(0); opacity: 0.7; }
    80% { opacity: 1; }
    100% { transform: translateY(-50vh); opacity: 0; }
  }
  
  .animate-float-up {
    animation: float-up 6s ease-out forwards;
  }
  
  @keyframes particle {
    0% { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(20px) scale(0.5); opacity: 0; }
  }
  
  .animate-particle {
    animation: particle 1.5s ease-out infinite;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  .animate-shake {
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) infinite;
  }
  
  @keyframes shake-text {
    0%, 100% { transform: translateX(0) translateY(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px) translateY(1px); }
    20%, 40%, 60%, 80% { transform: translateX(2px) translateY(-1px); }
  }
  
  .animate-shake-text {
    animation: shake-text 0.3s cubic-bezier(.36,.07,.19,.97) infinite;
  }
  
  @keyframes shake-intense {
    0%, 100% { transform: translateX(0) translateY(0) rotate(0); }
    10%, 50%, 90% { transform: translateX(-4px) translateY(2px) rotate(-1deg); }
    30%, 70% { transform: translateX(4px) translateY(-2px) rotate(1deg); }
  }
  
  .animate-shake-intense {
    animation: shake-intense 0.2s cubic-bezier(.36,.07,.19,.97) infinite;
  }
  
  @keyframes laser {
    0% { transform: translateX(-100%) scaleY(1); opacity: 0; }
    50% { opacity: 1; transform: translateX(0%) scaleY(3); }
    100% { transform: translateX(100%) scaleY(1); opacity: 0; }
  }
  
  .animate-laser {
    animation: laser 2s linear infinite;
  }
  
  @keyframes glitch {
    0%, 100% { opacity: 0; }
    5%, 10% { opacity: 0.5; transform: translateX(-10px); }
    15%, 20% { opacity: 0.25; transform: translateX(10px); }
    25% { opacity: 0; }
    30%, 35% { opacity: 0.5; transform: translateY(5px); }
    40% { opacity: 0; }
    45%, 50% { opacity: 0.25; transform: translateY(-5px); }
    55% { opacity: 0; }
  }
  
  .animate-glitch {
    animation: glitch 3s linear infinite;
  }
  
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.9; }
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 1.5s ease-in-out infinite;
  }
</style>