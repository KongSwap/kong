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
  class="cursor-help {flashClass} {isHovered ? 'text-kong-primary' : ''}"
>
  {formattedPrice}
</span>

<style scoped>
  .flash-green {
    animation: flash-green 2s ease-out !important;
  }
  .flash-red {
    animation: flash-red 2s ease-out !important;
  }

  @keyframes flash-green {
    0% {
      background: transparent;
    }
    15% {
      background: rgba(0, 204, 129, 0.1);
    }
    85% {
      background: rgba(0, 204, 129, 0.1);
    }
    100% {
      background: transparent;
    }
  }

  @keyframes flash-red {
    0% {
      background: transparent;
    }
    15% {
      background: rgba(209, 27, 27, 0.1);
    }
    85% {
      background: rgba(209, 27, 27, 0.1);
    }
    100% {
      background: transparent;
    }
  }
</style>