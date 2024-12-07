<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import EarnCard from "$lib/components/earn/EarnCard.svelte";
  import PoolsTable from "$lib/components/earn/PoolsTable.svelte";
  import { poolsList } from "$lib/services/pools/poolStore";

  let isMobile = $state(false);
  let activeSection = $state("pools");

  // Calculate highest APR
  const highestApr = $derived(() => {
    if (!$poolsList || $poolsList.length === 0) return 0;
    return Math.max(...$poolsList.map((pool) => Number(pool.rolling_24h_apy)));
  });

  function handleResize() {
    isMobile = window.innerWidth <= 768;
  }

  onMount(() => {
    if (browser) {
      handleResize();
      window.addEventListener("resize", handleResize);
    }

    return () => {
      if (browser) {
        window.removeEventListener("resize", handleResize);
      }
    };
  });
</script>

<div class="earn-container">
  <div class="flex flex-col md:flex-row gap-4">
    <EarnCard
      title="Pools"
      description="Provide liquidity and earn trading fees"
      isActive={activeSection === "pools"}
      metric={`Up to ${highestApr().toFixed(2)}%`}
      metricLabel="APR"
      on:click={() => (activeSection = "pools")}
    />

    <EarnCard
      title="Staking"
      description="Lock tokens to earn staking rewards"
      isComingSoon={true}
    />

    <EarnCard
      title="Lending"
      description="Lend assets and earn interest"
      isComingSoon={true}
    />
  </div>
  <PoolsTable {isMobile} />
</div>

<style>
  .earn-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 1rem;
  }

  .earn-header {
    margin-bottom: 2rem;
  }

  .earn-header h1 {
    font-size: 2rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.5rem;
  }

  .earn-header p {
    color: #8890a4;
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    .earn-container {
      padding: 1rem;
    }

    .earn-header {
      margin-bottom: 1.5rem;
    }

    .earn-header h1 {
      font-size: 1.5rem;
    }
  }
</style>
