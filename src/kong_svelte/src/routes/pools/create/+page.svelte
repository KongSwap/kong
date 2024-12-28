<script lang="ts">
  import CreateLiquidityPanel from "$lib/components/liquidity/create_pool/CreateLiquidityPanel.svelte";
  import PoolChart from "$lib/components/liquidity/create_pool/PoolChart.svelte";
</script>

<div class="flex flex-col w-full h-full px-4 pb-4">
  <div class="z-10 w-full mx-auto max-w-[1200px]">
    <!-- Content Section -->
    <div class="grid grid-cols-12 gap-6 pt-6">
      <div class="col-span-12 lg:col-span-7">
        <CreateLiquidityPanel />
      </div>
      <div class="col-span-12 lg:col-span-5">
        <PoolChart />
      </div>
    </div>
  </div>
</div> 