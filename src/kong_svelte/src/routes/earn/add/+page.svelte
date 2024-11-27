<script lang="ts">
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { swapState } from "$lib/services/swap/SwapStateService";

  let token0: FE.Token | null = null;
  let token1: FE.Token | null = null;
  let amount0 = "";
  let amount1 = "";
  let loading = false;
  let error: string | null = null;
  let token0Balance = "0";
  let token1Balance = "0";

  $: {
    // Update balances when tokens change
    if (token0) {
      token0Balance = $tokenStore.balances[token0.canister_id]?.in_tokens?.toString() || "0";
    }
    if (token1) {
      token1Balance = $tokenStore.balances[token1.canister_id]?.in_tokens?.toString() || "0";
    }
  }

  // Initialize swapState
  onMount(() => {
    // Check URL parameters for initial tokens
    const searchParams = $page.url.searchParams;
    const token0Address = searchParams.get("token0");
    const token1Address = searchParams.get("token1");

    if (token0Address && $formattedTokens) {
      token0 = $formattedTokens.find((t) => t.canister_id === token0Address) || null;
    }
    if (token1Address && $formattedTokens) {
      token1 = $formattedTokens.find((t) => t.canister_id === token1Address) || null;
    }

    // Initialize swapState with current tokens
    swapState.update(s => ({
      ...s,
      payToken: token0,
      receiveToken: token1,
      showPayTokenSelector: false,
      showReceiveTokenSelector: false
    }));
  });

  // Subscribe to swapState changes
  $: {
    if ($swapState.payToken && $swapState.payToken !== token0) {
      token0 = $swapState.payToken;
      amount0 = "";
      updateURL();
    }
    if ($swapState.receiveToken && $swapState.receiveToken !== token1) {
      token1 = $swapState.receiveToken;
      amount1 = "";
      updateURL();
    }
  }

  function updateURL() {
    const searchParams = new URLSearchParams($page.url.searchParams);
    if (token0) searchParams.set("token0", token0.canister_id);
    if (token1) searchParams.set("token1", token1.canister_id);
    goto(`?${searchParams.toString()}`, { replaceState: true });
  }

  function handleTokenSelect(index: 0 | 1) {
    // Show the appropriate token selector
    swapState.update(s => ({
      ...s,
      showPayTokenSelector: index === 0,
      showReceiveTokenSelector: index === 1
    }));
  }

  function handleInput(index: 0 | 1, value: string) {
    if (index === 0) {
      amount0 = value;
    } else {
      amount1 = value;
    }
    error = null;
  }

  async function handleSubmit() {
    if (!token0 || !token1 || !amount0 || !amount1) {
      error = "Please fill in all fields";
      return;
    }
    
    try {
      loading = true;
      error = null;
      // Add your submission logic here
    } catch (err) {
      console.error('Error submitting liquidity:', err);
      error = err.message || 'Failed to add liquidity';
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    goto("/earn");
  }
</script>

<div class="container">
  <div class="header">
    <button class="back-button" on:click={handleBack}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>Back to Pools</span>
    </button>
    <h1>Add Liquidity</h1>
  </div>

  <div class="form-container">
    <AddLiquidityForm
      bind:token0
      bind:token1
      bind:amount0
      bind:amount1
      bind:loading
      bind:error
      {token0Balance}
      {token1Balance}
      onTokenSelect={handleTokenSelect}
      onInput={handleInput}
      onSubmit={handleSubmit}
      previewMode={false}
    />
  </div>
</div>

<style lang="postcss">
  .container {
    @apply max-w-2xl mx-auto px-4 py-6 w-full;
  }

  .header {
    @apply mb-8 flex flex-col gap-4;
  }

  .back-button {
    @apply flex items-center gap-2 text-white/60 hover:text-white 
             transition-colors duration-200 w-fit;
  }

  h1 {
    @apply text-2xl font-semibold text-white;
  }

  @media (max-width: 640px) {
    .container {
      @apply px-2 py-4;
    }

    .header {
      @apply mb-4;
    }
  }
</style>
