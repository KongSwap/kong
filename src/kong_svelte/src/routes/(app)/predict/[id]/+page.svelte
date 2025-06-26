<script lang="ts">
  import { page } from "$app/state";
  import {
    getMarket,
    getMarketBets,
    placeBet,
    isAdmin,
    voidMarketViaAdmin,
    getSupportedTokens,
    getUserPendingClaims,
  } from "$lib/api/predictionMarket";
  import { formatBalance, toScaledAmount } from "$lib/utils/numberFormatUtils";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import RecentPredictions from "../RecentPredictions.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import type { TokenInfo } from "$lib/types/predictionMarket";

  // Import our new components
  import MarketHeader from "./MarketHeader.svelte";
  import OutcomesList from "./OutcomesList.svelte";
  import MarketDetailsCard from "./MarketDetailsCard.svelte";
  import ResolutionCard from "./ResolutionCard.svelte";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import AdminControlsPanel from "./AdminControlsPanel.svelte";
  import InitializeMarketDialog from "./InitializeMarketDialog.svelte";
  import UserClaimsCard from "./UserClaimsCard.svelte";
  import ActivateMarketCard from "./ActivateMarketCard.svelte";
  import HowItWorksSection from "./HowItWorksSection.svelte";
  import Card from "$lib/components/common/Card.svelte";

  let market = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let marketBets = $state<any[]>([]);
  let loadingBets = $state(false);
  let betError = $state<string | null>(null);
  let isBetting = $state(false);
  let isApprovingAllowance = $state(false);
  // Removed timeLeftInterval - MarketDetailsCard handles time display updates
  // Chart tab state
  let selectedTab = $state("percentageChance");

  let isUserAdmin = $state(false);
  let loadingAdmin = $state(false);
  let showAdminResolutionModal = $state(false);
  let showVoidDialog = $state(false);
  let voiding = $state(false);

  let showInitializeDialog = $state(false);
  let initializing = $state(false);
  let selectedInitializeOutcome = $state<number | null>(null);

  let marketTokenInfo = $state<TokenInfo | null>(null);
  let userClaims = $state<any[]>([]);
  let loadingClaims = $state(false);
  
  // Consolidated function to refresh market data
  async function refreshMarketData() {
    const marketId = BigInt(page.params.id);
    const marketData = await getMarket(marketId);
    market = marketData[0];
    
    // Reload bets with a small delay to allow backend to update
    setTimeout(async () => {
      await loadMarketBets();
    }, 500);
  }

  // Handle tab changes
  function handleTabChange(tab: string) {
    selectedTab = tab;
  }

  // Removed formatTimeLeft - MarketDetailsCard handles time formatting

  // Removed updateTimeLeft - MarketDetailsCard handles countdown display

  async function loadMarketBets() {
    if (loadingBets) return;
    try {
      loadingBets = true;
      const allBets = await getMarketBets(BigInt(page.params.id));
      
      // Optimize BigInt conversion - only convert fields we actually use
      marketBets = allBets.map((bet) => ({
        ...bet,
        // Convert only the BigInt fields that are displayed or used in calculations
        amount: typeof bet.amount === "bigint" ? Number(bet.amount) : bet.amount,
        outcome_index: typeof bet.outcome_index === "bigint" ? Number(bet.outcome_index) : bet.outcome_index,
        timestamp: typeof bet.timestamp === "bigint" ? Number(bet.timestamp) : bet.timestamp,
      }));
    } catch (e) {
      console.error("Failed to load market bets:", e);
      marketBets = [];
    } finally {
      loadingBets = false;
    }
  }

  // Consolidated admin status check
  async function checkAdminStatus() {
    if (!$auth.isConnected || !$auth.account?.owner) {
      isUserAdmin = false;
      return;
    }
    
    try {
      loadingAdmin = true;
      isUserAdmin = await isAdmin($auth.account.owner);
    } catch (error) {
      console.error("Failed to check admin status:", error);
      isUserAdmin = false;
    } finally {
      loadingAdmin = false;
    }
  }
  
  // Single effect for auth-related updates
  $effect(() => {
    checkAdminStatus();
    
    // Load user claims when authenticated
    if ($auth.isConnected && $auth.account?.owner) {
      loadingClaims = true;
      getUserPendingClaims($auth.account.owner)
        .then((claims) => {
          userClaims = claims;
        })
        .catch((e) => {
          console.error("Failed to load user claims:", e);
          userClaims = [];
        })
        .finally(() => {
          loadingClaims = false;
        });
    } else {
      userClaims = [];
    }
  })

  // Main data loading effect - optimized to run only once
  $effect(() => {
    const fetchData = async () => {
      try {
        loading = true;
        const marketId = BigInt(page.params.id);
        const [marketData, backendTokens] = await Promise.all([
          getMarket(marketId),
          getSupportedTokens()
        ]);
        
        market = marketData[0];
        
        if (market?.token_id) {
          marketTokenInfo = backendTokens.find((t) => t.id === market.token_id) || null;
        }

        // Load bets without blocking
        loadMarketBets().catch(betError => {
          console.error("Error loading bets:", betError);
          marketBets = [];
        });
      } catch (e) {
        error = "Failed to load market";
        console.error(e);
      } finally {
        loading = false;
      }
    };

    fetchData();
  });

  async function handleBet(outcomeIndex: number, amount: number) {
    if (!market) return;

    try {
      isBetting = true;
      betError = null;

      const tokens = await fetchTokensByCanisterId([KONG_LEDGER_CANISTER_ID]);
      const kongToken = tokens[0];

      if (!kongToken) {
        throw new Error("Failed to fetch KONG token information");
      }

      // Convert bet amount to scaled token units
      const scaledAmount = toScaledAmount(
        amount.toString(),
        kongToken.decimals,
      );
      await placeBet(
        kongToken,
        BigInt(market.id),
        BigInt(outcomeIndex),
        scaledAmount,
      );

      toastStore.add({
        title: "Prediction Placed",
        message: `You predicted ${amount} KONG on ${market.outcomes[outcomeIndex]}`,
        type: "success",
      });
      
      await refreshMarketData();
    } catch (e) {
      console.error("Bet error:", e);
      betError = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      isBetting = false;
    }
  }

  async function handleVoidMarket() {
    try {
      await voidMarketViaAdmin(BigInt(market.id));
      toastStore.add({
        title: "Market Voided",
        message: `Market has been voided successfully`,
        type: "success",
      });
      await refreshMarketData();
    } catch (e) {
      toastStore.add({
        title: "Error",
        message: e instanceof Error ? e.message : "Failed to void market",
        type: "error",
      });
    }
  }

  async function confirmVoidMarket() {
    voiding = true;
    await handleVoidMarket();
    voiding = false;
    showVoidDialog = false;
  }

  async function initializeMarket(outcomeIndex: number) {
    initializing = true;
    try {
      // Get the market ID from the page parameters
      const marketId = BigInt(page.params.id);

      // Get the token information from marketTokenInfo
      if (!marketTokenInfo) {
        throw new Error("Token information is not available");
      }

      // First fetch the token details from userTokens
      const tokens = await fetchTokensByCanisterId([marketTokenInfo.id]);
      const token = tokens[0];

      if (!token) {
        throw new Error("Failed to fetch token information");
      }

      // Use the minimum initial bet amount from marketTokenInfo
      const minBetAmount = marketTokenInfo.activation_fee;

      // Place the bet to initialize the market
      await placeBet(
        token,
        marketId,
        BigInt(outcomeIndex),
        minBetAmount.toString(),
      );

      showInitializeDialog = false;
      await refreshMarketData();

      toastStore.add({
        title: "Market Initialized",
        message: `You have initialized the market with ${formattedMinInitialBetString} bet on "${market.outcomes[outcomeIndex]}".`,
        type: "success",
      });
    } catch (e) {
      console.error("Market initialization error:", e);
      toastStore.add({
        title: "Error",
        message: e instanceof Error ? e.message : "Failed to initialize market",
        type: "error",
      });
    } finally {
      initializing = false;
    }
  }

  async function handleMarketResolved() {
    await refreshMarketData();
  }

  // Optimize derived computations with $derived.by for complex logic
  let marketStatus = $derived.by(() => {
    if (!market) return null;
    return {
      isClosed: market.status?.Closed !== undefined,
      isVoided: market.status?.Voided !== undefined,
      endTime: market.end_time ? Number(market.end_time) / 1_000_000 : null
    };
  });
  
  let isMarketClosed = $derived(marketStatus?.isClosed ?? false);
  let isMarketResolved = $derived(isMarketClosed);
  let isMarketVoided = $derived(marketStatus?.isVoided ?? false);
  let marketEndTime = $derived(marketStatus?.endTime);
  
  let isPendingResolution = $derived(
    !isMarketResolved &&
    !isMarketVoided &&
    marketEndTime &&
    marketEndTime < Date.now()
  );

  let marketActivationStatus = $derived.by(() => {
    if (!market || !market.bet_counts || !$auth.account?.owner) return false;
    const totalBets = market.bet_counts.reduce((acc: number, curr: any) => acc + Number(curr), 0);
    return totalBets === 0 && market.creator?.toText() === $auth.account.owner;
  });
  
  let isMarketNeedsActivation = $derived(marketActivationStatus);

  // Calculate the formatted minimum initial bet string
  let formattedMinInitialBetString = $derived.by(() => {
    if (!marketTokenInfo || 
        typeof marketTokenInfo.activation_fee === "undefined" ||
        typeof marketTokenInfo.decimals === "undefined" ||
        !marketTokenInfo.symbol) {
      return "the required minimum";
    }
    return `${formatBalance(Number(marketTokenInfo.activation_fee), marketTokenInfo.decimals)} ${marketTokenInfo.symbol}`;
  });

  // Resolution status checks
  let resolutionStatus = $derived.by(() => {
    const isUserCreated = isPendingResolution &&
      market &&
      $auth.isConnected &&
      $auth.account?.owner === market.creator?.toText() &&
      !isUserAdmin;
      
    const isAdminPending = isPendingResolution &&
      market &&
      $auth.isConnected &&
      isUserAdmin &&
      market.resolution_proposal?.length > 0 &&
      market.resolution_proposal[0]?.status?.AwaitingAdminVote !== undefined;
      
    return { isUserCreated, isAdminPending };
  });
  
  let isUserCreatedPendingResolution = $derived(resolutionStatus.isUserCreated);
  let isAdminPendingResolution = $derived(resolutionStatus.isAdminPending);

  // Check if the market has ended but user cannot resolve it
  let isMarketEndedForNonResolver = $derived(
    isPendingResolution &&
    market &&
    $auth.isConnected &&
    $auth.account?.owner !== market.creator?.toText() &&
    !isUserAdmin
  );

  // Check if market has ended with zero predictions
  let isMarketEndedWithNoBets = $derived.by(() => {
    if (!market || !market.bet_counts) return false;
    const totalBets = market.bet_counts.reduce((acc: number, curr: any) => acc + Number(curr), 0);
    return totalBets === 0 && marketEndTime && marketEndTime < Date.now();
  });

  // This duplicate admin check effect has been removed - consolidated into the auth effect above

  $effect(() => {
    if (showVoidDialog) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    // Clean up in case the component is destroyed
    return () => {
      document.body.style.overflow = "";
    };
  });
</script>

<div
  class="min-h-screen text-kong-text-primary px-2 sm:px-4 mx-auto !max-w-[1300px]"
>
  <div class="max-w-6xl mx-auto">
    {#if error}
      <div class="text-center py-8 sm:py-12">
        <p class="text-kong-error text-base sm:text-lg" role="alert">
          {error}
        </p>
        <ButtonV2
          onclick={() => location.reload()}
          theme="accent-blue"
          className="mt-3 sm:mt-4"
        >
          Reload Market
        </ButtonV2>
      </div>
    {:else if loading}
      <div
        role="status"
        aria-label="Loading market data"
        class="space-y-3 sm:space-y-4 py-8 sm:py-12"
      >
        <div
          class="h-6 sm:h-8 bg-kong-bg-secondary/30 rounded animate-pulse mx-auto w-full sm:w-1/2"
        ></div>
        <div
          class="h-16 sm:h-20 bg-kong-bg-secondary/30 rounded animate-pulse mx-auto w-full sm:w-3/4"
        ></div>
        <div
          class="h-32 sm:h-40 bg-kong-bg-secondary/30 rounded animate-pulse mx-auto w-full"
        ></div>
      </div>
    {:else if market}
      <!-- Market Info Panel -->
      <MarketHeader {market} />
      <div class="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 mt-4">
        <!-- Left Column -->
        <div class="flex-1 space-y-3 sm:space-y-4">
          <!-- How it works section (moved from MarketHeader) -->
          {#if !isMarketResolved && !isMarketVoided && !isPendingResolution}
            <HowItWorksSection />
          {/if}

          <!-- Activate Market Card or Ended with No Bets Card -->
          {#if isMarketEndedWithNoBets}
            <Card className="p-4 sm:p-6">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-kong-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-base font-semibold text-kong-text-primary mb-1">Market Expired Without Activity</h3>
                  <p class="text-sm text-kong-text-secondary">
                    This market has ended without receiving any predictions. Markets with no activity are automatically deleted to maintain system efficiency.
                  </p>
                </div>
              </div>
            </Card>
          {:else if isMarketNeedsActivation}
            <ActivateMarketCard
              {market}
              {formattedMinInitialBetString}
              onSelectOutcome={(outcomeIndex) => {
                selectedInitializeOutcome = outcomeIndex;
                showInitializeDialog = true;
              }}
            />
          {/if}

          <!-- Market Ended Message for Non-Resolvers -->
          {#if isMarketEndedForNonResolver}
            <Card className="p-4 sm:p-6">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-kong-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-base font-semibold text-kong-text-primary mb-1">Market Has Ended</h3>
                  <p class="text-sm text-kong-text-secondary">
                    This market has reached its end time and is awaiting resolution. The market creator will determine the winning outcome soon.
                  </p>
                </div>
              </div>
            </Card>
          {/if}

          <!-- Outcomes Panel or Resolution Panel -->
          {#if isUserCreatedPendingResolution || isAdminPendingResolution}
            <ResolutionCard
              {market}
              onMarketResolved={handleMarketResolved}
              isAdmin={isUserAdmin}
            />
          {:else if !isMarketNeedsActivation && !isMarketEndedForNonResolver && !isMarketEndedWithNoBets}
            <OutcomesList {market} {marketBets} onPlacePrediction={handleBet} isAdmin={isUserAdmin} />
          {/if}

          <!-- Recent Predictions -->
          <RecentPredictions
            bets={marketBets}
            outcomes={market?.outcomes}
            showOutcomes={true}
            maxHeight="500px"
            title="Recent Predictions"
            loading={loadingBets}
            tokenSymbol={marketTokenInfo?.symbol || "KONG"}
          />
        </div>

        <!-- Right Column -->
        <div
          class="w-full lg:w-[450px] lg:flex-shrink-0 space-y-3 sm:space-y-4"
        >
          <UserClaimsCard
            claims={userClaims}
            loading={loadingClaims}
            marketId={page.params.id}
            {marketTokenInfo}
          />

          <!-- Market Stats Panel with Tabs -->
          <MarketDetailsCard
            {market}
            {loading}
            {marketBets}
            {selectedTab}
            onTabChange={handleTabChange}
          />

          <AdminControlsPanel
            {isUserAdmin}
            {loadingAdmin}
            onOpenVoidDialog={() => (showVoidDialog = true)}
            {market}
            on:closeResolutionModal={() => (showAdminResolutionModal = false)}
            on:marketUpdated={(e) => (market = e.detail.market)}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<Dialog
  title="Confirm Void Market"
  open={showVoidDialog}
  onClose={() => (showVoidDialog = false)}
  showClose={false}
>
  <div class="flex flex-col gap-4">
    <div class="text-kong-text-primary text-lg font-semibold">
      Are you sure you want to void this market?
    </div>
    <div class="text-kong-text-secondary text-sm">
      Voiding a market is <span class="font-bold text-kong-error"
        >irreversible</span
      > and will refund all user bets. This action cannot be undone.
    </div>
    <div class="flex gap-3 justify-end">
      <ButtonV2
        theme="secondary"
        onclick={() => (showVoidDialog = false)}
        disabled={voiding}
      >
        Cancel
      </ButtonV2>
      <ButtonV2 theme="warning" onclick={confirmVoidMarket} disabled={voiding}>
        {voiding ? "Voiding..." : "Void Market"}
      </ButtonV2>
    </div>
  </div>
</Dialog>

<InitializeMarketDialog
  open={showInitializeDialog}
  onClose={() => {
    showInitializeDialog = false;
    selectedInitializeOutcome = null;
  }}
  onInitialize={initializeMarket}
  outcomes={market?.outcomes || []}
  activating={initializing}
  {formattedMinInitialBetString}
  preselectedOutcome={selectedInitializeOutcome}
/>

<style lang="postcss" scoped>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
