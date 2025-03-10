<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { formatBalance } from "$lib/components/launch/LaunchUtils";
  
  // Props
  export let miningEvents = [];
  
  // State
  let bubbles = [];
  
  // Create bubbles when mining events occur
  $: if (miningEvents.length > 0) {
    const latestEvent = miningEvents[miningEvents.length - 1];
    
    // Add a bubble notification for mining events
    if (latestEvent.type === 'solution_found') {
      addMiningBubble(latestEvent);
    }
  }
  
  function addMiningBubble(event) {
    const randomX = Math.floor(Math.random() * 80) + 10; // Random position 10-90% across screen
    const reward = event.data?.reward || 0;
    const decimals = event.data?.decimals || 8;
    const ticker = event.data?.ticker || "TOKENS";
    const hash = event.data?.hash?.substring(0, 8) || "unknown";
    const tokenId = event.data?.token_id || "";
    
    // Format the reward with the correct decimals
    const formattedReward = formatBalance(reward.toString(), decimals);
    
    const newBubble = {
      id: crypto.randomUUID(),
      position: randomX,
      scale: Math.random() * 0.4 + 0.8, // Random scale between 0.8 and 1.2
      rotation: Math.random() * 10 - 5, // Random rotation -5 to 5 degrees
      reward: formattedReward,
      ticker: ticker,
      hash: hash,
      tokenId: tokenId
    };
    
    bubbles = [...bubbles, newBubble];
    
    // Remove bubble after animation completes
    setTimeout(() => {
      bubbles = bubbles.filter(b => b.id !== newBubble.id);
    }, 6000);
  }
  
  function navigateToToken(tokenId) {
    if (tokenId) {
      window.location.href = `/launch/token/${tokenId}`;
    }
  }
</script>

<!-- Mining event bubbles -->
{#each bubbles as bubble (bubble.id)}
  <div 
    in:fly={{ y: 100, duration: 800, delay: 100 }}
    out:fade={{ duration: 500 }}
    class="fixed z-40 pointer-events-auto cursor-pointer"
    style="bottom: {Math.random() * 30 + 20}vh; left: {bubble.position}vw; transform: scale({bubble.scale}) rotate({bubble.rotation}deg);"
    on:click={() => navigateToToken(bubble.tokenId)}
  >
    <div class="animate-float-up">
      <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-4 border border-blue-500 shadow-lg animate-pulse-subtle">
        <div class="flex flex-col items-center gap-2 text-center">
          <div>
            <p class="font-bold text-lg text-white uppercase tracking-wider">
              BLOCK MINED
            </p>
            <p class="text-sm font-medium text-blue-200">
              {bubble.reward} {bubble.ticker}
            </p>
            <p class="text-xs font-medium text-blue-200/80">
              HASH: {bubble.hash}...
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

<style>
  @keyframes float-up {
    0% { transform: translateY(0); opacity: 0.7; }
    80% { opacity: 1; }
    100% { transform: translateY(-50vh); opacity: 0; }
  }
  
  .animate-float-up {
    animation: float-up 6s ease-out forwards;
  }
  
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.9; }
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 1.5s ease-in-out infinite;
  }
</style> 