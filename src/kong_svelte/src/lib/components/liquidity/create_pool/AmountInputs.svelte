<script lang="ts">
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { handleFormattedNumberInput } from "$lib/utils/formUtils";
  import Panel from "$lib/components/common/Panel.svelte";

  export let token0: FE.Token | null;
  export let token1: FE.Token | null;
  export let amount0: string;
  export let amount1: string;
  export let token0Balance: string;
  export let token1Balance: string;
  export let onAmountChange: (index: 0 | 1, value: string) => void;
  export let onPercentageClick: (percentage: number) => void;

  let input0Element: HTMLInputElement;
  let input1Element: HTMLInputElement;
  let displayValue0 = "";
  let displayValue1 = "";

  function handleFormattedInput(index: 0 | 1, event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;

    const result = handleFormattedNumberInput(
      input.value,
      cursorPosition,
      index === 0 ? displayValue0 : displayValue1,
    );

    if (index === 0) {
      displayValue0 = result.formattedValue;
      onAmountChange(0, result.rawValue);
    } else {
      displayValue1 = result.formattedValue;
      onAmountChange(1, result.rawValue);
    }

    input.value = result.formattedValue;
    requestAnimationFrame(() => {
      input.setSelectionRange(
        result.newCursorPosition,
        result.newCursorPosition,
      );
    });
  }

  // Update these reactive statements to also update the input values directly
  $: {
    displayValue0 = amount0;
    if (input0Element) {
      input0Element.value = amount0;
    }
  }

  $: {
    displayValue1 = amount1;
    if (input1Element) {
      input1Element.value = amount1;
    }
  }
</script>

<Panel variant="transparent" className="!p-4">
  <div class="flex flex-col gap-4">
    <div class="token-input-container">
      <!-- Token 0 Input -->
      <div class="relative flex-grow mb-2">
        <div class="input-with-token">
          {#if token0}
            <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
          {/if}
          <input
            bind:this={input0Element}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0"
            class="amount-input"
            value={displayValue0}
            on:input={(e) => handleFormattedInput(0, e)}
            disabled={!token0}
          />
        </div>
      </div>
      <div class="balance-info">
        <span class="text-kong-text-primary/50">
          Available: {token0 ? formatBalance(token0Balance, token0.decimals) : "0.00"}
          {token0?.symbol || ""}
        </span>
        <div class="percentage-buttons">
          {#if token0 && parseFloat(token0Balance) > 0}
            <button on:click={() => onPercentageClick(25)}>25%</button>
            <button on:click={() => onPercentageClick(50)}>50%</button>
            <button on:click={() => onPercentageClick(75)}>75%</button>
            <button on:click={() => onPercentageClick(100)}>MAX</button>
          {:else}
            <button disabled>25%</button>
            <button disabled>50%</button>
            <button disabled>75%</button>
            <button disabled>MAX</button>
          {/if}
        </div>
      </div>
    </div>

    <div class="token-input-container">
      <!-- Token 1 Input -->
      <div class="relative flex-grow mb-2">
        <div class="input-with-token">
          {#if token1}
            <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
          {/if}
          <input
            bind:this={input1Element}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0"
            class="amount-input"
            value={displayValue1}
            on:input={(e) => handleFormattedInput(1, e)}
            disabled={true}
          />
        </div>
      </div>
      <div class="balance-info">
        <span class="text-kong-text-primary/50">
          Available: {token1 ? formatBalance(token1Balance, token1.decimals) : "0.00"}
          {token1?.symbol || ""}
        </span>
      </div>
    </div>
  </div>
</Panel>

<style scoped lang="postcss">
  .token-input-container {
    @apply bg-white/[0.02] rounded-xl p-3;
    @apply border border-white/[0.04] backdrop-blur-md;
    @apply transition-all duration-200;
    @apply hover:border-white/[0.06] hover:bg-white/[0.03];
  }

  .amount-input {
    @apply w-full min-w-0 bg-transparent border-none;
    @apply text-[clamp(1.5rem,4vw,2.5rem)] font-medium tracking-tight;
    @apply relative z-10 p-0;
    @apply opacity-100 focus:outline-none focus:text-kong-text-primary;
    @apply disabled:text-kong-text-primary/70 placeholder:text-kong-text-primary/30;
  }

  .balance-info {
    @apply flex flex-wrap justify-between mt-2 gap-2;
    @apply text-[clamp(0.75rem,2vw,0.875rem)] text-kong-text-primary/50;
  }

  .input-with-token {
    @apply flex items-center gap-3;
  }

  .token-logo {
    @apply w-6 h-6 rounded-full bg-black/20 object-contain flex-shrink-0;
    @apply border border-white/[0.03];
  }

  .percentage-buttons {
    @apply flex flex-wrap gap-1;
  }

  .percentage-buttons button {
    @apply px-1.5 py-0.5 text-xs rounded-md bg-white/[0.03] text-kong-text-primary/70
           hover:bg-white/[0.06] hover:text-kong-text-primary transition-all duration-200
           disabled:opacity-40 disabled:hover:bg-white/[0.03] disabled:hover:text-kong-text-primary/70;
    @apply border border-white/[0.04];
  }
</style> 