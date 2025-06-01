<script lang="ts">
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import CreateLiquidityPanel from "$lib/components/liquidity/create_pool/CreateLiquidityPanel.svelte";
  import PoolChart from "$lib/components/liquidity/create_pool/PoolChart.svelte";
  import { PlusCircle } from "lucide-svelte";
</script>

<svelte:head>
  <title>Add Liquidity | Kong</title>
</svelte:head>

<div class="flex flex-col w-full h-full px-4 pb-4">
  <PageHeader
    title="Add Liquidity"
    description="Create a new liquidity pool or add liquidity to an existing pool to earn trading fees"
    icon={PlusCircle}
    maxWidth="1200px"
  />
  <div class="z-10 w-full mx-auto max-w-[1200px]">
    <!-- Content Section -->
    <div class="grid grid-cols-12 gap-6 md:pt-4">
      <div class="col-span-12 lg:col-span-7">
        <CreateLiquidityPanel />
      </div>
      <div class="col-span-12 lg:col-span-5">
        <PoolChart />
      </div>
    </div>
  </div>
</div>
