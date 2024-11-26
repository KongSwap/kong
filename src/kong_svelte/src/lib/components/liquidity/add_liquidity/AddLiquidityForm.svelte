<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import { formatTokenAmount, parseTokenAmount } from "$lib/utils/numberFormatUtils";
    import { get } from "svelte/store";
    import { tokenPrices } from "$lib/services/tokens/tokenStore";
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
    let isTransitioning = false;
    let previousMode: 'full' | 'custom' = 'full';

    $: buttonText = hasInsufficientBalance()
      ? "Insufficient Balance"
      : !token0 || !token1
      ? "Select Tokens"
      : !amount0 || !amount1
      ? "Enter Amounts"
      : loading
      ? "Loading..."
      : "Review Transaction";

    function handleModeChange(mode: 'full' | 'custom') {
      if (mode === liquidityMode) return;
      previousMode = liquidityMode;
      isTransitioning = true;
      liquidityMode = mode;
      setTimeout(() => {
        isTransitioning = false;
      }, 300);
    }

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

      <div class="mode-selector">
        <div class="mode-selector-content">
          <div class="mode-selector-background" style="transform: translateX({liquidityMode === 'custom' ? '100%' : '0'})"></div>
          <button
            class="mode-button"
            class:selected={liquidityMode === "full"}
            class:transitioning={isTransitioning && previousMode === "custom"}
            on:click={() => handleModeChange('full')}
          >
            Full Range
          </button>
          <button
            class="mode-button"
            class:selected={liquidityMode === "custom"}
            class:transitioning={isTransitioning && previousMode === "full"}
            on:click={() => handleModeChange('custom')}
            disabled
          >
            Custom Range
          </button>
        </div>
      </div>

      <div class="panels-container">
        <div class="panels-wrapper">
          <div class="panel-item">
            <SwapPanel
              title="First Token Amount"
              token={token0}
              amount={amount0}
              onAmountChange={(e) => handleInput(0, e)}
              onTokenSelect={() => showToken0Selector = true}
              showPrice={true}
              disabled={loading}
              panelType="pay"
              balance={token0Balance}
              slippage={0}
            />
          </div>

          <div class="panel-item">
            <SwapPanel
              title="Second Token Amount"
              token={token1}
              amount={amount1}
              onAmountChange={(e) => handleInput(1, e)}
              onTokenSelect={() => showToken1Selector = true}
              showPrice={true}
              disabled={loading}
              panelType="pay"
              balance={token1Balance}
              slippage={0}
            />
          </div>
        </div>

        {#if error}
          <div class="error-message">{error}</div>
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
              <span class="button-text">
                {buttonText}
              </span>
              {#if loading}
                <div class="loading-spinner"></div>
              {/if}
            </div>
          </button>
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
    .mode-selector {
      @apply flex flex-col gap-2 mb-4;
    }

    .mode-selector-content {
      @apply relative flex gap-1 p-0.5 bg-white/[0.06] rounded-lg border border-white/10;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .mode-selector-background {
      @apply absolute top-0.5 left-0.5;
      width: calc(50% - 1px);
      height: calc(100% - 4px);
      background: linear-gradient(135deg, 
        rgba(55, 114, 255, 0.15), 
        rgba(55, 114, 255, 0.2)
      );
      border-radius: 6px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 0;
    }

    .mode-button {
      @apply relative z-[1] flex-1 px-3 py-1.5 border-none rounded-md text-sm font-medium text-white/70;
      @apply bg-transparent cursor-pointer transition-all duration-200;
    }

    .mode-button.selected {
      @apply text-white font-semibold;
    }

    .mode-button:hover:not(.selected) {
      @apply text-white/90;
    }

    .mode-button:disabled {
      @apply opacity-50 cursor-not-allowed hover:text-white/70;
    }

    .panels-container {
      @apply flex flex-col;
    }

    .panel-item {
      @apply bg-white/5 rounded-xl overflow-hidden;
    }

    .error-message {
      @apply text-red-500 text-sm text-center mt-4;
    }

    .swap-footer {
      @apply mt-4;
    }

    .swap-button {
      @apply w-full px-6 py-3 text-base font-semibold rounded-lg transition-all duration-200;
      @apply bg-white/5 text-white/70 hover:bg-white/10;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    .swap-button:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    .swap-button.error {
      @apply bg-red-500/20 text-red-500 hover:bg-red-500/30;
      box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.2);
    }

    .swap-button.processing {
      @apply bg-yellow-500 text-white hover:bg-yellow-600;
    }

    .swap-button.ready {
      @apply bg-green-500 text-white hover:bg-green-600;
    }

    .button-content {
      @apply flex items-center justify-center gap-2;
    }

    .button-text {
      @apply font-semibold;
    }

    .loading-spinner {
      @apply w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin;
    }

    @media (max-width: 420px) {
      .panel-item {
        @apply p-0;
      }
    }
  </style>
