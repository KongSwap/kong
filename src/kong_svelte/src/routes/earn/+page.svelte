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

<section class="flex flex-col w-full px-4">
  <div class="z-10 flex flex-col w-full max-w-[1300px] mx-auto gap-4">
    <!-- Earn Hub Navigation -->
    <div class="earn-cards">
      <button 
        class="earn-card {$activeSection === 'pools' ? 'active' : ''}"
        on:click={() => activeSection.set('pools')}
      >
        <div class="card-content">
          <h3>Liquidity Pools</h3>
          <p>Provide liquidity and earn trading fees</p>
          <div class="apy">Up to {$highestApr.toFixed(2)}% APR</div>
        </div>
      </button>

      {#if !isMobile}
        <button 
          class="earn-card coming-soon"
          disabled
        >
          <div class="card-content">
            <h3>Staking</h3>
            <p>Lock tokens to earn staking rewards</p>
            <div class="apy">Up to 25% APY</div>
            <div class="soon-tag">Coming Soon</div>
          </div>
        </button>

        <button
          class="earn-card coming-soon"
          disabled
        >
          <div class="card-content">
            <h3>Lending</h3>
            <p>Lend assets and earn interest</p>
            <div class="apy">Up to 12% APY</div>
            <div class="soon-tag">Coming Soon</div>
          </div>
        </button>
      {:else}
        <button 
          class="earn-card coming-soon mobile"
          disabled
        >
          <div class="card-content">
            <h3>Staking <span class="soon-tag-inline">Coming Soon</span></h3>
          </div>
        </button>

        <button 
          class="earn-card coming-soon mobile"
          disabled
        >
          <div class="card-content">
            <h3>Lending <span class="soon-tag-inline">Coming Soon</span></h3>
          </div>
        </button>
      {/if}
    </div>

    {#if $activeSection === "pools"}
      <div class="pools-container">
        <PoolsTable
          pools={$poolsList}
          loading={$poolsLoading}
          error={$poolsError}
          tokenMap={$tokenMap}
          sortColumn={$sortColumn}
          sortDirection={$sortDirection}
        />
      </div>
    {/if}
  </div>
</section>

<style lang="postcss">
  .earn-cards {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
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
      @apply px-2;
    }
    
    .pools-container {
      height: calc(100vh - 16rem - 64px); /* Adjusted for mobile + header */
    }
  }

  .pools-container {
    @apply flex-grow rounded-lg overflow-hidden
           border border-[#2a2d3d]/30 relative;
    height: calc(100vh - 64px - 11.5rem);
    background: linear-gradient(
      165deg,
      rgba(26, 27, 35, 0.8) 0%,
      rgba(26, 27, 35, 0.95) 50%,
      rgba(26, 27, 35, 0.9) 100%
    );
    backdrop-filter: blur(20px);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(96, 165, 250, 0.05);

    /* Add subtle animated gradient border */
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      padding: 1px;
      border-radius: 12px;
      background: linear-gradient(
        120deg,
        rgba(96, 165, 250, 0.1),
        rgba(96, 165, 250, 0.05) 45%,
        rgba(96, 165, 250, 0.1) 50%,
        rgba(96, 165, 250, 0.05)
      );
      -webkit-mask: 
        linear-gradient(#fff 0 0) content-box, 
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    /* Add subtle gradient overlay */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        120deg,
        transparent,
        rgba(96, 165, 250, 0.03) 25%,
        rgba(96, 165, 250, 0.01)
      );
      pointer-events: none;
    }
  }
</style>
