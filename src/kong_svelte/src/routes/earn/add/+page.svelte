<script lang="ts">
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { PoolService } from "$lib/services/pools/PoolService";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { browser } from "$app/environment";
  import { toastStore } from "$lib/stores/toastStore";

  let token0: FE.Token | null = null;
  let token1: FE.Token | null = null;
  let amount0 = "";
  let amount1 = "";
  let loading = false;
  let error: string | null = null;
  let token0Balance = "0";
  let token1Balance = "0";
  let pool: BE.Pool | null = null;
  let previewMode = false;
  let showConfirmation = false;

  $: {
    if ($formattedTokens) {
      initializeFromParams();
    }
  }

  $: {
    // Update balances when tokens change
    if (token0) {
      token0Balance = $tokenStore.balances[token0.canister_id]?.in_tokens?.toString() || "0";
    }
    if (token1) {
      token1Balance = $tokenStore.balances[token1.canister_id]?.in_tokens?.toString() || "0";
    }
  }

  $: {
    // When either token changes, try to fetch pool info and update URL
    if (token0 || token1) {
      updateURL();
      if (token0 && token1) {
        fetchPoolInfo();
      } else {
        pool = null;
      }
    }
  }

  async function fetchPoolInfo() {
    try {
      const pools = $poolStore.pools;
      pool = pools.find(
        p => (p.address_0 === token0?.canister_id && p.address_1 === token1?.canister_id) ||
             (p.address_0 === token1?.canister_id && p.address_1 === token0?.canister_id)
      ) || null;
    } catch (err) {
      console.error('Error fetching pool info:', err);
      toastStore.error(err.message || "Failed to fetch pool info", 8000, "Error");
      pool = null;
    }
  }

  async function initializeFromParams() {
    if(!browser) return;

    const searchParams = $page.url.searchParams;
    const token0Address = searchParams.get("token0");
    const token1Address = searchParams.get("token1");

    if (token0Address && $formattedTokens) {
        const selectedToken = $formattedTokens.find((t) => t.canister_id === token0Address);
        if (selectedToken && (!token0 || token0.canister_id !== token0Address)) {
            token0 = selectedToken;
        }
    }

    if (token1Address && $formattedTokens) {
        const selectedToken = $formattedTokens.find((t) => t.canister_id === token1Address);
        if (selectedToken && (!token1 || token1.canister_id !== token1Address)) {
            token1 = selectedToken;
        }
    }
  }

  function updateURL() {
    const searchParams = new URLSearchParams();
    if (token0) searchParams.set("token0", token0.canister_id);
    if (token1) searchParams.set("token1", token1.canister_id);
    goto(`?${searchParams.toString()}`, { replaceState: true });
  }

  function handleTokenSelect(index: 0 | 1) {
    // Token selection is now handled in AddLiquidityForm
  }

  async function handleInput(index: 0 | 1, value: string) {
    if (index === 0) {
        amount0 = value;
    } else {
        amount1 = value;
    }
    error = null;
  }

  async function handleSubmit() {
    try {
        console.log("Starting handleSubmit...");
        if (!token0 || !token1 || !amount0 || !amount1) {
            error = "Please fill in all fields";
            return;
        }

        loading = true;
        error = null;

        const params = {
            token_0: token0,
            amount_0: parseTokenAmount(amount0, token0.decimals),
            token_1: token1,
            amount_1: parseTokenAmount(amount1, token1.decimals),
        };

        toastStore.info("Adding liquidity...", 7000);
        const requestId = await PoolService.addLiquidity(params);

        // Start polling
        console.log("Starting polling...");
        pollStatus(requestId, 1);

    } catch (err) {
        console.error("Error adding liquidity:", err);
        toastStore.error(err.message || "Failed to add liquidity", 8000, "Error");
        loading = false;
        error = err.message;
        showConfirmation = false;
    }
  }

  async function pollStatus(requestId: bigint, attempt = 1) {
    try {
        const MAX_ATTEMPTS = 50;
        const status = await PoolService.pollRequestStatus(requestId);
        
        if (status.statuses.includes('Success')) {
            console.log('Success status found, showing toast');
            toastStore.success("Successfully added liquidity to the pool", 5000, "Success");
            await poolStore.loadUserPoolBalances();
            showConfirmation = false;
            loading = false;
            goto("/earn");
        } else if (status.statuses.some(s => 
            s.toLowerCase().includes('failed') || 
            s.toLowerCase().includes('error')
        )) {
            console.log('Error status found, throwing error');
            const errorMsg = status.statuses[status.statuses.length - 1];
            toastStore.error(errorMsg, 8000, "Error");
            showConfirmation = false;
            loading = false;
            throw new Error(errorMsg);
        } else if (attempt >= MAX_ATTEMPTS) {
            console.log('Maximum polling attempts reached');
            toastStore.error(`Operation timed out after ${MAX_ATTEMPTS} attempts`, 8000, "Error");
            showConfirmation = false;
            loading = false;
            throw new Error("Operation timed out");
        } else {
            console.log('Still pending, polling again in .5s');
            return new Promise((resolve) => {
                setTimeout(() => resolve(pollStatus(requestId, attempt + 1)), 400);
            });
        }
    } catch (err) {
        console.error("Error during polling:", err);
        toastStore.error(err.message || "Failed to add liquidity", 8000, "Error");
        showConfirmation = false;
        loading = false;
        throw err;
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
  </div>

  <div class="form-container">
    <AddLiquidityForm
      bind:token0
      bind:token1
      bind:amount0
      bind:amount1
      bind:loading
      bind:error
      bind:showConfirmation
      token0Balance={token0Balance}
      token1Balance={token1Balance}
      onTokenSelect={handleTokenSelect}
      onInput={handleInput}
      onSubmit={handleSubmit}
      pool={pool}
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
