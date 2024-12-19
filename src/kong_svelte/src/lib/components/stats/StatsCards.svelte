<script lang="ts">
  import { Droplets, DollarSign, BarChart } from "lucide-svelte";
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let volume24h: number;
  export let totalLiquidity: number;
  export let totalFees: number;
  export let isMobile: boolean = false;

  // Create tweened stores for the totals
  const volume24hTweened = tweened(0, {
    duration: 400,
    easing: cubicOut
  });
  const totalLiquidityTweened = tweened(0, {
    duration: 400,
    easing: cubicOut
  });
  const totalFeesTweened = tweened(0, {
    duration: 400,
    easing: cubicOut
  });

  // Previous values to determine animation direction
  let prevVolume = 0;
  let prevLiquidity = 0;
  let prevFees = 0;

  // Animation classes
  let volumeClass = '';
  let liquidityClass = '';
  let feesClass = '';

  // Update function to set animation classes
  function updateWithAnimation(newValue: number, prevValue: number): string {
    if (prevValue === 0 || newValue === prevValue) return '';
    return newValue > prevValue ? 'animate-number-up' : 'animate-number-down';
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

<div class="earn-cards {isMobile ? 'mobile-stats' : ''}">
  <div class="earn-card">
    <div class="card-content">
      <h3>Total Volume (24h)</h3>
      <div class="apy {volumeClass}">
        ${$volume24hTweened.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
    </div>
    <div class="stat-icon-wrapper">
      <BarChart class="stat-icon" color="#60A5FA" />
    </div>
  </div>

  <div class="earn-card">
    <div class="card-content">
      <h3>Total Liquidity</h3>
      <div class="apy {liquidityClass}">
        ${$totalLiquidityTweened.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
    </div>
    <div class="stat-icon-wrapper">
      <Droplets class="stat-icon" color="#60A5FA" />
    </div>
  </div>

  <div class="earn-card">
    <div class="card-content">
      <h3>Total Fees (24h)</h3>
      <div class="apy {feesClass}">
        ${$totalFeesTweened.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
    </div>
    <div class="stat-icon-wrapper">
      <DollarSign class="stat-icon" color="#60A5FA" />
    </div>
  </div>
</div>

<style lang="postcss">
  .earn-cards {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
  }

  .earn-card {
    @apply relative flex items-center justify-between p-6 rounded-xl transition-all duration-200
           bg-gradient-to-br from-[#1E1F2A] to-[#1E1F2A]/95 
           border border-[#2a2d3d]/50 text-left
           hover:bg-gradient-to-br hover:from-[#1E1F2A]/95 hover:to-[#1E1F2A]
           hover:border-primary-blue/30 
           hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]
           backdrop-blur-sm;
           max-height: 110px;

    &:hover .stat-icon-wrapper {
      @apply bg-gradient-to-br from-[#2a2d3d]/80 to-[#2a2d3d]/50;
    }

    &:hover .stat-icon {
      @apply text-primary-blue;
    }
  }

  .card-content {
    @apply flex flex-col gap-1.5;
    min-height: 4rem;
  }

  .card-content h3 {
    @apply text-[#8890a4] text-sm font-medium tracking-wide uppercase;
  }

  .apy {
    @apply text-white font-medium text-2xl;
    text-shadow: 0 2px 10px rgba(255,255,255,0.1);
  }

  .stat-icon-wrapper {
    @apply p-3.5 rounded-xl bg-gradient-to-br from-[#2a2d3d]/70 to-[#2a2d3d]/40
           ring-1 ring-white/5 transition-all duration-200;
  }

  .stat-icon {
    @apply w-5 h-5 text-white/70 transition-colors duration-200;
  }

  /* Number animations */
  @keyframes number-up {
    0% { transform: translateY(20%); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  @keyframes number-down {
    0% { transform: translateY(-20%); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  .animate-number-up {
    animation: number-up 0.3s ease-out forwards;
  }

  .animate-number-down {
    animation: number-down 0.3s ease-out forwards;
  }

  /* Mobile specific styles */
  .mobile-stats {
    @apply grid-cols-1 gap-3;
    
    .earn-card {
      @apply p-4 flex items-center;
      
      .card-content {
        @apply gap-1;
      }

      .card-content h3 {
        @apply text-xs;
      }
      
      .apy {
        @apply text-xl;
      }
      
      .stat-icon-wrapper {
        @apply p-2.5;
      }

      .stat-icon {
        @apply w-4 h-4;
      }
    }
  }
</style> 