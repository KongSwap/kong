<script lang="ts">
  export let flashEvent = null;
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { backOut, elasticOut, cubicOut } from 'svelte/easing';
  import { Zap, Award, Coins } from 'lucide-svelte';
  
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
    
    // Add the new event to our active events
    const randomX = Math.floor(Math.random() * 60) + 20; // Random position 20-80% across screen
    const newEvent = {
      ...flashEvent,
      position: randomX,
      scale: Math.random() * 0.3 + 0.9, // Random scale between 0.9 and 1.2
      rotation: Math.random() * 6 - 3, // Random rotation -3 to 3 degrees
      speed: Math.random() * 0.3 + 0.85, // Random speed multiplier
      id: flashEvent.id || `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isMiningEvent
    };
    
    activeEvents = [...activeEvents, newEvent];
    
    // Set a timeout to remove this event
    eventTimeouts[newEvent.id] = setTimeout(() => {
      activeEvents = activeEvents.filter(e => e.id !== newEvent.id);
      delete eventTimeouts[newEvent.id];
    }, isMiningEvent ? 5000 : 6000);
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
    if (eventType === 'mining' || eventType === 'solution_found') return 'BLOCK';
    return 'DEPLOY';
  }
  
  // Helper function to get title for event type
  function getEventTitle(eventType) {
    if (eventType.includes('token')) return 'NEW TOKEN';
    if (eventType.includes('miner')) return 'NEW MINER';
    if (eventType === 'mining' || eventType === 'solution_found') return 'BLOCK MINED';
    if (eventType === 'token_connected') return 'TOKEN CONNECTED';
    if (eventType === 'mining_started') return 'MINING STARTED';
    return 'NEW DEPLOYMENT';
  }
  
  // Helper function to get details for event
  function getEventDetails(event) {
    if (event.type === 'mining' || event.type === 'solution_found') {
      return `${event.data?.reward || ''} ${event.data?.ticker || 'TOKENS'}`;
    }
    if (event.data?.canister_id) {
      return `ID: ${event.data.canister_id.substring(0, 8)}...`;
    }
    if (event.data?.token_id) {
      return `ID: ${event.data.token_id.substring(0, 8)}...`;
    }
    return '';
  }
  
  // Helper function to get color scheme based on event type
  function getEventColorScheme(eventType) {
    if (eventType === 'mining' || eventType === 'solution_found') {
      return {
        bg: 'from-yellow-600 to-amber-800',
        border: 'border-yellow-500',
        text: 'text-yellow-200',
        glow: 'yellow-500'
      };
    }
    if (eventType === 'token_connected') {
      return {
        bg: 'from-green-600 to-emerald-800',
        border: 'border-green-500',
        text: 'text-green-200',
        glow: 'green-500'
      };
    }
    if (eventType.includes('token')) {
      return {
        bg: 'from-blue-600 to-blue-800',
        border: 'border-blue-500',
        text: 'text-blue-200',
        glow: 'blue-500'
      };
    }
    if (eventType.includes('miner')) {
      return {
        bg: 'from-purple-600 to-indigo-800',
        border: 'border-purple-500',
        text: 'text-purple-200',
        glow: 'purple-500'
      };
    }
    return {
      bg: 'from-blue-600 to-blue-800',
      border: 'border-blue-500',
      text: 'text-blue-200',
      glow: 'blue-500'
    };
  }
</script>

<!-- Floating event bubbles with improved animations -->
{#each activeEvents as event (event.id)}
  <div 
    in:fly={{ y: 100, duration: 800, delay: 100, easing: backOut }}
    out:fade={{ duration: 500 }}
    class="fixed z-40 pointer-events-none"
    style="bottom: {Math.random() * 30 + 20}vh; left: {event.position}vw; transform: scale({event.scale}) rotate({event.rotation}deg); --animation-speed: {event.speed};"
  >
    <div class="animate-float-up">
      <!-- Event card with dynamic styling based on event type -->
      {#if event.isMiningEvent}
        <!-- Mining event with special effects -->
        <div class="mining-event-card bg-gradient-to-r {getEventColorScheme(event.type).bg} rounded-lg p-4 border {getEventColorScheme(event.type).border} shadow-lg relative overflow-hidden">
          <!-- Glow effect -->
          <div class="absolute inset-0 opacity-30 glow-effect" style="background: radial-gradient(circle at center, #{getEventColorScheme(event.type).glow} 0%, transparent 70%);"></div>
          
          <!-- Sparkles -->
          <div class="sparkles"></div>
          
          <div class="flex flex-col items-center gap-2 text-center relative z-10">
            <!-- Icon based on event type -->
            <div class="mb-1">
              {#if event.type === 'mining' || event.type === 'solution_found'}
                <div class="mining-icon-container">
                  <Coins class="h-5 w-5 text-yellow-300" />
                </div>
              {:else if event.type === 'token_connected'}
                <div class="connect-icon-container">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-300">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
              {:else}
                <div class="mining-start-icon-container">
                  <Zap class="h-5 w-5 text-amber-300" />
                </div>
              {/if}
            </div>
            
            <div>
              <p class="font-bold text-sm text-white uppercase tracking-wider">
                {getEventTitle(event.type)}
              </p>
              <p class="text-xs font-medium {getEventColorScheme(event.type).text}">
                {getEventDetails(event)}
              </p>
            </div>
          </div>
          
          <!-- Particles for mining events -->
          <div class="mining-particles"></div>
        </div>
      {:else}
        <!-- Standard event card -->
        <div class="bg-gradient-to-r {getEventColorScheme(event.type).bg} rounded-lg p-4 border {getEventColorScheme(event.type).border} shadow-lg animate-pulse-subtle">
          <div class="flex flex-col items-center gap-2 text-center">
            <div>
              <p class="font-bold text-lg text-white uppercase tracking-wider">
                {getEventTitle(event.type)}
              </p>
              <p class="text-sm font-medium {getEventColorScheme(event.type).text}">
                {getEventDetails(event)}
              </p>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Improved trailing animation -->
      <div class="absolute -z-10 bottom-0 left-1/2 transform -translate-x-1/2">
        <div class="trail-effect"></div>
      </div>
    </div>
  </div>
{/each}

<!-- Enhanced notification for token and miner deployments -->
{#if flashEvent && (flashEvent.type.includes('token') || flashEvent.type.includes('miner')) && !flashEvent.type.includes('mining')}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    in:fade={{ duration: 300 }}
    out:fade={{ duration: 500 }}
  >
    <!-- Light overlay with blur -->
    <div class="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
    
    <!-- Main content with animation -->
    <div 
      class="relative w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 z-50"
      in:scale={{ duration: 400, start: 0.8, opacity: 0, easing: elasticOut }}
    >
      <div class="bg-gradient-to-r {getEventColorScheme(flashEvent.type).bg} rounded-lg p-6 border {getEventColorScheme(flashEvent.type).border} shadow-lg relative overflow-hidden">
        <!-- Background effects -->
        <div class="absolute inset-0 opacity-20">
          <div class="absolute inset-0 bg-grid"></div>
          <div class="absolute inset-0 bg-gradient-radial"></div>
        </div>
        
        <div class="flex flex-col items-center gap-4 text-center relative z-10">
          <!-- Icon -->
          <div class="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
            {#if flashEvent.type.includes('token')}
              <Coins class="h-8 w-8 text-white" />
            {:else}
              <Award class="h-8 w-8 text-white" />
            {/if}
          </div>
          
          <div>
            <p class="font-bold text-2xl text-white mb-2 uppercase tracking-wider">
              {flashEvent.type.includes('token') ? 'NEW TOKEN DEPLOYED' : 'NEW MINER DEPLOYED'}
            </p>
            <p class="text-xl font-medium {getEventColorScheme(flashEvent.type).text}">
              {flashEvent.data?.canister_id ? `ID: ${flashEvent.data.canister_id.substring(0, 8)}...` : ''}
            </p>
          </div>
          
          <!-- Decorative elements -->
          <div class="absolute top-0 right-0 w-32 h-32 opacity-20 transform rotate-45 translate-x-16 -translate-y-8 bg-white/10 rounded-full"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 opacity-20 transform -rotate-45 -translate-x-12 translate-y-6 bg-white/10 rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Base animations */
  @keyframes float-up {
    0% { transform: translateY(0); opacity: 0.9; }
    20% { opacity: 1; }
    80% { opacity: 0.9; }
    100% { transform: translateY(calc(-50vh * var(--animation-speed, 1))); opacity: 0; }
  }
  
  .animate-float-up {
    animation: float-up 5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    will-change: transform, opacity;
    transform: translateZ(0);
  }
  
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.95; transform: scale(0.98); }
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }
  
  /* Mining event specific styles */
  .mining-event-card {
    box-shadow: 0 0 15px rgba(255, 193, 7, 0.3);
    transform: translateZ(0);
    will-change: transform, opacity;
  }
  
  .mining-icon-container, 
  .connect-icon-container,
  .mining-start-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    position: relative;
  }
  
  .mining-icon-container {
    background: rgba(255, 193, 7, 0.2);
    border: 1px solid rgba(255, 193, 7, 0.5);
  }
  
  .connect-icon-container {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.5);
  }
  
  .mining-start-icon-container {
    background: rgba(251, 191, 36, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.5);
  }
  
  /* Sparkle effects */
  .sparkles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
  }
  
  .sparkles::before,
  .sparkles::after {
    content: '';
    position: absolute;
    width: 3px;
    height: 3px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: sparkle 2s infinite;
  }
  
  .sparkles::before {
    top: 20%;
    left: 15%;
    animation-delay: 0.3s;
  }
  
  .sparkles::after {
    top: 70%;
    right: 15%;
    animation-delay: 0.7s;
  }
  
  @keyframes sparkle {
    0% { transform: scale(0); opacity: 0; }
    50% { transform: scale(1.5); opacity: 0.8; }
    100% { transform: scale(0); opacity: 0; }
  }
  
  /* Mining particles */
  .mining-particles {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  .mining-particles::before,
  .mining-particles::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(255, 215, 0, 0.6);
    border-radius: 50%;
    animation: particle-float 2s infinite;
  }
  
  .mining-particles::before {
    bottom: 10px;
    left: 30%;
    animation-delay: 0.2s;
  }
  
  .mining-particles::after {
    bottom: 5px;
    right: 30%;
    animation-delay: 0.5s;
  }
  
  @keyframes particle-float {
    0% { transform: translateY(0) scale(0.8); opacity: 0.8; }
    50% { transform: translateY(-15px) scale(1.2); opacity: 0.4; }
    100% { transform: translateY(-30px) scale(0.6); opacity: 0; }
  }
  
  /* Trail effect */
  .trail-effect {
    width: 2px;
    height: 40px;
    background: linear-gradient(to top, transparent, rgba(59, 130, 246, 0.5), transparent);
    opacity: 0.5;
    animation: trail-fade 2s ease-out infinite;
  }
  
  @keyframes trail-fade {
    0% { height: 0; opacity: 0; }
    30% { height: 40px; opacity: 0.5; }
    100% { height: 20px; opacity: 0; }
  }
  
  /* Background patterns */
  .bg-grid {
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  
  .bg-gradient-radial {
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  }
  
  /* Glow effect */
  .glow-effect {
    animation: glow-pulse 2s infinite;
  }
  
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 0.4; }
  }
</style>