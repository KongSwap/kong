<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  export let row: any;
  
  $: price = row.metrics?.price || 0;
  $: formattedPrice = "$" + formatToNonZeroDecimal(price);
  $: tooltipContent = `$${price}`;
</script>

<span 
  use:tooltip={{ text: tooltipContent, position: "top" }}
  class="cursor-help"
>
  {formattedPrice}
</span> 