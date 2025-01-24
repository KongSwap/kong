<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SwapMonitor } from "$lib/services/swap/SwapMonitor";
  import Swap from "$lib/components/swap/Swap.svelte";
  import SwapPro from "$lib/components/swap/SwapPro.svelte";
  import { page } from "$app/stores";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { browser } from "$app/environment";

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: "normal" | "pro" = "normal";
  let isLoading = true; // Start with loading state

  async function initializeTokens() {
    if(!browser) return;

    try {
      const fromCanisterId = $page.url.searchParams.get("from") || ICP_CANISTER_ID;
      const toCanisterId = $page.url.searchParams.get("to") || KONG_LEDGER_CANISTER_ID;
      
      // Always fetch both default tokens
      const tokens = await fetchTokensByCanisterId([fromCanisterId, toCanisterId]);
      
      fromToken = tokens.find(t => t.canister_id === fromCanisterId) || null;
      toToken = tokens.find(t => t.canister_id === toCanisterId) || null;
    } catch (error) {
      console.error("Error initializing tokens:", error);
      fromToken = null;
      toToken = null;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    initializeTokens();
  });

  const handleModeChange = (event: CustomEvent<{ mode: "normal" | "pro" }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapMonitor.cleanup();
  });
</script>

<section class="w-full overflow-x-hidden">
  {#if isLoading}
    <div class="flex justify-center items-center min-h-[400px]">
      <p>Loading tokens...</p>
    </div>
  {:else}
    <div class="p-2 md:p-0 w-full flex justify-center">
      {#if currentMode === "normal"}
        <Swap
          initialFromToken={fromToken}
          initialToToken={toToken}
          {currentMode}
          on:modeChange={handleModeChange}
        />
      {:else}
        <SwapPro
          initialFromToken={fromToken}
          initialToToken={toToken}
          {currentMode}
          on:modeChange={handleModeChange}
        />
      {/if}
    </div>
  {/if}
</section>
