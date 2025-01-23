<script lang="ts">
  import { onDestroy } from "svelte";
  import { SwapMonitor } from "$lib/services/swap/SwapMonitor";
  import Swap from "$lib/components/swap/Swap.svelte";
  import SwapPro from "$lib/components/swap/SwapPro.svelte";
  import { page } from "$app/stores";
  import { userTokens } from "$lib/stores/userTokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
    import { ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: "normal" | "pro" = "normal";
  let isLoading = false;

  async function initializeTokens() {
    const fromCanisterId = $page.url.searchParams.get("from") || ICP_CANISTER_ID;
    const toCanisterId = $page.url.searchParams.get("to") || KONG_LEDGER_CANISTER_ID;

    if (fromCanisterId || toCanisterId) {
      const canisterIds = [fromCanisterId, toCanisterId].filter((id): id is string => !!id);
      if (canisterIds.length > 0) {
        isLoading = true;
        try {
          const tokens = await fetchTokensByCanisterId(canisterIds);
          fromToken = fromCanisterId ? tokens.find(t => t.canister_id === fromCanisterId) || null : null;
          toToken = toCanisterId ? tokens.find(t => t.canister_id === toCanisterId) || null : null;
        } catch (error) {
          console.error("Error fetching tokens:", error);
          // Fallback to userTokens store
          fromToken = fromCanisterId ? $userTokens.tokens.find(t => t.canister_id === fromCanisterId) || null : null;
          toToken = toCanisterId ? $userTokens.tokens.find(t => t.canister_id === toCanisterId) || null : null;
        } finally {
          isLoading = false;
        }
      } else {
        fromToken = null;
        toToken = null;
      }
    } else {
      fromToken = null;
      toToken = null;
    }
  }

  // Re-initialize when URL params change
  $: if ($page.url.searchParams) {
    initializeTokens();
  }

  const handleModeChange = (event: CustomEvent<{ mode: "normal" | "pro" }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapMonitor.cleanup();
  });
</script>

<section class="w-full overflow-x-hidden">
  {#if isLoading}
    <p>Loading tokens...</p>
  {:else if $userTokens.tokens}
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
  {:else}
    <p>Loading tokens...</p>
  {/if}
</section>
