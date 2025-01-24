<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  export let row: any;
  export let priceFlashStates: Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>;
  
  $: price = Number(row.metrics?.price || 0);
  $: formattedPrice = "$" + formatToNonZeroDecimal(price);
  $: tooltipContent = `$${price}`;
  $: flashClass = priceFlashStates?.get(row.canister_id)?.class || '';
</script>

<span 
  use:tooltip={{ text: tooltipContent, direction: "bottom" }}
  class="cursor-help {flashClass} transition-colors duration-200"
>
  {formattedPrice}
</span>

<style>
  .flash-green {
    color: var(--kong-accent-green);
  }
  .flash-red {
    color: var(--kong-accent-red);
  }
</style>