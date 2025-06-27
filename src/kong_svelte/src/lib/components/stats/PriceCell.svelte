<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  export let row: any;
  export let priceFlashStates: Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>;
  export let isHovered = false;
  
  $: price = Number(row.metrics?.price || 0);
  $: formattedPrice = formatUsdValue(price, true);
  $: tooltipContent = `$${price}`;
  $: flashClass = priceFlashStates?.get(row.address)?.class || '';
</script>

<span 
  use:tooltip={{ text: tooltipContent, direction: "bottom" }}
  class="cursor-help price-cell {flashClass} {isHovered ? 'text-kong-primary' : ''}"
>
  {formattedPrice}
</span>

<style scoped>
  .price-cell {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background-color 0.2s;
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
    0% {
      background-color: transparent;
      color: #00cc81;
    }
    15% {
      background-color: rgba(0, 204, 129, 0.25);
      box-shadow: 0 0 10px rgba(0, 204, 129, 0.3);
      color: #00cc81;
    }
    85% {
      background-color: rgba(0, 204, 129, 0.25);
      box-shadow: 0 0 10px rgba(0, 204, 129, 0.3);
      color: #00cc81;
    }
    100% {
      background-color: transparent;
      box-shadow: none;
      color: #00cc81;
    }
  }

  @keyframes flash-red {
    0% {
      background-color: transparent;
      color: #ef4444;
    }
    15% {
      background-color: rgba(239, 68, 68, 0.25);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
    85% {
      background-color: rgba(239, 68, 68, 0.25);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
    100% {
      background-color: transparent;
      box-shadow: none;
      color: #ef4444;
    }
  }
</style>