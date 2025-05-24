<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    getMarket,
    getMarketBets,
    placeBet,
    isAdmin,
    voidMarketViaAdmin,
    getSupportedTokens,
  } from "$lib/api/predictionMarket";
  import { formatBalance, toScaledAmount } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { ArrowLeft, Check, TriangleAlert } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import RecentBets from "../RecentBets.svelte";
  import BetModal from "../BetModal.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { userTokens } from "$lib/stores/userTokens";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import type { TokenInfo } from "$lib/types/predictionMarket";

  // Import our new components
  import MarketHeader from "./MarketHeader.svelte";
  import ChartPanel from "./ChartPanel.svelte";
  import OutcomesList from "./OutcomesList.svelte";
  import MarketStats from "./MarketStats.svelte";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import SocialSharePanel from "./SocialSharePanel.svelte";
  import AdminControlsPanel from "./AdminControlsPanel.svelte";
  import InitializeMarketDialog from "./InitializeMarketDialog.svelte";

  let market = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let marketBets = $state<any[]>([]);
  let loadingBets = $state(false);
  let betError = $state<string | null>(null);
  let isBetting = $state(false);
  let isApprovingAllowance = $state(false);
  let timeLeftInterval = $state<ReturnType<typeof setInterval> | undefined>(undefined);
  let timeLeft = $state("");
  // Betting state
  let showBetModal = $state(false);
  let betAmount = $state(0);
  let selectedOutcome = $state<number | null>(null);
  let selectedChartTab = $state("percentageChance");

  // Store pending outcome for after authentication
  let pendingOutcome = $state<number | null>(null);

  let isUserAdmin = $state(false);
  let loadingAdmin = $state(false);
  let showAdminResolutionModal = $state(false);
  let showVoidDialog = $state(false);
  let voiding = $state(false);

  let showInitializeDialog = $state(false);
let initializing = $state(false);

  let marketTokenInfo = $state<TokenInfo | null>(null);

  // Handle chart tab changes
  function handleChartTabChange(tab: string) {
    selectedChartTab = tab;
  }

  function formatTimeLeft(endTime: string | undefined): string {
    if (!endTime) return "Unknown";
    const end = Number(endTime) / 1_000_000; // Convert from nanoseconds to milliseconds
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function updateTimeLeft() {
    if (market?.end_time) {
      timeLeft = formatTimeLeft(market.end_time);
    }
  }

  async function loadMarketBets() {
    if (loadingBets) return;
    try {
      loadingBets = true;
      const allBets = await getMarketBets(BigInt($page.params.id));

      // Create a completely new array with deep copies to avoid any reference issues
      // Make sure to process BigInt values to prevent reactivity issues
      marketBets = allBets.map((bet) => {
        const newBet = { ...bet };

        // Process every property that might be a BigInt
        for (const key in newBet) {
          if (typeof newBet[key] === "bigint") {
            newBet[key] = Number(newBet[key].toString());
          }
        }

        return newBet;
      });
    } catch (e) {
      console.error("Failed to load market bets:", e);
      // Set an empty array on error to avoid undefined issues
      marketBets = [];
    } finally {
      loadingBets = false;
    }
  }

  $effect(() => {
    const fetchData = async () => {
      try {
        const marketId = BigInt($page.params.id);
        const marketData = await getMarket(marketId);
        console.log(marketData);
        market = marketData[0];

        if (market && market.token_id) {
          // Fetch supported tokens from backend
          const backendTokens = await getSupportedTokens();
          marketTokenInfo = backendTokens.find(t => t.id === market.token_id) || null;
        }

        try {
          await loadMarketBets();
        } catch (betError) {
          console.error("Error loading bets:", betError);
          // Continue with the rest of the page even if bets fail to load
          marketBets = [];
        }

        // Start countdown timer
        updateTimeLeft();
        timeLeftInterval = setInterval(updateTimeLeft, 1000);
      } catch (e) {
        error = "Failed to load market";
        console.error(e);
      } finally {
        loading = false;
      }
    };

    fetchData();

    return () => {
      if (timeLeftInterval) {
        clearInterval(timeLeftInterval);
      }
    };
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
      const scaledAmount = toScaledAmount(amount.toString(), kongToken.decimals);
      await placeBet(
        kongToken,
        BigInt(market.id),
        BigInt(outcomeIndex),
        scaledAmount,
      );

      // Reset betting state
      betAmount = 0;
      selectedOutcome = null;

      // Refresh market data
      const marketId = BigInt($page.params.id);
      const marketData = await getMarket(marketId);
      market = marketData[0];
      showBetModal = false;
      toastStore.add({
        title: "Bet Placed",
        message: `You bet ${amount} KONG on ${market.outcomes[outcomeIndex]}`,
        type: "success",
      });

      // Reload bets with a small delay to allow backend to update
      setTimeout(async () => {
        await loadMarketBets();
      }, 500);
    } catch (e) {
      console.error("Bet error:", e);
      betError = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      isBetting = false;
    }
  }

  function handleOutcomeSelect(outcomeIndex: number) {
    // Check if user is authenticated
    if (!$auth.isConnected) {
      // Store the outcome to open after authentication
      pendingOutcome = outcomeIndex;
      walletProviderStore.open(handleWalletLogin);
      return;
    }

    // User is authenticated, proceed with opening bet modal
    selectedOutcome = outcomeIndex;
    showBetModal = false;
    // Force a repaint cycle before opening modal again
    setTimeout(() => {
      showBetModal = true;
    }, 0);
  }

  function handleWalletLogin() {
    // If we have a pending outcome, open the bet modal after authentication
    if (pendingOutcome !== null) {
      selectedOutcome = pendingOutcome;
      showBetModal = true;
      pendingOutcome = null;
    }
  }

  async function handleVoidMarket() {
    try {
      await voidMarketViaAdmin(BigInt(market.id));
      toastStore.add({
        title: "Market Voided",
        message: `Market has been voided successfully` ,
        type: "success",
      });
      // Refresh market data
      const marketId = BigInt($page.params.id);
      const marketData = await getMarket(marketId);
      market = marketData[0];
    } catch (e) {
      toastStore.add({
        title: "Error",
        message: e instanceof Error ? e.message : "Failed to void market",
        type: "error",
      });
    }
  }

  function openVoidDialog() {
    showVoidDialog = true;
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
      const marketId = BigInt($page.params.id);
      
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
        minBetAmount.toString()
      );
      
      showInitializeDialog = false;
      
      // Refresh market data
      const marketData = await getMarket(marketId);
      market = marketData[0];
      
      // Reload bets with a small delay to allow backend to update
      setTimeout(async () => {
        await loadMarketBets();
      }, 500);
      
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

  let token = $derived(market ? $userTokens.tokens.find(t => t.address === market.token_id) : null);

  let totalPool = $derived(Number(market?.total_pool || 0));
  let outcomes = $derived(market?.outcomes || []);
  let betCounts = $derived(market?.bet_counts?.map(Number) || []);
  let betCountPercentages = $derived(market?.bet_count_percentages || []);
  let outcomePercentages = $derived(market?.outcome_percentages || []);
  let isMarketClosed = $derived(market?.status?.Closed !== undefined);
  let winningOutcomes = $derived(isMarketClosed ? market.status.Closed : []);
  let isMarketResolved = $derived(isMarketClosed);
  let isMarketVoided = $derived(market?.status?.Voided !== undefined);
  let marketEndTime = $derived(market?.end_time
    ? Number(market.end_time) / 1_000_000
    : null);
  let isPendingResolution = $derived(
    !isMarketResolved &&
    !isMarketVoided &&
    marketEndTime &&
    marketEndTime < Date.now());

  // Calculate the formatted minimum initial bet string
  let formattedMinInitialBetString = $derived(
    marketTokenInfo && 
    typeof marketTokenInfo.activation_fee !== 'undefined' && 
    typeof marketTokenInfo.decimals !== 'undefined' && 
    marketTokenInfo.symbol
      ? `${formatBalance(Number(marketTokenInfo.activation_fee), marketTokenInfo.decimals)} ${marketTokenInfo.symbol}`
      : "the required minimum" // Fallback string
  );

  $effect(() => {
    if ($auth.isConnected && $auth.account?.owner) {
      loadingAdmin = true;
      isAdmin($auth.account.owner)
        .then((result) => {
          isUserAdmin = result;
        })
        .catch((e) => {
          isUserAdmin = false;
        })
        .finally(() => {
          loadingAdmin = false;
        });
    }
  });

  $effect(() => {
    if (showVoidDialog) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Clean up in case the component is destroyed
    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

<svelte:head>
  <title>{market?.question} - KongSwap</title>
  <meta name="description" content={market?.question} />
  <meta
    property="og:title"
    content="{market?.question} - KongSwap Prediction Market"
  />
  <meta
    property="og:description"
    content="Make your predictions on future events at KongSwap!"
  />
  <meta
    property="og:image"
    content="https://kongswap.io/images/predictionmarket-og.jpg"
  />
  <meta
    property="og:url"
    content="{$page.url.origin}/predict/{$page.params.id}"
  />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary px-2 sm:px-4">
  <div class="max-w-6xl mx-auto">
    <ButtonV2
    on:click={() => goto("/predict")}
    variant="transparent"
    theme="secondary"
    size="sm"
    className="mb-4 flex items-center gap-2 -mt-2"
  >
    <ArrowLeft class="w-4 h-4" />
    <span>Back</span>
  </ButtonV2>
  
    {#if market && betCounts && betCounts.reduce((acc, curr) => acc + curr, 0) === 0 && market?.creator?.toText() === $auth.account.owner}
      <div
        class="bg-kong-accent-yellow {$panelRoundness} text-black mb-8 p-4 justify-center flex flex-col items-center gap-2"
      >
        <div class="flex items-center gap-x-2">
          <TriangleAlert class="w-6 h-6 text-orange-800" />
          <span class="text-lg font-medium">Market Not Initialized</span>
        </div>

        <span class="text-center">
          You must place a <strong>{formattedMinInitialBetString}</strong> bet to initialize the market. 
          <br/> 
          This market will not be publicly visible until the market is initialized.
          </span>
        <ButtonV2
          theme="warning"
          on:click={() => showInitializeDialog = true}
        >
          Initialize Market
        </ButtonV2>
      </div>
    {/if}


    {#if error}
      <div class="text-center py-8 sm:py-12">
        <p class="text-kong-accent-red text-base sm:text-lg" role="alert">
          {error}
        </p>
        <ButtonV2
          on:click={() => location.reload()}
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
          class="h-6 sm:h-8 bg-kong-bg-light/30 rounded animate-pulse mx-auto w-full sm:w-1/2"
        ></div>
        <div
          class="h-16 sm:h-20 bg-kong-bg-light/30 rounded animate-pulse mx-auto w-full sm:w-3/4"
        ></div>
        <div
          class="h-32 sm:h-40 bg-kong-bg-light/30 rounded animate-pulse mx-auto w-full"
        ></div>
      </div>
    {:else if market}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-3 sm:space-y-4">
          <!-- Chart Panel with Tabs -->
          <Panel
            variant="transparent"
            className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
          >
            <!-- Market Info Panel -->
            <MarketHeader
              {market}
              {isMarketResolved}
              {isPendingResolution}
              {isMarketVoided}
            />

            <!-- Re-enable the simplified ChartPanel -->
            <ChartPanel
              {market}
              {marketBets}
              {selectedChartTab}
              onTabChange={handleChartTabChange}
            />
          </Panel>

          <!-- Outcomes Panel -->
          <OutcomesList
            {market}
            {token}
            {outcomes}
            {outcomePercentages}
            {betCountPercentages}
            {betCounts}
            {isMarketResolved}
            {isPendingResolution}
            {isMarketClosed}
            {winningOutcomes}
            onSelectOutcome={handleOutcomeSelect}
          />
        </div>

        <!-- Right Column -->
        <div class="space-y-3 sm:space-y-4">
          <AdminControlsPanel
            {isUserAdmin}
            {loadingAdmin}
            {isMarketResolved}
            {isMarketVoided}
            onOpenVoidDialog={openVoidDialog}
            {market}
            on:closeResolutionModal={() => showAdminResolutionModal = false}
            on:marketUpdated={e => market = e.detail.market}
          />
          <!-- Market Stats Panel -->
          <MarketStats
            {totalPool}
            {betCounts}
            {timeLeft}
            {market}
            {isMarketResolved}
            marketEndTime={market.end_time}
          />

          <!-- Social Share Buttons -->
          <SocialSharePanel
            marketUrl={`${window.location.origin}/predict/${$page.params.id}`}
            marketQuestion={market?.question}
          />

          <!-- Restore the simplified RecentBets -->
          <RecentBets
            bets={marketBets}
            outcomes={market?.outcomes}
            showOutcomes={true}
            maxHeight="500px"
            panelVariant="transparent"
            title="Recent Predictions"
            loading={loadingBets}
            tokenSymbol={token?.symbol}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<Dialog
title="Confirm Void Market"
open={showVoidDialog}
onClose={() => showVoidDialog = false}
showClose={false}
>
<div class="flex flex-col gap-4">
  <div class="text-kong-text-primary text-lg font-semibold">Are you sure you want to void this market?</div>
  <div class="text-kong-text-secondary text-sm">Voiding a market is <span class="font-bold text-kong-accent-red">irreversible</span> and will refund all user bets. This action cannot be undone.</div>
  <div class="flex gap-3 justify-end">
    <ButtonV2
      theme="secondary"
      on:click={() => showVoidDialog = false}
      disabled={voiding}
    >
      Cancel
    </ButtonV2>
    <ButtonV2
      theme="warning"
      on:click={confirmVoidMarket}
      disabled={voiding}
    >
      {voiding ? 'Voiding...' : 'Void Market'}
    </ButtonV2>
  </div>
</div>
</Dialog>

<InitializeMarketDialog
  open={showInitializeDialog}
  onClose={() => {
    showInitializeDialog = false; 
    selectedOutcome = null;
  }}
  onInitialize={initializeMarket}
  outcomes={market?.outcomes || []}
  {initializing}
  {formattedMinInitialBetString}
/>

{#if showBetModal}
  <BetModal
    {showBetModal}
    selectedMarket={market}
    {isBetting}
    {isApprovingAllowance}
    {betError}
    {selectedOutcome}
    {betAmount}
    onClose={() => {
      // First set the selected outcome and amount to null
      selectedOutcome = null;
      betAmount = 0;
      betError = null;
      // Then close modal in the next tick to ensure clean state
      setTimeout(() => {
        showBetModal = false;
      }, 0);
    }}
    onBet={(amount) => handleBet(selectedOutcome!, amount)}
  />
{/if}

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
