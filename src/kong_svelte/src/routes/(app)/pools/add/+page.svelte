<script lang="ts">
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import CreateLiquidityPanel from "$lib/components/liquidity/create_pool/CreateLiquidityPanel.svelte";
  import PoolChart from "$lib/components/liquidity/create_pool/PoolChart.svelte";
  import UserPoolBalance from "$lib/components/liquidity/create_pool/UserPoolBalance.svelte";
  import { PlusCircleIcon } from "lucide-svelte";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { auth } from "$lib/stores/auth";

  // Get the selected tokens for pool info
  $: token0 = $liquidityStore.token0;
  $: token1 = $liquidityStore.token1;
  $: isAuthenticated = !!$auth?.account;
</script>

<svelte:head>
  <title>Add Liquidity | Kong</title>
</svelte:head>

<div class="flex flex-col w-full h-full px-4 pb-4">
  <PageHeader
    title="Add Liquidity"
    description="Create a new liquidity pool or add liquidity to an existing pool to earn trading fees"
    icon={PlusCircleIcon}
    maxWidth="1400px"
  />
  <div class="z-10 w-full mx-auto max-w-[1400px]">
    <!-- Content Section - 3 columns on desktop -->
    <div class="grid grid-cols-12 gap-6 md:pt-4">
      <!-- Create Liquidity Panel - spans 4 columns on xl, 7 on lg, full on smaller -->
      <div class="col-span-12 lg:col-span-7 xl:col-span-4">
        <CreateLiquidityPanel />
      </div>
      
      <!-- Pool Chart - spans 4 columns on xl, 5 on lg, full on smaller -->
      <div class="col-span-12 lg:col-span-5 xl:col-span-4">
        <PoolChart />
      </div>
      
      <!-- User Pool Balance - spans 4 columns on xl, hidden on smaller screens -->
      <div class="col-span-12 xl:col-span-4">
        {#if isAuthenticated && token0 && token1}
          <UserPoolBalance {token0} {token1} />
        {:else if !isAuthenticated}
          <div class="bg-kong-bg-secondary border border-kong-border/10 rounded-lg p-6 text-center text-kong-text-primary/70">
            Connect wallet to view your pool positions
          </div>
        {:else}
          <div class="bg-kong-bg-secondary border border-kong-border/10 rounded-lg p-6 text-center text-kong-text-primary/70">
            Select both tokens to view your pool position
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
