<script lang="ts">
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { get } from "svelte/store";
  import { PoolService } from "$lib/services/pools/PoolService";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { auth } from "$lib/services/auth";

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
      const pools = await PoolService.fetchPoolsData();
      pool = pools.pools.find(
        p => (p.address_0 === token0?.canister_id && p.address_1 === token1?.canister_id) ||
             (p.address_0 === token1?.canister_id && p.address_1 === token0?.canister_id)
      ) || null;
    } catch (err) {
      console.error('Error fetching pool info:', err);
      pool = null;
    }
  }

  async function initializeFromParams() {
    const searchParams = $page.url.searchParams;
    const token0Address = searchParams.get("token0");
    const token1Address = searchParams.get("token1");

    if (token0Address && $formattedTokens) {
        const selectedToken = $formattedTokens.find((t) => t.canister_id === token0Address);
        if (selectedToken && (!token0 || token0.canister_id !== token0Address)) {
            token0 = {
                canister_id: selectedToken.canister_id,
                name: selectedToken.name,
                symbol: selectedToken.symbol,
                decimals: selectedToken.decimals,
                fee: selectedToken.fee,
                balance: BigInt(selectedToken.balance || '0'),
                total_24h_volume: selectedToken.total_24h_volume,
                logo: selectedToken.logo,
                price: selectedToken.price,
                token: selectedToken.canister_id,
                token_id: parseInt(selectedToken.canister_id) || 0,
                chain: 'ICP',
                icrc1: true,
                icrc2: true,
                icrc3: false,
                on_kong: true,
                pool_symbol: selectedToken.symbol,
                pools: []
            };
        }
    }

    if (token1Address && $formattedTokens) {
        const selectedToken = $formattedTokens.find((t) => t.canister_id === token1Address);
        if (selectedToken && (!token1 || token1.canister_id !== token1Address)) {
            token1 = {
                canister_id: selectedToken.canister_id,
                name: selectedToken.name,
                symbol: selectedToken.symbol,
                decimals: selectedToken.decimals,
                fee: selectedToken.fee,
                balance: BigInt(selectedToken.balance || '0'),
                total_24h_volume: selectedToken.total_24h_volume,
                logo: selectedToken.logo,
                price: selectedToken.price,
                token: selectedToken.canister_id,
                token_id: parseInt(selectedToken.canister_id) || 0,
                chain: 'ICP',
                icrc1: true,
                icrc2: true,
                icrc3: false,
                on_kong: true,
                pool_symbol: selectedToken.symbol,
                pools: []
            };
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

  function handleInput(index: 0 | 1, value: string) {
    if (index === 0) {
      amount0 = value;
      if (pool && value) {
        // Calculate amount1 based on pool ratio
        const parsedAmount0 = Number(parseTokenAmount(value, token0?.decimals || 8));
        const ratio = Number(pool.balance_1) / Number(pool.balance_0);
        const calculatedAmount1 = parsedAmount0 * ratio;
        amount1 = (calculatedAmount1 / Math.pow(10, token1?.decimals || 8)).toString();
      }
    } else {
      amount1 = value;
      if (pool && value) {
        // Calculate amount0 based on pool ratio
        const parsedAmount1 = Number(parseTokenAmount(value, token1?.decimals || 8));
        const ratio = Number(pool.balance_0) / Number(pool.balance_1);
        const calculatedAmount0 = parsedAmount1 * ratio;
        amount0 = (calculatedAmount0 / Math.pow(10, token0?.decimals || 8)).toString();
      }
    }
    error = null;
  }

  async function handleSubmit() {
    try {
        if (!token0 || !token1 || !amount0 || !amount1) {
            error = "Please fill in all fields";
            return;
        }

        loading = true;
        error = null;
        previewMode = true;

        const params = {
            token_0: token0,
            amount_0: parseTokenAmount(amount0, token0.decimals),
            token_1: token1,
            amount_1: parseTokenAmount(amount1, token1.decimals),
        };

        // Let PoolService handle the authentication
        const requestId = await PoolService.addLiquidity(params);
        
        // Poll for status
        const pollStatus = async () => {
            try {
                const status = await PoolService.pollRequestStatus(requestId);
                
                if (status.statuses.includes('Success')) {
                    await poolStore.loadUserPoolBalances();
                    goto("/earn");
                } else if (status.statuses.some(s => 
                    s.toLowerCase().includes('failed') || 
                    s.toLowerCase().includes('error')
                )) {
                    throw new Error(status.statuses[status.statuses.length - 1]);
                } else {
                    // Continue polling
                    setTimeout(pollStatus, 2000);
                }
            } catch (err) {
                throw err;
            }
        };

        await pollStatus();

    } catch (err) {
        console.error("Error adding liquidity:", err);
        error = err.message;
        loading = false;
        previewMode = false;
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
      {token0Balance}
      {token1Balance}
      onTokenSelect={handleTokenSelect}
      onInput={handleInput}
      onSubmit={handleSubmit}
      {previewMode}
      {pool}
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
