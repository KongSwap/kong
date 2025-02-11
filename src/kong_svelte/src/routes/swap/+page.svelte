<script lang="ts">
  import { onDestroy } from "svelte";
  import { SwapMonitor } from "$lib/services/swap/SwapMonitor";
  import Swap from "$lib/components/swap/Swap.svelte";
  import SwapPro from "$lib/components/swap/SwapPro.svelte";
  
  // import { page } from "$app/stores";
  // import { fetchTokensByCanisterId } from "$lib/api/tokens";
  // import { ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  // import { browser } from "$app/environment";

  let currentMode: "normal" | "pro" = "normal";
  let isLoading = true; // Start with loading state


  const handleModeChange = (event: CustomEvent<{ mode: "normal" | "pro" }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapMonitor.cleanup();
  });
</script>

<section class="w-full overflow-x-hidden">
  <div class="p-2 md:p-0 w-full flex justify-center">
    {#if currentMode === "normal"}
      <Swap {currentMode} on:modeChange={handleModeChange} />
    {:else}
      <SwapPro {currentMode} on:modeChange={handleModeChange} />
    {/if}
  </div>
</section>
