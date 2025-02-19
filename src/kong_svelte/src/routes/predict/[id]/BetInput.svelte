<script lang="ts">
  export let betAmount: number;
  export let quickAmounts: number[] = [10, 50, 100, 500];

  const handleQuickAmount = (amount: number) => {
    betAmount = amount;
  };
</script>

<div class="flex flex-col gap-2">
  <div class="relative">
    <div class="absolute inset-y-0 left-2 flex items-center pointer-events-none">
      <span class="text-kong-text-secondary text-sm">KONG</span>
    </div>
    <input
      type="number"
      bind:value={betAmount}
      min="0"
      step="0.1"
      aria-label="Enter KONG amount"
      class="w-full pl-14 pr-3 py-2 bg-kong-bg-light rounded border border-kong-border focus:border-kong-accent-green focus:ring-1 focus:ring-kong-accent-green transition-all font-medium text-right text-sm"
      placeholder="0.00"
    />
  </div>
  <div class="grid grid-cols-4 gap-1.5">
    {#each quickAmounts as quickAmount}
      <button
        aria-label={`Set bet amount to ${quickAmount} KONG`}
        class="px-2 py-1.5 bg-kong-bg-light hover:bg-kong-bg-dark text-xs rounded transition-all border border-kong-border hover:border-kong-accent-green/50 font-medium group"
        on:click={() => handleQuickAmount(quickAmount)}
      >
        <span class="text-kong-text-secondary group-hover:text-kong-text-accent-green transition-colors">{quickAmount}</span>
      </button>
    {/each}
  </div>
</div> 