<script lang="ts">
  import { getMarketsByCreator } from "$lib/api/predictionMarket";
  import Card from "$lib/components/common/Card.svelte";
  import { formatDistanceToNow } from "$lib/utils/dateUtils";
  import {
    TrendingUp,
    Calendar,
    Users,
    DollarSign,
    Star,
    AlertCircle,
  } from "lucide-svelte";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import { userTokens } from "$lib/stores/userTokens";
  import { toShortNumber } from "$lib/utils/numberFormatUtils";
  import MarketCard from "../../../predict/MarketCard.svelte";
  import { useBetModal } from "$lib/composables/useBetModal.svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";

  let { data } = $props();
  let { principalId } = data;

  let markets = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let totalMarkets = $state(0);
  let kongToken = $state<any>(null);

  // Bet modal handling - initialized after KONG token is loaded
  let betModal = $state<any>(null);

  // Check if this is the current user's wallet
  const isOwnWallet = $derived($auth.account?.owner === principalId);

  // Calculate market statistics
  const marketStats = $derived(() => {
    const activeMarkets = markets.filter(
      (m) => m.status && "Active" in m.status,
    ).length;
    const resolvedMarkets = markets.filter(
      (m) => m.status && "Closed" in m.status,
    ).length;
    const totalVolume = markets.reduce((sum, m) => {
      const poolTotal = m.outcome_pools.reduce(
        (acc: number, pool: any) => acc + Number(pool || 0),
        0,
      );
      return sum + poolTotal;
    }, 0);

    return {
      total: markets.length,
      active: activeMarkets,
      resolved: resolvedMarkets,
      totalVolume,
    };
  });

  // Load user's created markets
  async function loadUserMarkets() {
    try {
      loading = true;
      error = null;

      const result = await getMarketsByCreator(principalId, {
        start: 0,
        length: 100,
        sortByCreationTime: true,
      });

      markets = result.markets;
      totalMarkets = Number(result.total);
    } catch (err) {
      console.error("Failed to load user markets:", err);
      error = "Failed to load markets";
    } finally {
      loading = false;
    }
  }

  // Navigate to market details
  function navigateToMarket(marketId: string | number) {
    goto(`/predict/${marketId}`);
  }

  // Handle market resolved (refresh the list)
  async function handleMarketResolved() {
    await loadUserMarkets();
  }

  // Get token info for a market
  function getMarketToken(tokenId: string) {
    return $userTokens.tokens.find((t) => t.address === tokenId);
  }

  // Load KONG token and initialize bet modal
  async function loadKongToken() {
    try {
      const tokens = await fetchTokensByCanisterId([KONG_LEDGER_CANISTER_ID]);
      kongToken = tokens[0];
      // Initialize bet modal after KONG token is loaded
      betModal = useBetModal(kongToken);
    } catch (err) {
      console.error("Failed to load KONG token:", err);
    }
  }

  // Load markets and KONG token on mount
  $effect(() => {
    loadKongToken();
    loadUserMarkets();
  });
</script>

<Card isPadded={true}>
  <div class="mb-6">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <TrendingUp class="w-5 h-5 text-kong-text-secondary" />
        <h2 class="text-xl font-semibold">
          {isOwnWallet ? "Your Markets" : "Created Markets"}
        </h2>
      </div>
    </div>

    {#if !loading && markets.length > 0}
      <!-- Stats Overview -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-kong-bg-secondary rounded-lg p-4">
          <div
            class="flex items-center gap-2 text-sm text-kong-text-secondary mb-1"
          >
            <Users class="w-4 h-4" />
            <span>Total Markets</span>
          </div>
          <div class="text-2xl font-semibold text-kong-text-primary">
            {marketStats().total}
          </div>
        </div>

        <div class="bg-kong-bg-secondary rounded-lg p-4">
          <div
            class="flex items-center gap-2 text-sm text-kong-text-secondary mb-1"
          >
            <AlertCircle class="w-4 h-4" />
            <span>Active</span>
          </div>
          <div class="text-2xl font-semibold text-kong-success">
            {marketStats().active}
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex justify-center py-8">
      <div class="text-kong-text-secondary">Loading markets...</div>
    </div>
  {:else if error}
    <div class="text-center py-8 text-kong-error">
      {error}
    </div>
  {:else if markets.length === 0}
    <div class="text-center py-8 text-kong-text-secondary">
      {isOwnWallet
        ? "You haven't created any markets yet."
        : "This user hasn't created any markets yet."}
    </div>
  {:else}
    <!-- Markets Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each markets as market (market.id)}
        <MarketCard
          {market}
          showEndTime={true}
          openBetModal={betModal?.open || (() => {})}
          onMarketResolved={handleMarketResolved}
          hasClaim={false}
          isUserAdmin={false}
          commentCount={0}
        />
      {/each}
    </div>

    {#if totalMarkets > markets.length}
      <div class="mt-6 text-center">
        <p class="text-sm text-kong-text-secondary">
          Showing {markets.length} of {totalMarkets} markets
        </p>
      </div>
    {/if}
  {/if}
</Card>

<style>
  /* Custom styles if needed */
</style>
