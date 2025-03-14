<script lang="ts">
  import { onDestroy } from "svelte";
  import { SwapMonitor } from "$lib/services/swap/SwapMonitor";
  import Swap from "$lib/components/swap/Swap.svelte";
  import SwapPro from "$lib/components/swap/SwapPro.svelte";

  let currentMode: "normal" | "pro" = "normal";


  const handleModeChange = (event: CustomEvent<{ mode: "normal" | "pro" }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapMonitor.cleanup();
  });
</script>

<svelte:head>
  <title>Swap - KongSwap</title>
</svelte:head>

<section class="w-full overflow-x-hidden">
  <div class="p-2 md:p-0 w-full flex justify-center min-h-[calc(100vh-36rem)] items-center">
    {#if currentMode === "normal"}
      <Swap {currentMode} on:modeChange={handleModeChange} />
    {:else}
      <SwapPro {currentMode} on:modeChange={handleModeChange} />
    {/if}
  </div>
</section>
