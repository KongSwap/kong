<script lang="ts">
	import { formatTokenAmount } from '$lib/utils/numberFormatUtils';
  import { fade, scale } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import Button from "$lib/components/common/Button.svelte";
  import BananaRain from "$lib/components/common/BananaRain.svelte";
  import { onDestroy, onMount } from "svelte";
  import coinReceivedSound from "$lib/assets/sounds/coin_received.mp3";
  import { settingsStore } from "$lib/services/settings/settingsStore";

  export let show = false;
  export let payAmount: string;
  export let payToken: FE.Token;
  export let receiveAmount: string;
  export let receiveToken: FE.Token;
  export let onClose: () => void;

  let countdown = 4;
  let countdownInterval: ReturnType<typeof setInterval>;
  let isCountdownActive = false;

  $: if (show) {
    resetAndStartCountdown();
  }

  function resetAndStartCountdown() {
    clearInterval(countdownInterval);
    countdown = 4;
    isCountdownActive = true;
    startCountdown();
  }

  function startCountdown() {
    if ($settingsStore.sound_enabled) {
      const audio1 = new Audio(coinReceivedSound);
      const audio2 = new Audio(coinReceivedSound);
      const audio3 = new Audio(coinReceivedSound);

      setTimeout(() => {
        audio1.play();
      }, 300);

      setTimeout(() => {
        audio2.play();
      }, 600);

      setTimeout(() => {
        audio3.play();
      }, 900);
    }

    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        isCountdownActive = false;
        onClose();
      }
    }, 1000);
  }

  function handleClick() {
    if (isCountdownActive && show) {
      clearInterval(countdownInterval);
      isCountdownActive = false;
    } else {
      onClose();
    }
  }

  onDestroy(() => {
    clearInterval(countdownInterval);
    isCountdownActive = false;
  });
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center"
    transition:fade={{ duration: 200 }}
    on:click={handleClick}
  >
    <div
      class="bg-gradient-to-br from-yellow-400/90 to-lime-400/90 p-8 rounded-t-2xl rounded-b-xl max-w-md w-full mx-4 shadow-2xl relative"
      transition:scale={{ duration: 400, easing: backOut }}
      on:click|stopPropagation
    >
      <!-- Progress bar -->
      <div
        class="absolute bottom-0 left-0 h-3 bg-yellow-500 rounded-b-xl"
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
            <div class="font-bold">{formatTokenAmount(payAmount, payToken.decimals).toString()} {payToken.symbol}</div>
          </div>

          <div class="flex justify-center my-2">
            <div class="text-2xl">⬇️</div>
          </div>

          <div class="flex items-center justify-between">
            <div class="text-sm opacity-80">You received</div>
            <div class="font-bold">{formatTokenAmount(receiveAmount, receiveToken.decimals).toString()} {receiveToken.symbol}</div>
          </div>
        </div>

        <Button variant="yellow" onClick={handleClick} width="100%">
          {isCountdownActive ? `Closing in ${countdown}... ` : "Close"}
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
