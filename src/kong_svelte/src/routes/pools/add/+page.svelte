<script lang="ts">
  import PageHeader from "$lib/components/common/PageHeader.svelte";
import CreateLiquidityPanel from "$lib/components/liquidity/create_pool/CreateLiquidityPanel.svelte";
  import PoolChart from "$lib/components/liquidity/create_pool/PoolChart.svelte";
import { PlusCircleIcon, Coins, Droplets } from "lucide-svelte";
import { poolStore } from "$lib/services/pools/poolStore";
import { liveTokens } from "$lib/services/tokens/tokenStore";

$: totalPools = $poolStore.pools?.length ?? 0;
$: totalTokens = $liveTokens?.length ?? 0;
</script>



<div class="flex flex-col w-full h-full px-4 pb-4">
  <PageHeader 
  title="Add Liquidity"
  description="Create a new liquidity pool or add liquidity to an existing pool to earn trading fees"
  icon={PlusCircleIcon}
  maxWidth="1200px"
  stats={[
    {
      label: "Total Pools",
      value: totalPools.toString(),
      icon: Droplets
    },
    {
      label: "Total Tokens",
      value: totalTokens.toString(),
      icon: Coins
    }
  ]}
/>
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