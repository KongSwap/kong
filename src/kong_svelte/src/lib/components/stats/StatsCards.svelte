<script lang="ts">
  import { Droplets, DollarSign, BarChart } from "lucide-svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import Panel from "$lib/components/common/Panel.svelte";

  export let volume24h: number;
  export let totalLiquidity: number;
  export let totalFees: number;
  export let isMobile: boolean;
  export let orientation: 'horizontal' | 'vertical' = 'horizontal';

  // Create tweened stores for the totals
  const volume24hTweened = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });
  const totalLiquidityTweened = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });
  const totalFeesTweened = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  // Previous values to determine animation direction
  let prevVolume = 0;
  let prevLiquidity = 0;
  let prevFees = 0;

  // Animation classes
  let volumeClass = "";
  let liquidityClass = "";
  let feesClass = "";

  // Update function to set animation classes
  function updateWithAnimation(newValue: number, prevValue: number): string {
    if (prevValue === 0 || newValue === prevValue) return "";
    return newValue > prevValue ? "animate-number-up" : "animate-number-down";
  }

  // Watch for changes in values
  $: {
    volume24hTweened.set(volume24h);
    volumeClass = updateWithAnimation(volume24h, prevVolume);
    prevVolume = volume24h;

    totalLiquidityTweened.set(totalLiquidity);
    liquidityClass = updateWithAnimation(totalLiquidity, prevLiquidity);
    prevLiquidity = totalLiquidity;

    totalFeesTweened.set(totalFees);
    feesClass = updateWithAnimation(totalFees, prevFees);
    prevFees = totalFees;
  }
</script>

<div class="stats-container {orientation === 'vertical' ? 'vertical' : ''} {isMobile ? 'mobile' : ''}">
  <div class="stat-item">
    <div class="stat-content">
      <BarChart class="stat-icon" size={24} />
      <div class="text-content">
        <div class="stat-header">
          <span>24h Volume</span>
        </div>
        <div class="stat-value {volumeClass}">
          ${$volume24hTweened.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  </div>

  <div class="divider" />

  <div class="stat-item">
    <div class="stat-content">
      <Droplets class="stat-icon" size={24} />
      <div class="text-content">
        <div class="stat-header">
          <span>Total Liquidity</span>
        </div>
        <div class="stat-value {liquidityClass}">
          ${$totalLiquidityTweened.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  </div>

  <div class="divider" />

  <div class="stat-item">
    <div class="stat-content">
      <DollarSign class="stat-icon" size={24} />
      <div class="text-content">
        <div class="stat-header">
          <span>24h Fees</span>
        </div>
        <div class="stat-value {feesClass}">
          ${$totalFeesTweened.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .stats-container {
    @apply flex items-stretch py-4 px-6 border-b border-white/5;

    &.vertical {
      @apply flex-col h-full;

      .stat-item {
        @apply py-3;
      }

      .divider {
        @apply w-full h-px my-1;
      }
    }

    &.mobile {
      @apply px-4 py-3 flex-col gap-2;

      .stat-item {
        @apply py-2;
      }

      .divider {
        @apply w-full h-px my-1;
      }
    }
  }

  .stat-item {
    @apply flex-1 flex items-center justify-center hover:bg-white/[0.02] transition-colors duration-200 
           rounded-lg py-2 px-4 cursor-default;

    &:hover {
      .stat-header {
        @apply text-[#a4abc8];
      }
      .stat-icon {
        @apply text-blue-400;
      }
      .stat-value {
        @apply text-kong-text-primary;
      }
    }
  }

  .stat-content {
    @apply flex items-center gap-3;
  }

  .text-content {
    @apply flex flex-col min-w-0;
  }

  .divider {
    @apply h-8 w-px bg-kong-text-primary/20 mx-3 self-center;
  }

  .stat-header {
    @apply text-[#8890a4] mb-0.5 transition-colors duration-200;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .stat-icon {
    @apply text-blue-400/60 transition-colors duration-200;
  }

  .stat-value {
    @apply text-kong-text-primary/90 text-xl font-medium tracking-wide transition-colors duration-200 truncate;
    text-shadow: 0 2px 10px rgba(255, 255, 255, 0.1);
  }

  /* Number animations */
  @keyframes number-up {
    0% {
      transform: translateY(20%);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes number-down {
    0% {
      transform: translateY(-20%);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .animate-number-up {
    animation: number-up 0.3s ease-out forwards;
  }

  .animate-number-down {
    animation: number-down 0.3s ease-out forwards;
  }
</style>
