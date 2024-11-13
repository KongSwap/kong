<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Button from '$lib/components/common/Button.svelte';
  import BananaRain from '$lib/components/common/BananaRain.svelte';
  import { onMount, onDestroy } from 'svelte';

  export let show = false;
  export let payAmount: string;
  export let payToken: string;
  export let receiveAmount: string;
  export let receiveToken: string;
  export let onClose: () => void;

  let countdown = 5;
  let countdownInterval: ReturnType<typeof setInterval>;

  function startCountdown() {
    countdown = 5;
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        onClose();
      }
    }, 1000);
  }

  $: if (show) {
    startCountdown();
  }

  onDestroy(() => {
    clearInterval(countdownInterval);
  });
</script>

{#if show}
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center"
    transition:fade={{ duration: 200 }}
    on:click={onClose}
  >
    <div 
      class="bg-gradient-to-br from-yellow-400/90 to-lime-400/90 p-8 rounded-2xl max-w-md w-full mx-4 shadow-2xl relative"
      transition:scale={{ duration: 400, easing: backOut }}
      on:click|stopPropagation
    >
      <!-- Progress bar -->
      <div 
        class="absolute top-0 left-0 h-1 bg-yellow-500"
        style="width: {(countdown / 5) * 100}%; transition: width 1s linear"
      />

      <div class="text-center" in:scale={{ delay: 200, duration: 400 }}>
        <div class="text-6xl mb-4 flex items-center justify-center">
          <img src="/stats/banana_dance.gif" class="w-1/2" alt="Success" />
        </div>
        <h2 class="text-2xl font-bold mb-6">Swap Complete!</h2>
        
        <div class="bg-white/20 backdrop-blur rounded-xl p-4 mb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm opacity-80">You paid</div>
            <div class="font-bold">{payAmount} {payToken}</div>
          </div>
          
          <div class="flex justify-center my-2">
            <div class="text-2xl">⬇️</div>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="text-sm opacity-80">You received</div>
            <div class="font-bold">{receiveAmount} {receiveToken}</div>
          </div>
        </div>

        <Button
          variant="yellow"
          onClick={onClose}
          width="100%"
        >
          Close ({countdown}s)
        </Button>
      </div>
    </div>
    <BananaRain />
  </div>
{/if}

<style>
  .bg-gradient-to-br {
    background-color: rgba(255, 255, 255, 0.9);
  }

  /* Smooth transition for progress bar */
  [style*="width:"] {
    transition: width 0.2s linear;
  }
</style> 