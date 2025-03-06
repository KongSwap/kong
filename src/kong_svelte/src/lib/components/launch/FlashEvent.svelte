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
  
  // Helper function to get emoji for event type
  function getEventEmoji(eventType) {
    if (eventType.includes('token')) return '💰';
    if (eventType.includes('miner')) return '⛏️';
    if (eventType === 'mining') return '💎';
    return '🚀';
  }
  
  // Helper function to get title for event type
  function getEventTitle(eventType) {
    if (eventType.includes('token')) return 'NEW TOKEN!';
    if (eventType.includes('miner')) return 'NEW MINER!';
    if (eventType === 'mining') return 'BLOCK MINED!';
    return 'NEW DEPLOYMENT!';
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
      <div class="bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg p-4 border-2 border-pink-400 shadow-[0_0_30px_5px_rgba(236,72,153,0.5)] animate-pulse-subtle">
        <div class="flex flex-col items-center gap-2 text-center">
          <div class="text-4xl animate-bounce">
            {getEventEmoji(event.type)}
          </div>
          <div>
            <p class="font-bold text-lg text-white uppercase tracking-wider">
              {getEventTitle(event.type)}
            </p>
            <p class="text-sm font-medium text-pink-200">
              {getEventDetails(event)}
            </p>
          </div>
          
          <!-- Small LFG text -->
          <p class="text-xl font-black text-yellow-300 animate-pulse mt-1">🔥 LFG 🔥</p>
        </div>
      </div>
      
      <!-- Trailing particles -->
      <div class="absolute -z-10 bottom-0 left-1/2 transform -translate-x-1/2">
        {#each Array(5) as _, i}
          <div 
            class="absolute text-sm animate-particle" 
            style="animation-delay: {i * 0.2}s; left: {(i - 2) * 10}px;">
            {['✨', '💫', '⭐', '🔥', '💥'][i % 5]}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/each}

<!-- Keep the full-screen effect only for token and miner deployments, not for mining events -->
{#if flashEvent && (flashEvent.type.includes('token') || flashEvent.type.includes('miner')) && !flashEvent.type.includes('mining')}
  <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
    <!-- Full screen overlay with pulsing background -->
    <div class="absolute inset-0 bg-black/40 animate-pulse-fast"></div>
    
    <!-- Explosion effect -->
    <div class="absolute inset-0 bg-gradient-to-r from-pink-600/30 via-transparent to-purple-600/30 animate-pulse-fast"></div>
    
    <!-- Starburst effect -->
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="w-screen h-screen bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-pink-500/70 via-transparent to-transparent animate-ping"></div>
    </div>
    
    <!-- Main content explosion with shake effect -->
    <div class="relative w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 transform scale-100 animate-[ping_0.5s_ease-in-out_1] z-50 animate-shake">
      <div class="bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg p-8 border-4 border-pink-400 shadow-[0_0_100px_20px_rgba(236,72,153,0.7)] animate-pulse-fast">
        <div class="flex flex-col items-center gap-6 text-center">
          <div class="text-9xl animate-[bounce_0.5s_infinite]">
            {flashEvent.type.includes('token') ? '💰' : '⛏️'}
          </div>
          <div>
            <p class="font-extrabold text-5xl text-white mb-4 animate-[pulse_0.3s_ease-in-out_infinite] uppercase tracking-wider animate-shake-text">
              {flashEvent.type.includes('token') ? 'NEW TOKEN LAUNCHED!' : 'NEW MINER DEPLOYED!'}
            </p>
            <p class="text-2xl font-bold text-pink-200 animate-[pulse_0.5s_ease-in-out_infinite]">
              {flashEvent.data?.canister_id ? `ID: ${flashEvent.data.canister_id.substring(0, 8)}...` : ''}
            </p>
          </div>
          
          <!-- Ultra Flashing LFG text -->
          <p class="text-7xl font-black text-yellow-300 animate-[pulse_0.15s_ease-in-out_infinite] mt-4 animate-shake-intense">LFG!!! 🔥🔥🔥</p>
        </div>
      </div>
    </div>
    
    <!-- More floating emojis -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      {#each Array(40) as _, i}
        <div 
          class="absolute text-4xl animate-float" 
          style="left: {Math.random() * 100}vw; top: {Math.random() * 100}vh; animation-delay: {Math.random() * 2}s; animation-duration: {2 + Math.random() * 3}s">
          {['🚀', '💰', '💎', '🔥', '⛏️', '🤑', '💸', '🦈', '🌊', '💯', '🏆'][Math.floor(Math.random() * 11)]}
        </div>
      {/each}
    </div>
    
    <!-- Laser beams -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      {#each Array(10) as _, i}
        <div 
          class="absolute h-1 w-full bg-gradient-to-r from-transparent via-pink-500 to-transparent animate-laser" 
          style="top: {Math.random() * 100}vh; animation-delay: {Math.random() * 1}s; transform: rotate({Math.random() * 10 - 5}deg);">
        </div>
      {/each}
    </div>
    
    <!-- Glitch overlay -->
    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent animate-glitch pointer-events-none"></div>
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