<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import TokenSelector from "$lib/components/swap/swap_ui/TokenSelectorModal.svelte";
    import TokenSelectorButton from "$lib/components/swap/swap_ui/TokenSelectorButton.svelte";
    import Button from "$lib/components/common/Button.svelte";
    import { formatTokenAmount, parseTokenAmount } from "$lib/utils/numberFormatUtils";
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import { tokenPrices } from "$lib/services/tokens/tokenStore";
  
    export let token0: FE.Token | null = null;
    export let token1: FE.Token | null = null;
    export let amount0: string = "";
    export let amount1: string = "";
    export let loading: boolean = false;
    export let previewMode: boolean = false;
    export let error: string | null = null;
    export let token0Balance: string = "0";
    export let token1Balance: string = "0";
    export let onTokenSelect: (index: 0 | 1) => void;
    export let onInput: (index: 0 | 1, value: string) => void;
    export let onSubmit: () => void;
  
    let showToken0Selector = false;
    let showToken1Selector = false;
    let liquidityMode: 'full' | 'custom' = 'full';
  
    function handleTokenSelect(index: 0 | 1, token: string) {
      if ((index === 0 && token === token1?.canister_id) || 
          (index === 1 && token === token0?.canister_id)) {
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
      const price = tokenPrices.get(token.canister_id);
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
  
  <div class="liquidity-wrapper">
    <div class="liquidity-container" in:fade={{ duration: 420 }}>
      <div class="mode-tabs">
        <button 
          class="mode-tab {liquidityMode === 'full' ? 'active' : ''}"
          on:click={() => liquidityMode = 'full'}
        >
          FULL RANGE
        </button>
        <button 
          class="mode-tab disabled"
          disabled
        >
          CUSTOM RANGE (SOON)
        </button>
      </div>
  
      <div class="tokens-container">
        <!-- Token 0 Input -->
        <div class="token-input">
          <div class="input-wrapper">
            <input
              type="text"
              class="amount-input"
              bind:value={amount0}
              on:input={(e) => handleInput(0, e)}
              placeholder="0"
              disabled={loading}
            />
            <TokenSelectorButton
              token={token0?.symbol || "SELECT"}
              onClick={() => showToken0Selector = true}
              disabled={loading}
            />
          </div>
          <div class="balance-info">
            <span>Available: {token0Balance} {token0?.symbol || ''}</span>
            <span>Value: ${getUsdValue(amount0, token0)}</span>
          </div>
        </div>
  
        <div class="plus-icon">
          <Plus />
        </div>
  
        <!-- Token 1 Input -->
        <div class="token-input">
          <div class="input-wrapper">
            <input
              type="text"
              class="amount-input"
              bind:value={amount1}
              on:input={(e) => handleInput(1, e)}
              placeholder="0"
              disabled={loading}
            />
            <TokenSelectorButton
              token={token1?.symbol || "SELECT"}
              onClick={() => showToken1Selector = true}
              disabled={loading}
            />
          </div>
          <div class="balance-info">
            <span>Available: {token1Balance} {token1?.symbol || ''}</span>
            <span>Value: ${getUsdValue(amount1, token1)}</span>
          </div>
        </div>
      </div>
  
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
  
      <Button
        variant="yellow"
        size="medium"
        disabled={!isValid || loading}
        onClick={onSubmit}
        width="100%"
      >
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
      </Button>
    </div>
  </div>
  
  {#if showToken0Selector}
    <TokenSelector
      show={true}
      onSelect={(token) => handleTokenSelect(0, token)}
      onClose={() => (showToken0Selector = false)}
      currentToken={token1?.canister_id}
    />
  {/if}
  
  {#if showToken1Selector}
    <TokenSelector
      show={true}
      onSelect={(token) => handleTokenSelect(1, token)}
      onClose={() => (showToken1Selector = false)}
      currentToken={token0?.canister_id}
    />
  {/if}
  
  <style lang="postcss">
    .liquidity-wrapper {
      @apply w-full max-w-[480px] mx-auto;
    }
  
    .liquidity-container {
      @apply flex flex-col gap-4;
    }
  
    .mode-tabs {
      @apply flex gap-1;
    }
  
    .mode-tab {
      @apply flex-1 py-2 px-4 text-center text-sm font-medium bg-yellow-400 text-black rounded-lg;
      @apply hover:bg-yellow-300 transition-colors duration-200;
    }
  
    .mode-tab.active {
      @apply bg-yellow-500;
    }
  
    .mode-tab.disabled {
      @apply opacity-50 cursor-not-allowed hover:bg-yellow-400;
    }
  
    .tokens-container {
      @apply flex items-center gap-2;
    }
  
    .token-input {
      @apply flex-1 flex flex-col gap-2;
    }
  
    .input-wrapper {
      @apply flex items-center gap-2 bg-[#1a472a] rounded-lg p-3;
    }
  
    .amount-input {
      @apply flex-1 bg-transparent text-2xl text-white border-none outline-none;
      @apply placeholder:text-white/50;
    }
  
    .plus-icon {
      @apply w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center;
      @apply text-black shrink-0;
    }
  
    .balance-info {
      @apply flex justify-between text-xs text-white/70;
    }
  
    .error-message {
      @apply text-red-500 text-sm text-center;
    }
  
    @media (max-width: 640px) {
      .liquidity-wrapper {
        @apply px-4;
      }
  
      .tokens-container {
        @apply flex-col;
      }
  
      .plus-icon {
        @apply rotate-90;
      }
    }
  </style>
