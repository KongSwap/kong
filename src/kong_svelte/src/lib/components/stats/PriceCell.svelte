<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  let { row, priceFlashStates, isHovered = false } = $props<{
    row: any;
    priceFlashStates: Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>;
    isHovered?: boolean;
  }>();
  
  let price = $derived(Number(row.metrics?.price || 0));
  let formattedPrice = $derived(formatUsdValue(price, true));
  let tooltipContent = $derived(`$${price}`);
  let flashClass = $derived(priceFlashStates?.get(row.address)?.class || '');
</script>

<span 
  use:tooltip={{ text: tooltipContent, direction: "bottom" }}
  class="cursor-help price-cell {flashClass} {isHovered ? 'text-kong-primary' : ''}"
>
  {formattedPrice}
</span>

<style scoped>
  .price-cell {
    @apply inline-block px-2 py-1 rounded transition-colors;
  }

  .flash-green {
    animation: flash-green 2s ease-out;
    color: #00cc81 !important;
  }
  
  .flash-red {
    animation: flash-red 2s ease-out;
    color: #ef4444 !important;
  }

  @keyframes flash-green {
    0%, 100% {
      background-color: transparent;
      box-shadow: none;
      color: #00cc81;
    }
    15%, 85% {
      background-color: rgba(0, 204, 129, 0.25);
      box-shadow: 0 0 10px rgba(0, 204, 129, 0.3);
      color: #00cc81;
    }
  }

  @keyframes flash-red {
    0%, 100% {
      background-color: transparent;
      box-shadow: none;
      color: #ef4444;
    }
    15%, 85% {
      background-color: rgba(239, 68, 68, 0.25);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
  }
</style>