<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  
  export let token0: FE.Token | null;
  export let token1: FE.Token | null;
  export let onPriceChange: (value: string) => void;

  let displayValue = "";

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
</script>

<Panel variant="transparent" className="!p-4">
  <div class="flex flex-col gap-2">
      <label for="initial-price" class="text-sm text-kong-text-primary/70 mb-2 block">
        {#if token0 && token1}
          Initial {token0.symbol}/{token1.symbol} Price
        {:else}
          Initial Price
        {/if}
      </label>
      <div class="relative">
        <input
          type="text"
          id="initial-price"
          placeholder="Enter initial price"
          class="price-input"
          bind:value={displayValue}
          on:input={handleInitialPriceInput}
        />
        <div class="price-example">
          {#if token0 && token1}
            Example: If 1 {token0.symbol} = {token1.symbol} 10, enter "10"
          {/if}
        </div>
      </div>
  </div>
</Panel>

<style scoped lang="postcss">
  .price-input {
    @apply w-full px-4 py-3 rounded-lg;
    @apply bg-gray-800/20 border border-gray-800/20;
    @apply text-kong-text-primary placeholder-kong-text-primary/40;
    @apply focus:outline-none focus:border-kong-accent-blue;
    @apply transition-colors duration-200;
    @apply light:bg-white/60;
  }

  .price-example {
    @apply text-xs text-kong-text-primary/50 mt-1 pl-1;
  }
</style> 