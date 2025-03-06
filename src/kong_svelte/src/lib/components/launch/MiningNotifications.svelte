<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { formatBalance } from "$lib/components/launch/LaunchUtils";
  
  // Props
  export let miningEvents = [];
  
  // State
  let coins = [];
  let coinInterval;
  let bubbles = [];
  
  // Create random floating coins and bubbles when mining events occur
  $: if (miningEvents.length > 0) {
    const latestEvent = miningEvents[miningEvents.length - 1];
    // Add some coins when mining events happen
    addRandomCoins(5 + Math.floor(Math.random() * 8));
    
    // Add a bubble notification for mining events
    if (latestEvent.type === 'solution_found') {
      addMiningBubble(latestEvent);
    }
  }
  
  onMount(() => {
    // Periodically add a few coins for ambient effect
    coinInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        addRandomCoins(1);
      }
    }, 5000);
  });
  
  onDestroy(() => {
    if (coinInterval) clearInterval(coinInterval);
  });
  
  function addRandomCoins(count) {
    for (let i = 0; i < count; i++) {
      const newCoin = {
        id: crypto.randomUUID(),
        x: Math.random() * 100, // Random position 0-100% across screen
        y: 100 + Math.random() * 20, // Start below the screen
        size: Math.random() * 20 + 10, // Random size 10-30px
        speed: Math.random() * 3 + 2, // Random speed
        rotation: Math.random() * 360, // Random initial rotation
        emoji: Math.random() > 0.5 ? '💰' : '💎', // Randomly choose emoji
      };
      
      coins = [...coins, newCoin];
      
      // Remove coin after animation completes
      setTimeout(() => {
        coins = coins.filter(c => c.id !== newCoin.id);
      }, 10000);
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

<!-- Floating coins -->
{#each coins as coin (coin.id)}
  <div 
    in:fade={{ duration: 500 }}
    out:fade={{ duration: 500 }}
    class="fixed z-30 pointer-events-none animate-coin-float"
    style="left: {coin.x}vw; bottom: {-coin.y}vh; font-size: {coin.size}px; animation-duration: {coin.speed}s; transform: rotate({coin.rotation}deg);"
  >
    <div class="animate-coin-spin">
      {coin.emoji}
    </div>
  </div>
{/each}

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
      <div class="bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg p-4 border-2 border-pink-400 shadow-[0_0_30px_5px_rgba(236,72,153,0.5)] animate-pulse-subtle">
        <div class="flex flex-col items-center gap-2 text-center">
          <div class="text-4xl animate-bounce">
            💎
          </div>
          <div>
            <p class="font-bold text-lg text-white uppercase tracking-wider">
              BLOCK MINED!
            </p>
            <p class="text-sm font-medium text-pink-200">
              {bubble.reward} {bubble.ticker}
            </p>
            <p class="text-xs font-medium text-pink-200/80">
              HASH: {bubble.hash}...
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

<!-- Sparkles that appear randomly -->
<div class="fixed inset-0 z-20 pointer-events-none overflow-hidden">
  {#each Array(10) as _, i}
    <div 
      class="absolute text-yellow-300 animate-sparkle opacity-70"
      style="left: {Math.random() * 100}vw; top: {Math.random() * 100}vh; font-size: {Math.random() * 10 + 10}px; animation-delay: {Math.random() * 5}s; animation-duration: {Math.random() * 2 + 1}s;"
    >
      ✨
    </div>
  {/each}
</div>

<style>
  @keyframes coin-float {
    0% { transform: translateY(0) rotate(0deg); }
    100% { transform: translateY(-120vh) rotate(20deg); }
  }
  
  .animate-coin-float {
    animation: coin-float 10s linear forwards;
  }
  
  @keyframes coin-spin {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
  }
  
  .animate-coin-spin {
    animation: coin-spin 1.5s linear infinite;
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
  
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.9; }
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 1.5s ease-in-out infinite;
  }
  
  @keyframes sparkle {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.5); opacity: 1; }
  }
  
  .animate-sparkle {
    animation: sparkle 2s ease-in-out infinite;
  }
</style> 