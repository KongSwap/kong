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

  async function initializeFromParams() {
    const searchParams = $page.url.searchParams;
    const token0Address = searchParams.get("token0");
    const token1Address = searchParams.get("token1");

    if (token0Address && $formattedTokens) {
        const selectedToken = $formattedTokens.find((t) => t.canister_id === token0Address);
        if (selectedToken) {
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
        if (selectedToken) {
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

  onMount(async () => {
    try {
      await initializeFromParams();
    } catch (err) {
      console.error("Error initializing:", err);
      error = "Failed to initialize tokens";
    }
  });

  function updateURL() {
    const searchParams = new URLSearchParams($page.url.searchParams);
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

        const parsedAmount0 = parseTokenAmount(amount0, token0.decimals);
        const parsedAmount1 = parseTokenAmount(amount1, token1.decimals);

        const addLiquidityArgs = {
            token_0: token0,
            amount_0: parsedAmount0,
            tx_id_0: null as number[] | undefined,
            token_1: token1,
            amount_1: parsedAmount1,
            tx_id_1: null as number[] | undefined
        };

        const result = await PoolService.addLiquidity(addLiquidityArgs);
        
        type AddLiquidityResult = { Ok?: any, Err?: string };
        const typedResult = result as AddLiquidityResult;
        
        if (typedResult.Ok) {
            await poolStore.loadUserPoolBalances();
            
            amount0 = "0";
            amount1 = "0";
            
            goto("/earn");
        } else if (typedResult.Err) {
            error = typedResult.Err;
        }
    } catch (err) {
        console.error('Error submitting liquidity:', err);
        error = err instanceof Error ? err.message : 'Failed to add liquidity';
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
