<script lang="ts">
  import { onDestroy } from "svelte";
  import { SwapMonitor } from "$lib/services/swap/SwapMonitor";
  import Swap from "$lib/components/swap/Swap.svelte";
  import SwapPro from "$lib/components/swap/SwapPro.svelte";
  import { page } from "$app/stores";
  import { userTokens } from "$lib/stores/userTokens";

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: "normal" | "pro" = "normal";

  $: if ($userTokens.tokens && $userTokens.tokens.length > 0) {
    const fromCanisterId = $page.url.searchParams.get("from");
    const toCanisterId = $page.url.searchParams.get("to");

    fromToken = fromCanisterId
      ? $userTokens.tokens.find((t) => t.canister_id === fromCanisterId) || null
      : null;
    toToken = toCanisterId
      ? $userTokens.tokens.find((t) => t.canister_id === toCanisterId) || null
      : null;
  }

  const handleModeChange = (event: CustomEvent<{ mode: "normal" | "pro" }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapMonitor.cleanup();
  });
</script>

<section class="w-full overflow-x-hidden">
  {#if $userTokens.tokens}
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
