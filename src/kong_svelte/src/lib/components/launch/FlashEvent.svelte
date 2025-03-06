<script lang="ts">
  export let flashEvent = null;
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
</script>

{#if flashEvent}
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
            {flashEvent.type.includes('token') ? '💰' : flashEvent.type.includes('miner') ? '⛏️' : '🚀'}
          </div>
          <div>
            <p class="font-extrabold text-5xl text-white mb-4 animate-[pulse_0.3s_ease-in-out_infinite] uppercase tracking-wider animate-shake-text">
              {flashEvent.type.includes('token') ? 'NEW TOKEN LAUNCHED!' : 
               flashEvent.type.includes('miner') ? 'NEW MINER DEPLOYED!' : 
               'NEW DEPLOYMENT!'}
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
</style>