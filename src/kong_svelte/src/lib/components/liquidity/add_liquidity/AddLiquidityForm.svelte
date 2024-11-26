<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import Button from "$lib/components/common/Button.svelte";
    import { formatTokenAmount, parseTokenAmount } from "$lib/utils/numberFormatUtils";
    import { get } from "svelte/store";
    import { tokenPrices } from "$lib/services/tokens/tokenStore";
    import Panel from "$lib/components/common/Panel.svelte";
    import Portal from 'svelte-portal';
    import TokenSelectorDropdown from '$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte';
    import SwapPanel from "$lib/components/swap/swap_ui/SwapPanel.svelte";

    export let token0: FE.Token | null = null;
    export let token1: FE.Token | null = null;
    export let amount0: string = "0";
    export let amount1: string = "0";
    export let loading: boolean = false;
    export let error: string | null = null;
    export let token0Balance: string = "0";
    export let token1Balance: string = "0";
    export let onTokenSelect: (index: 0 | 1) => void;
    export let onInput: (index: 0 | 1, value: string) => void;
    export let onSubmit: () => void;

    let showToken0Selector = false;
    let showToken1Selector = false;
    let liquidityMode: 'full' | 'custom' = 'full';

    function handleTokenSelect(index: 0 | 1, canister_id: string) {
      if ((index === 0 && canister_id === token1?.canister_id) || 
          (index === 1 && canister_id === token0?.canister_id)) {
        return;
      }
      onTokenSelect(index);
      if (index === 0) {
        showToken0Selector = false;
      } else {
        showToken1Selector = false;
      }
    }

    function handleInput(index: 0 | 1, event: Event) {
      const input = (event.target as HTMLInputElement).value;
      if (/^\d*\.?\d*$/.test(input) || input === '') {
        onInput(index, input);
      }
    }

    function getUsdValue(amount: string, token: FE.Token | null): string {
      if (!amount || !token) return "0.00";
      const price = get(tokenPrices)[token.canister_id];
      return (price * Number(amount)).toFixed(2);
    }

    $: hasInsufficientBalance = () => {
      if (!token0 || !token1 || !amount0 || !amount1) return false;
      const parsedAmount0 = parseTokenAmount(amount0, token0.decimals) - token0.fee;
      const parsedAmount1 = parseTokenAmount(amount1, token1.decimals) - token1.fee;
      const parsedBalance0 = BigInt(token0Balance);
      const parsedBalance1 = BigInt(token1Balance);
      return parsedAmount0 > parsedBalance0 || parsedAmount1 > parsedBalance1;
    };

    $: isValid = token0 && token1 && amount0 && amount1 && !error && !hasInsufficientBalance();
  </script>

  <div class="swap-wrapper">
    <div class="swap-container" in:fade={{ duration: 420 }}>
      <div class="mode-selector">
        <div class="mode-selector-background" style="transform: translateX({liquidityMode === 'custom' ? '100%' : '0'})"></div>
        <button
          class="mode-button"
          class:selected={liquidityMode === "full"}
          on:click={() => liquidityMode = 'full'}
        >
          <span class="mode-text">Full Range</span>
        </button>
        <button
          class="mode-button"
          class:selected={liquidityMode === "custom"}
          disabled
        >
          <span class="mode-text">Custom Range</span>
        </button>
      </div>

      <div class="panels-container">
        <div class="panels-wrapper">
          <!-- Token 0 Panel -->
          <SwapPanel
            title="Token 1 Amount"
            token={token0}
            amount={amount0}
            onAmountChange={(e) => handleInput(0, e)}
            onTokenSelect={() => showToken0Selector = true}
            showPrice={true}
            disabled={loading}
            panelType="pay"
            balance={token0Balance}
          />

          <div class="flex justify-center">
            <div class="p-2 bg-white/10 rounded-full">
              <Plus class="text-white/70" />
            </div>
          </div>

          <!-- Token 1 Panel -->
          <SwapPanel
            title="Token 2 Amount"
            token={token1}
            amount={amount1}
            onAmountChange={(e) => handleInput(1, e)}
            onTokenSelect={() => showToken1Selector = true}
            showPrice={true}
            disabled={loading}
            panelType="pay"
            balance={token1Balance}
          />
        </div>

        {#if error}
          <div class="error-message mt-4 text-red-500 text-sm">{error}</div>
        {/if}

        <div class="swap-footer">
          <button
            class="swap-button"
            class:error={error || hasInsufficientBalance()}
            class:processing={loading}
            class:ready={isValid}
            on:click={onSubmit}
            disabled={!isValid || loading}
          >
            <div class="button-content">
              {#key buttonText}
                <span class="button-text">
                  {#if hasInsufficientBalance()}
                    Insufficient Balance
                  {:else if !token0 || !token1}
                    Select Tokens
                  {:else if !amount0 || !amount1}
                    Enter Amounts
                  {:else if loading}
                    Loading...
                  {:else}
                    Review Transaction
                  {/if}
                </span>
              {/key}
              {#if loading}
                <div class="loading-spinner"></div>
              {/if}
            </div>
            {#if isValid}
              <div class="button-glow"></div>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Token Selectors -->
  {#if showToken0Selector}
    <Portal target="body">
      <TokenSelectorDropdown
        show={true}
        onSelect={(selectedToken) => handleTokenSelect(0, selectedToken.canister_id)}
        onClose={() => showToken0Selector = false}
        currentToken={token0}
        otherPanelToken={token1}
      />
    </Portal>
  {/if}

  {#if showToken1Selector}
    <Portal target="body">
      <TokenSelectorDropdown
        show={true}
        onSelect={(selectedToken) => handleTokenSelect(1, selectedToken.canister_id)}
        onClose={() => showToken1Selector = false}
        currentToken={token1}
        otherPanelToken={token0}
      />
    </Portal>
  {/if}

  <style lang="postcss">
    .swap-container {
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .mode-selector {
      position: relative;
      display: flex;
      gap: 1px;
      margin-bottom: 12px;
      padding: 2px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .mode-button {
      @apply px-3 py-1.5 text-sm font-medium text-white/70 rounded-lg transition-colors duration-200;
      @apply hover:bg-white/10;
    }

    .mode-button.selected {
      @apply bg-white/10 text-white;
    }

    .mode-button.disabled {
      @apply opacity-50 cursor-not-allowed hover:bg-transparent;
    }

    .panels-container {
      @apply flex flex-col gap-6 w-full h-full overflow-y-auto px-2;
    }

    .panels-wrapper {
      @apply flex flex-col gap-6 w-full h-full overflow-y-auto px-2;
    }

    .error-message {
      @apply text-red-500 text-sm;
    }

    .swap-footer {
      @apply flex justify-center mt-4;
    }

    .swap-button {
      @apply px-3 py-1.5 text-sm font-medium text-white/70 rounded-lg transition-colors duration-200;
      @apply hover:bg-white/10;
    }

    .swap-button.error {
      @apply bg-red-500 text-white;
    }

    .swap-button.processing {
      @apply bg-yellow-500 text-white;
    }

    .swap-button.ready {
      @apply bg-green-500 text-white;
    }

    .button-content {
      @apply flex items-center gap-2;
    }

    .button-text {
      @apply text-white/70 font-semibold tracking-tight;
    }

    .loading-spinner {
      @apply w-4 h-4 border-2 border-white border-transparent rounded-full animate-spin;
    }

    .button-glow {
      @apply w-4 h-4 bg-yellow-500 rounded-full absolute top-0 left-0;
    }

    @media (max-width: 420px) {
      input {
        @apply text-2xl mt-[-0.15rem];
      }
    }
  </style>
