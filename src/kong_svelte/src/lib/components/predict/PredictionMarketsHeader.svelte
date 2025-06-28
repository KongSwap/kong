<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { marketStore, filteredMarkets } from "$lib/stores/marketStore";
  import {
    ChartBar,
    HelpCircle,
    Plus,
    History,
    Activity,
    Ticket,
  } from "lucide-svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { getPredictionMarketStats } from "$lib/api/predictionMarket";
  import { onMount } from "svelte";

  interface Props {
    openBetModal: (market: any, outcomeIndex?: number) => void;
    userClaims?: any[];
  }

  let { openBetModal, userClaims = [] }: Props = $props();

  // Stats state
  let stats = $state<{
    total_markets: bigint;
    total_bets: bigint;
    total_active_markets: bigint;
  } | null>(null);

  onMount(async () => {
    try {
      stats = await getPredictionMarketStats();
    } catch (error) {
      console.error("Failed to fetch prediction market stats:", error);
    }
  });
</script>

<div class="mb-8 px-4">
  <div class="sm:w-full lg:w-5/6 mx-auto overflow-hidden relative">
    <div class="relative z-10 md:pb-4">
      <div class="max-w-7xl mx-auto">
        <!-- Main headline -->
        <div class="text-center mb-4">
          <h1
            class="text-4xl md:text-5xl font-bold text-kong-text-primary mb-4"
          >
            Put Your <span
              class="text-transparent font-black bg-clip-text bg-gradient-to-r from-kong-primary via-kong-accent-blue to-kong-primary animate-shine"
              >Knowledge</span
            > to Work
          </h1>
          <p
            class="text-lg md:text-base text-kong-text-secondary !max-w-3xl mx-auto"
          >
            Turn your predictions into <span
              class="text-kong-text-primary font-semibold">profit</span
            >. Stake on outcomes you believe in and
            <span class="text-kong-text-primary font-semibold"
              >earn when you're right.</span
            >
          </p>
        </div>

        <!-- CTA section -->
        <div class="text-center">
          <!-- Total Markets -->
          <div
            class="flex items-center justify-center gap-1 text-sm text-kong-text-secondary mb-4"
          >
            <ChartBar class="w-4 h-4 text-kong-primary" />
            <span
              ><span class="font-semibold text-kong-text-primary"
                >{stats?.total_markets || $marketStore.markets.length}</span
              > Total Markets</span
            >
            <div class="hidden sm:block w-px mx-2 h-4 bg-kong-border"></div>
            <Activity class="w-4 h-4 text-kong-primary" />
            <span
              ><span class="font-semibold text-kong-text-primary"
                >{stats?.total_active_markets || 0}</span
              > Active Markets</span
            >
            <div class="hidden sm:block w-px mx-2 h-4 bg-kong-border"></div>
            <Ticket class="w-4 h-4 text-kong-primary" />
            <span
              ><span class="font-semibold text-kong-text-primary"
                >{stats ? stats.total_bets : "0"}</span
              > Predictions</span
            >
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-center gap-3 pt-2">
            <ButtonV2
              theme="primary"
              variant="transparent"
              size="lg"
              onclick={() => goto("/predict/faq")}
            >
              <div class="flex items-center gap-2">
                <HelpCircle class="w-4 h-4" />
                <span>Learn More</span>
              </div>
            </ButtonV2>

            {#if $auth.isConnected}
              <ButtonV2
                theme="primary"
                variant="solid"
                size="lg"
                onclick={() => goto("/predict/create")}
              >
                <div class="flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  <span>Create Market</span>
                </div>
              </ButtonV2>
              <ButtonV2
                theme="primary"
                variant="transparent"
                size="lg"
                onclick={() => goto("/predict/history")}
              >
                <div class="flex items-center gap-2">
                  <History class="w-4 h-4" />
                  <span>My History</span>
                </div>
              </ButtonV2>
            {:else}
              <ButtonV2
                theme="primary"
                variant="solid"
                size="lg"
                onclick={() => walletProviderStore.open()}
              >
                <div class="flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  <span>Connect Wallet</span>
                </div>
              </ButtonV2>
            {/if}
          </div>

          <div class="flex items-center justify-center gap-3 pt-2">
            <ButtonV2
              theme="primary"
              variant="transparent"
              size="sm"
              onclick={() => goto("/predict_v1")}
            >
              <div class="flex items-center gap-2">
                <span>Legacy V1 Markets</span>
              </div>
            </ButtonV2>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Enhanced shine animation for gradient text */
  :global(.animate-shine) {
    background-size: 400% 100%;
    background-position: 0% 50%;
    animation: shine 4s ease-in-out infinite;
  }

  @keyframes shine {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
