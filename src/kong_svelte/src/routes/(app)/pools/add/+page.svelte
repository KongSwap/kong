<script lang="ts">
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import CreateLiquidityPanel from "$lib/components/liquidity/create_pool/CreateLiquidityPanel.svelte";
  import PoolChart from "$lib/components/liquidity/create_pool/PoolChart.svelte";
  import UserPoolBalance from "$lib/components/liquidity/create_pool/UserPoolBalance.svelte";
  import Card from "$lib/components/common/Card.svelte";
  import { 
    Info, 
    TrendingUp, 
    DollarSign, 
    Wallet
  } from "lucide-svelte";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { auth } from "$lib/stores/auth";
  import { fade, fly } from "svelte/transition";

  // Get the selected tokens for pool info
  $: token0 = $liquidityStore.token0;
  $: token1 = $liquidityStore.token1;
  $: isAuthenticated = !!$auth?.account;
  $: hasSelectedTokens = token0 && token1;
</script>

<svelte:head>
  <title>Add Liquidity | Kong</title>
</svelte:head>

<div class="flex flex-col w-full h-full min-h-screen bg-kong-bg-primary !max-w-5xl mx-auto">
  <!-- Main Content and Sections -->
  <div class="w-full mx-auto max-w-[1600px] pb-6">
        <!-- How it works Section -->
        <div class="mb-4">
          <Card className="!p-6">
            <div class="max-w-4xl">
              <h3 class="text-lg font-medium text-kong-text-primary mb-4 flex items-center gap-2">
                <Info class="w-5 h-5 text-kong-primary" />
                How Liquidity Provision Works
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 bg-kong-primary rounded-full flex items-center justify-center text-xs font-bold text-white">1</div>
                    <span class="font-medium text-kong-text-primary">Select Tokens</span>
                  </div>
                  <p class="text-kong-text-primary/70 ml-8">Choose the token pair you want to provide liquidity for</p>
                </div>
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 bg-kong-primary rounded-full flex items-center justify-center text-xs font-bold text-white">2</div>
                    <span class="font-medium text-kong-text-primary">Set Amounts</span>
                  </div>
                  <p class="text-kong-text-primary/70 ml-8">Enter the amount of each token you want to deposit</p>
                </div>
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 bg-kong-primary rounded-full flex items-center justify-center text-xs font-bold text-white">3</div>
                    <span class="font-medium text-kong-text-primary">Earn Fees</span>
                  </div>
                  <p class="text-kong-text-primary/70 ml-8">Start earning trading fees from every swap in the pool</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
    <!-- Main Content Grid - 2 Columns -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-4">
      <!-- First Column: Charts -->
      <div class="order-2 lg:order-1">
        <div class="sticky top-24">
          <!-- Pool Chart -->
          <div in:fly={{ y: 20, duration: 400, delay: 200 }}>
            {#if hasSelectedTokens}
              <PoolChart />
            {:else}
              <Card className="h-full min-h-[400px] !p-8">
                <div class="flex flex-col items-center justify-center h-full text-center">
                  <div class="p-4 bg-kong-primary/10 rounded-full mb-4">
                    <TrendingUp class="w-8 h-8 text-kong-primary" />
                  </div>
                  <h3 class="text-lg font-medium text-kong-text-primary mb-2">Pool Analytics</h3>
                  <p class="text-sm text-kong-text-primary/60 max-w-xs">
                    Select both tokens to view pool information, charts, and analytics
                  </p>
                </div>
              </Card>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Second Column: Pool Position + Create Liquidity Panel -->
      <div class="order-1 lg:order-2">
        <div class="space-y-4">
          <!-- User Pool Balance - Moved to top -->
          <div in:fly={{ y: 20, duration: 400, delay: 100 }}>
            {#if isAuthenticated && hasSelectedTokens}
              <UserPoolBalance {token0} {token1} />
            {:else if !isAuthenticated}
              <Card className="!p-6">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="p-2 bg-kong-warning/10 rounded-lg">
                      <Wallet class="w-5 h-5 text-kong-warning" />
                    </div>
                    <div>
                      <h3 class="text-sm font-medium text-kong-text-primary">Your Pool Position</h3>
                      <p class="text-xs text-kong-text-primary/60">Connect wallet to view positions</p>
                    </div>
                  </div>
                </div>
              </Card>
            {:else if hasSelectedTokens}
              <Card className="!p-6">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="p-2 bg-kong-primary/10 rounded-lg">
                      <DollarSign class="w-5 h-5 text-kong-primary" />
                    </div>
                    <div>
                      <h3 class="text-sm font-medium text-kong-text-primary">Your Pool Position</h3>
                      <p class="text-xs text-kong-text-primary/60">No position in this pool</p>
                    </div>
                  </div>
                </div>
              </Card>
            {/if}
          </div>
          
          <!-- Create Liquidity Panel -->
          <div in:fly={{ y: 20, duration: 400, delay: 150 }}>
            <CreateLiquidityPanel />
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
