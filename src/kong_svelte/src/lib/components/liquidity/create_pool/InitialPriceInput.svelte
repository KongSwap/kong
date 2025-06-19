<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { Info, TrendingUp } from "lucide-svelte";
  
  export let token0: Kong.Token | null;
  export let token1: Kong.Token | null;
  export let onPriceChange: (value: string) => void;

  let displayValue = "";
  let isFocused = false;

  function handleInitialPriceInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const value = event.currentTarget.value;
    
    // Allow empty input
    if (!value) {
      displayValue = "";
      onPriceChange("");
      return;
    }

    // Clean the input value
    const cleanValue = value.replace(/[,_]/g, "");
    
    // Allow valid numeric input including decimals
    if (/^\d*\.?\d*$/.test(cleanValue)) {
      displayValue = cleanValue;
      onPriceChange(cleanValue);
    }
  }

  function handleFocus() {
    isFocused = true;
  }

  function handleBlur() {
    isFocused = false;
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center gap-2">
    <TrendingUp class="w-4 h-4 text-kong-warning" />
    <h4 class="text-kong-text-primary font-medium">Initial Price Setting</h4>
  </div>

  <!-- Price Input Card -->
  <Panel variant="solid" type="secondary">
    <div class="space-y-4">
      <!-- Price Label and Input -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label for="initial-price" class="text-sm font-medium text-kong-text-primary">
            {#if token0 && token1}
              Price of {token0.symbol} in {token1.symbol}
            {:else}
              Initial Price
            {/if}
          </label>
          {#if displayValue}
            <span class="text-xs text-kong-success bg-kong-success/10 px-2 py-1 rounded">
              Price Set
            </span>
          {/if}
        </div>
        
        <div class="price-input-container" class:focused={isFocused}>
          <input
            type="text"
            id="initial-price"
            placeholder="0.00"
            class="price-input"
            bind:value={displayValue}
            on:input={handleInitialPriceInput}
            on:focus={handleFocus}
            on:blur={handleBlur}
          />
          {#if token1}
            <div class="price-unit">
              <span class="text-sm text-kong-text-primary/60">{token1.symbol}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Information Box -->
      <div class="info-box">
        <div class="flex items-start gap-2">
          <Info class="w-4 h-4 text-kong-primary/80 mt-0.5 flex-shrink-0" />
          <div class="text-xs text-kong-text-primary/70 space-y-1">
            <p class="font-medium text-kong-text-primary">How to set initial price:</p>
            {#if token0 && token1}
              <p>Enter how many {token1.symbol} tokens equal 1 {token0.symbol} token.</p>
              <p class="text-kong-text-primary/60">
                Example: If 1 {token0.symbol} = 10 {token1.symbol}, enter "10"
              </p>
            {:else}
              <p>Select both tokens to see pricing guidance.</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Price Preview -->
      {#if displayValue && token0 && token1}
        <div class="price-preview">
          <div class="flex items-center justify-between text-sm">
            <span class="text-kong-text-primary/60">Exchange Rate:</span>
            <div class="text-right">
              <div class="text-kong-text-primary font-medium">
                1 {token0.symbol} = {displayValue} {token1.symbol}
              </div>
              <div class="text-xs text-kong-text-primary/50 mt-0.5">
                1 {token1.symbol} = {(1 / parseFloat(displayValue)).toFixed(6)} {token0.symbol}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </Panel>
</div>

<style scoped lang="postcss">
  .price-input-container {
    @apply relative flex items-center;
    @apply bg-kong-bg-secondary/50 border border-kong-border/50;
    @apply rounded-lg transition-all duration-200;
  }

  .price-input-container.focused {
    @apply border-kong-primary/50 bg-kong-bg-secondary/70;
    @apply shadow-sm;
  }

  .price-input {
    @apply flex-1 px-4 py-3 bg-transparent border-none;
    @apply text-lg font-medium text-kong-text-primary placeholder-kong-text-primary/40;
    @apply focus:outline-none;
    @apply transition-colors duration-200;
  }

  .price-unit {
    @apply px-3 py-2 border-l border-kong-border/30;
    @apply bg-kong-bg-secondary/30;
  }

  .info-box {
    @apply p-3 bg-kong-bg-tertiary/30 rounded-lg border border-kong-border/30;
  }

  .price-preview {
    @apply p-3 bg-kong-primary/5 rounded-lg border border-kong-primary/20;
  }
</style> 