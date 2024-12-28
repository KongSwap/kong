<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TokenSelectionPanel from "./TokenSelectionPanel.svelte";
  import AmountInputs from "./AmountInputs.svelte";
  import InitialPriceInput from "./InitialPriceInput.svelte";
  import PoolWarning from "./PoolWarning.svelte";
  import { liquidityStore } from "$lib/services/liquidity/liquidityStore";
  import { tokenStore, loadBalances, liveTokens } from "$lib/services/tokens/tokenStore";
  import { calculateAmount1FromPrice, validateTokenSelect, updateQueryParams, getDefaultToken, doesPoolExist } from "$lib/utils/poolCreationUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { page } from '$app/stores';
  import { auth } from "$lib/services/auth";
  import { livePools } from "$lib/services/pools/poolStore";
  import { onDestroy, onMount } from "svelte";
  import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { PoolService } from "$lib/services/pools/PoolService";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import ConfirmLiquidityModal from "$lib/components/liquidity/modals/ConfirmLiquidityModal.svelte";
  import PositionDisplay from "$lib/components/liquidity/create_pool/PositionDisplay.svelte";

  const ALLOWED_TOKEN_SYMBOLS = ["ICP", "ckUSDT"];
  const DEFAULT_TOKEN = "ICP";
  const SECONDARY_TOKEN_IDS = [ICP_CANISTER_ID, CKUSDT_CANISTER_ID];

  let token0: FE.Token | null = null;
  let token1: FE.Token | null = null;
  let poolExists: boolean | null = null;
  let userBalance: FE.UserPoolBalance | undefined;

  // Initial token loading
  $: if ($liveTokens.length > 0) {
    const urlToken0 = $page.url.searchParams.get('token0');
    const urlToken1 = $page.url.searchParams.get('token1');
    
    // Only set tokens if they're not already set
    if (!$liquidityStore.token0) {
      const token0FromUrl = urlToken0 ? $liveTokens.find(token => token.canister_id === urlToken0) : null;
      const defaultToken0 = $liveTokens.find(token => token.canister_id === ICP_CANISTER_ID);
      liquidityStore.setToken(0, token0FromUrl || defaultToken0 || null);
    }
    
    if (!$liquidityStore.token1) {
      const token1FromUrl = urlToken1 ? $liveTokens.find(token => token.canister_id === urlToken1) : null;
      const defaultToken1 = $liveTokens.find(token => token.canister_id === CKUSDT_CANISTER_ID);
      liquidityStore.setToken(1, token1FromUrl || defaultToken1 || null);
    }
  }

  // Token updates
  $: {
    token0 = $liquidityStore.token0;
    token1 = $liquidityStore.token1;
    // Only load balances if both tokens are set and valid
    if (token0?.canister_id && token1?.canister_id) {
      loadBalances(
        auth.pnp.account?.owner?.toString(),
        { tokens: [token0, token1], forceRefresh: false }
      );
    }
  }
  $: poolExists = token0 && token1 ? doesPoolExist(token0, token1, $livePools) : null;
  $: token0Balance = $tokenStore.balances[token0?.canister_id]?.in_tokens?.toString() || "0";
  $: token1Balance = $tokenStore.balances[token1?.canister_id]?.in_tokens?.toString() || "0";

  // Add this reactive statement
  $: if (token0?.canister_id || token1?.canister_id) {
    updateQueryParams(token0?.canister_id, token1?.canister_id);
  }

  function handleTokenSelect(index: 0 | 1, token: FE.Token) {
    const otherToken = index === 0 ? token1 : token0;
    const result = validateTokenSelect(
      token,
      otherToken,
      ALLOWED_TOKEN_SYMBOLS,
      DEFAULT_TOKEN,
      $liveTokens
    );

    if (!result.isValid) {
      toastStore.error(result.error);
      if (index === 0) {
        token0 = result.newToken;
      } else {
        token1 = result.newToken;
      }
      return;
    }

    if (index === 0) {
      liquidityStore.setToken(0, result.newToken);
    } else {
      liquidityStore.setToken(1, result.newToken);
    }
  }

  function handlePriceChange(value: string) {
    if (poolExists === false) {
      liquidityStore.setInitialPrice(value);
      liquidityStore.setAmount(1, calculateAmount1FromPrice($liquidityStore.amount0, value));
    } else {
      // TODO: Add liquidity
    }
  }

  async function handleAmountChange(index: 0 | 1, value: string) {
    if (poolExists === false && index === 0) {
      liquidityStore.setAmount(index, value);
      const amount1 = calculateAmount1FromPrice(value, $liquidityStore.initialPrice);
      liquidityStore.setAmount(1, amount1);
    } else if (poolExists === true && index === 0) {
      // For existing pools, calculate the other amount based on pool ratio
      liquidityStore.setAmount(0, value);
      try {
        if (!token0 || !token1) return;
        
        const amount0 = parseTokenAmount(value, token0.decimals);
        if (!amount0) return;

        const result = await PoolService.calculateLiquidityAmounts(
          token0.symbol,
          amount0,
          token1.symbol
        );

        if (result.Ok) {
          // Convert the BigInt amount to display format
          const amount1Display = (Number(result.Ok.amount_1) / Math.pow(10, token1.decimals)).toString();
          liquidityStore.setAmount(1, amount1Display);
        }
      } catch (error) {
        console.error("Error calculating liquidity amounts:", error);
        toastStore.error("Failed to calculate amounts");
      }
    } else {
      liquidityStore.setAmount(index, value);
    }
  }

  let showConfirmModal = false;

  async function handleCreatePool() {
    if (!token0 || !token1) return;

    try {
      const amount0 = parseTokenAmount($liquidityStore.amount0, token0.decimals);
      const amount1 = parseTokenAmount($liquidityStore.amount1, token1.decimals);

      if (!amount0 || !amount1) {
        throw new Error("Invalid amounts");
      }

      showConfirmModal = true;
    } catch (error) {
      console.error("Error creating pool:", error);
      toastStore.error(error.message || "Failed to create pool");
    }
  }

  async function handleAddLiquidity() {
    if (!token0 || !token1) return;

    try {
      const amount0 = parseTokenAmount($liquidityStore.amount0, token0.decimals);
      if (!amount0) {
        throw new Error("Invalid amount for " + token0.symbol);
      }

      const result = await PoolService.calculateLiquidityAmounts(
        token0.symbol,
        amount0,
        token1.symbol
      );

      if (!result.Ok) {
        throw new Error("Failed to calculate liquidity amounts");
      }

      // Update store with calculated amount
      liquidityStore.setAmount(1, (Number(result.Ok.amount_1) / Math.pow(10, token1.decimals)).toString());
      showConfirmModal = true;
    } catch (error) {
      console.error("Error adding liquidity:", error);
      toastStore.error(error.message || "Failed to add liquidity");
    }
  }

  function handlePercentageClick(percentage: number) {
    if (!token0 || !token0Balance) return;
    
    try {
      const balance = parseFloat(token0Balance) / Math.pow(10, token0.decimals);
      if (isNaN(balance) || balance <= 0) return;

      // If it's 100% (MAX), subtract both the token fee and transaction fee
      const adjustedBalance = percentage === 100 
        ? balance - (token0.fee)
        : (balance * percentage) / 100;
      
      // Format to avoid excessive decimals (use token's decimal places)
      const formattedAmount = adjustedBalance.toFixed(token0.decimals);
      
      handleAmountChange(0, formattedAmount);
    } catch (error) {
      console.error("Error calculating percentage amount:", error);
      toastStore.error("Failed to calculate amount");
    }
  }

  async function fetchUserBalance() {
    try {
      if ($liquidityStore.token0 && $liquidityStore.token1 && $auth.isConnected) {
        const response: any = await PoolService.fetchUserPoolBalances();        
        const balances: any = response.Ok;
        
        if (balances?.length) {
          userBalance = balances.find(
            b => 
              (b.LP?.symbol_0 === $liquidityStore.token0?.symbol && 
               b.LP?.symbol_1 === $liquidityStore.token1?.symbol)
          )?.LP;
        } else {
          userBalance = undefined;
        }
      }
    } catch (error) {
      console.error("Error fetching user balance:", error);
      userBalance = undefined;
    }
  }

  // Watch for token changes to update balance
  $: if ($liquidityStore.token0 && $liquidityStore.token1) {
    fetchUserBalance();
  }

  onMount(() => {
    if ($liquidityStore.token0 && $liquidityStore.token1) {
      fetchUserBalance();
    }
  });

  onDestroy(() => {
    // Only reset amounts on destroy, keep the tokens
    liquidityStore.resetAmounts();
  });
</script>

<Panel variant="transparent" width="auto" className="!p-0">
  <div class="flex flex-col min-h-[165px] box-border relative rounded-lg">
    <div class="relative space-y-6 p-4">
      <div class="mb-2">
        <h3 class="text-kong-text-primary/90 text-sm font-medium mb-2">Select Tokens</h3>
        <TokenSelectionPanel
          {token0}
          {token1}
          onTokenSelect={handleTokenSelect}
          secondaryTokenIds={SECONDARY_TOKEN_IDS}
        />
      </div>
      
      {#if token0 && token1}
        <PositionDisplay
          balance={userBalance?.balance}
          amount0={userBalance?.amount_0}
          amount1={userBalance?.amount_1}
          symbol0={userBalance?.symbol_0}
          symbol1={userBalance?.symbol_1}
          token0={$liquidityStore.token0}
          token1={$liquidityStore.token1}
          layout="horizontal"
        />
      {/if}
      
      {#if token0 && token1 && poolExists === false}
        <div class="flex flex-col gap-4">
          <PoolWarning {token0} {token1} />
          <div>
            <h3 class="text-kong-text-primary/90 text-sm font-medium mb-2">Set Initial Price</h3>
            <InitialPriceInput 
              {token0}
              {token1}
              onPriceChange={handlePriceChange}
            />
          </div>
        </div>
      {/if}
      
      <div class="mt-2">
        <h3 class="text-kong-text-primary/90 text-sm font-medium mb-2">
          {#if poolExists === false}
            Initial Deposits
          {:else}
            Deposit Amounts
          {/if}
        </h3>
        <AmountInputs
          {token0}
          {token1}
          amount0={$liquidityStore.amount0}
          amount1={$liquidityStore.amount1}
          token0Balance={token0Balance}
          token1Balance={token1Balance}
          onAmountChange={(index, value) => handleAmountChange(index, value)}
          onPercentageClick={handlePercentageClick}
        />
      </div>

      {#if token0 && token1 && poolExists === false}
      <div class="mt-6">
        <ButtonV2 
          variant="solid"
          theme="accent-green"
          size="lg"
          fullWidth={true}
          on:click={handleCreatePool}
          isDisabled={!$liquidityStore.amount0 || !$liquidityStore.amount1 || !$liquidityStore.initialPrice}
        >
          Create Pool
        </ButtonV2>
      </div>
      {:else if token0 && token1 && poolExists === true}
        <div class="mt-6">
          <ButtonV2 
            variant="solid"
            theme="accent-green"
            size="lg"
            fullWidth={true}
            on:click={handleAddLiquidity}
            isDisabled={!$liquidityStore.amount0 || !$liquidityStore.amount1}
          >
            Add Liquidity
          </ButtonV2>
        </div>
      {:else}
        <div class="text-center text-kong-text-primary/70 py-8">
          Select both tokens to create a new liquidity pool
        </div>
      {/if}
    </div>
  </div>
</Panel>

{#if showConfirmModal}
  <ConfirmLiquidityModal
    isCreatingPool={poolExists === false}
    show={showConfirmModal}
    onClose={() => {
      liquidityStore.resetAmounts();
      showConfirmModal = false;
    }}
  />
{/if} 