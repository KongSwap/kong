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
    import Panel from "$lib/components/common/Panel.svelte";

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

  <div class="add-liquidity-form">
    <div class="flex flex-col gap-4">
      <div class="mode-tabs">
        <button 
          class="mode-tab {liquidityMode === 'full' ? 'active' : ''}"
          on:click={() => liquidityMode = 'full'}
        >
          Full Range
        </button>
        <button 
          class="mode-tab disabled"
          disabled
        >
          Custom Range
        </button>
      </div>

      <!-- Token 0 Input -->
      <div class="token-input-container">
        <div class="relative flex-grow mb-[-1px] h-[68px]">
          <div class="flex items-center gap-1 h-[69%] box-border rounded-md">
            <div class="relative flex-1">
              <input
                type="text"
                inputmode="decimal"
                pattern="[0-9]*"
                class="flex-1 min-w-0 bg-transparent border-none text-white text-[2.5rem] font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-white disabled:text-white/65 placeholder:text-white/65"
                bind:value={amount0}
                on:input={(e) => handleInput(0, e)}
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div class="flex gap-2 items-center">
              <TokenSelectorButton
                token={token0}
                onClick={() => showToken0Selector = true}
                disabled={loading}
              />
            </div>
          </div>
        </div>
        <footer class="text-white text-[clamp(0.75rem,2vw,0.875rem)]">
          <div class="flex justify-between items-center leading-6">
            <div class="flex items-center gap-2">
              <span class="text-white/50 font-normal tracking-wide">Available:</span>
              <button class="pl-1 text-white/70 font-semibold tracking-tight clickable">
                {token0Balance} {token0?.symbol || ''}
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/50 font-normal tracking-wide">Est Value</span>
              <span class="pl-1 text-white/50 font-medium tracking-wide">
                ${getUsdValue(amount0, token0)}
              </span>
            </div>
          </div>
        </footer>
      </div>

      <div class="flex justify-center">
        <div class="p-2 bg-white/10 rounded-full">
          <Plus class="text-white/70" />
        </div>
      </div>

      <!-- Token 1 Input -->
      <div class="token-input-container">
        <div class="relative flex-grow mb-[-1px] h-[68px]">
          <div class="flex items-center gap-1 h-[69%] box-border rounded-md">
            <div class="relative flex-1">
              <input
                type="text"
                inputmode="decimal"
                pattern="[0-9]*"
                class="flex-1 min-w-0 bg-transparent border-none text-white text-[2.5rem] font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-white disabled:text-white/65 placeholder:text-white/65"
                bind:value={amount1}
                on:input={(e) => handleInput(1, e)}
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div class="flex gap-2 items-center">
              <TokenSelectorButton
                token={token1}
                onClick={() => showToken1Selector = true}
                disabled={loading}
              />
            </div>
          </div>
        </div>
        <footer class="text-white text-[clamp(0.75rem,2vw,0.875rem)]">
          <div class="flex justify-between items-center leading-6">
            <div class="flex items-center gap-2">
              <span class="text-white/50 font-normal tracking-wide">Available:</span>
              <button class="pl-1 text-white/70 font-semibold tracking-tight clickable">
                {token1Balance} {token1?.symbol || ''}
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/50 font-normal tracking-wide">Est Value</span>
              <span class="pl-1 text-white/50 font-medium tracking-wide">
                ${getUsdValue(amount1, token1)}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>

    {#if error}
      <div class="error-message mt-4 text-red-500 text-sm">{error}</div>
    {/if}

    <div class="mt-4">
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
    .add-liquidity-form {
      @apply flex flex-col gap-6 w-full h-full overflow-y-auto px-2;
    }

    .mode-tabs {
      @apply flex gap-1 items-center justify-center;
    }

    .mode-tab {
      @apply px-3 py-1.5 text-sm font-medium text-white/70 rounded-lg transition-colors duration-200;
      @apply hover:bg-white/10;
    }

    .mode-tab.active {
      @apply bg-white/10 text-white;
    }

    .mode-tab.disabled {
      @apply opacity-50 cursor-not-allowed hover:bg-transparent;
    }

    .token-input-container {
      @apply bg-white/5 rounded-lg p-4;
    }

    .clickable:hover {
      @apply text-yellow-500 cursor-pointer;
    }

    @media (max-width: 420px) {
      input {
        @apply text-2xl mt-[-0.15rem];
      }
    }
  </style>
