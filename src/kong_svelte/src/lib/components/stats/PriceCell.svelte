<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  export let row: any;
  export let priceFlashStates: Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>;
  
  $: price = Number(row.metrics?.price || 0);
  $: formattedPrice = formatUsdValue(price, true);
  $: tooltipContent = `$${price}`;
  $: flashClass = priceFlashStates?.get(row.canister_id)?.class || '';
</script>

<span 
  use:tooltip={{ text: tooltipContent, direction: "bottom" }}
  class="cursor-help {flashClass} transition-colors duration-200"
>
  {formattedPrice}
</span>

<style scoped>
  .flash-green {
    color: var(--kong-accent-green);
  }
  .flash-red {
    color: var(--kong-accent-red);
  }
</style>