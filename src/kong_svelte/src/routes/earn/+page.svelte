<script lang="ts">
  import { t } from "$lib/services/translations";
  import { writable, derived } from "svelte/store";
  import { poolsList, poolsLoading, poolsError } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolsTable from "$lib/components/liquidity/pools/PoolsTable.svelte";
  import { onMount } from 'svelte';

  // Navigation state
  const activeSection = writable("pools");
  const activeTab = writable("all_pools");
  
  // Sort state (required by PoolsTable)
  const sortColumn = writable("rolling_24h_volume");
  const sortDirection = writable<"asc" | "desc">("desc");

  let isMobile = false;

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Instead of creating our own derived store, use the existing formattedTokens
  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  // Get highest APR from pools
  const highestApr = derived(poolsList, ($pools) => {
    if (!$pools || $pools.length === 0) return 0;
    return Math.max(...$pools.map(pool => Number(pool.rolling_24h_apy)));
  });
</script>

<section class="flex flex-col w-full h-full px-4 pb-4">
  <div class="z-10 flex flex-col w-full h-full max-w-[1300px] mx-auto gap-4">
    <!-- Earn Hub Navigation -->
    <div class="earn-cards {isMobile ? 'mobile-tabs' : ''}">
      <button 
        class="earn-card {$activeSection === 'pools' ? 'active' : ''} {isMobile ? 'mobile-tab' : ''}"
        on:click={() => activeSection.set('pools')}
      >
        <div class="card-content">
          <h3>Pools</h3>
          {#if !isMobile}
            <p>Provide liquidity and earn trading fees</p>
            <div class="apy">Up to {$highestApr.toFixed(2)}% APR</div>
          {/if}
        </div>
      </button>

      <button 
        class="earn-card coming-soon {isMobile ? 'mobile-tab' : ''}"
        disabled
      >
        <div class="card-content">
          <h3>Staking {isMobile ? '•' : ''} <span class="soon-tag-inline">Soon</span></h3>
          {#if !isMobile}
            <p>Lock tokens to earn staking rewards</p>
            <div class="apy">Up to 25% APY</div>
            <div class="soon-tag">Coming Soon</div>
          {/if}
        </div>
      </button>

      <button
        class="earn-card coming-soon {isMobile ? 'mobile-tab' : ''}"
        disabled
      >
        <div class="card-content">
          <h3>Lending {isMobile ? '•' : ''} <span class="soon-tag-inline">Soon</span></h3>
          {#if !isMobile}
            <p>Lend assets and earn interest</p>
            <div class="apy">Up to 12% APY</div>
            <div class="soon-tag">Coming Soon</div>
          {/if}
        </div>
      </button>
    </div>

    {#if $activeSection === "pools"}
      <div class="pools-container">
        <div class="pools-inner">
          <PoolsTable
            pools={$poolsList}
            loading={$poolsLoading}
            error={$poolsError}
            tokenMap={$tokenMap}
            sortColumn={$sortColumn}
            sortDirection={$sortDirection}
          />
        </div>
      </div>
    {/if}
  </div>
</section>

<style lang="postcss">
  .earn-cards {
    @apply grid md:grid-cols-3 gap-4;
  }

  .earn-card {
    @apply relative flex items-start p-4 rounded-lg transition-all duration-200
           bg-[#1a1b23]/60 border border-[#2a2d3d] text-left
           hover:shadow-sm hover:shadow-[#60A5FA]/5 backdrop-blur-sm;
  }

  .earn-card:not(.coming-soon):hover {
    @apply bg-[#1e1f2a]/80 border-[#60A5FA]/30
           shadow-[0_0_10px_rgba(96,165,250,0.1)]
           transform scale-[1.01];
  }

  .earn-card.active {
    @apply bg-gradient-to-b from-[#1e1f2a] to-[#1a1b23]
           border-[#60A5FA]/20
           shadow-[0_0_15px_rgba(96,165,250,0.1)];
  }

  .earn-card.coming-soon {
    @apply cursor-not-allowed opacity-60;
  }

  .card-content {
    @apply flex flex-col gap-1.5;
  }

  .card-content h3 {
    @apply text-lg text-white;
  }

  .card-content p {
    @apply text-[#8890a4] text-sm;
  }

  .apy {
    @apply text-[#60A5FA] font-medium mt-2 text-sm;
  }

  .soon-tag {
    @apply absolute top-3 right-3 bg-[#60A5FA] text-white px-2 py-0.5
           rounded-md text-xs font-medium;
  }

  .earn-card.coming-soon.mobile {
    @apply py-3 px-4;
  }

  .earn-card.coming-soon.mobile .card-content {
    @apply gap-0;
  }

  .soon-tag-inline {
    @apply text-xs text-[#60A5FA] font-medium ml-2;
  }

  @media (max-width: 640px) {
    section {
      @apply px-2 pb-2;
    }
    
    .pools-container {
      height: calc(100vh - 16rem - 64px - 0.5rem); /* Adjusted for mobile + header + padding */
    }
  }

  .pools-container {
    @apply flex-grow rounded-xl overflow-hidden relative;
    background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
    border: 1px solid rgba(96, 165, 250, 0.12);
    box-shadow: 
      0 32px 64px -16px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(96, 165, 250, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(32px);
    height: calc(100vh - 64px - 11.5rem - 1rem);

    /* Premium edge highlight */
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      padding: 1px;
      border-radius: inherit;
      background: linear-gradient(
        135deg,
        rgba(96, 165, 250, 0.08) 0%,
        rgba(96, 165, 250, 0.03) 50%,
        rgba(96, 165, 250, 0.01) 100%
      );
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    /* Inner glow effect */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(
        circle at 50% 0%,
        rgba(96, 165, 250, 0.02) 0%,
        transparent 70%
      );
      pointer-events: none;
    }
  }

  .pools-inner {
    @apply relative h-full p-4 z-[1];
  }

  /* For mobile, use flex instead of grid */
  @media (max-width: 768px) {
    .earn-cards {
      @apply flex flex-row gap-2 overflow-x-auto;
    }

    .earn-card {
      @apply flex-1 min-w-0 py-2 px-3;
    }

    .earn-card .card-content h3 {
      @apply text-sm text-center whitespace-nowrap;
    }

    .soon-tag-inline {
      @apply text-[10px] ml-1;
    }
  }
</style>
