<!-- TODO: Add the rules -->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import {
    getMarket,
    getMarketBets,
    placeBet,
  } from "$lib/api/predictionMarket";
  import { formatBalance, toScaledAmount } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    ArrowLeft,
    X,
    Facebook,
    Copy,
  } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import RecentBets from "../RecentBets.svelte";
  import { slide, fade, crossfade } from "svelte/transition";
  import BetModal from "../BetModal.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";

  // Import our new components
  import MarketHeader from "./MarketHeader.svelte";
  import ChartPanel from "./ChartPanel.svelte";
  import OutcomesList from "./OutcomesList.svelte";
  import MarketStats from "./MarketStats.svelte";
  import { browser } from "$app/environment";

  let market: any = null;
  let loading = true;
  let error: string | null = null;
  let marketBets: any[] = [];
  let loadingBets = false;
  let betError: string | null = null;
  let isBetting = false;
  let isApprovingAllowance = false;
  let timeLeftInterval: ReturnType<typeof setInterval>;
  let timeLeft: string = "";
  // Betting state
  let showBetModal = false;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let selectedChartTab: string = "percentageChance";

  // Store pending outcome for after authentication
  let pendingOutcome: number | null = null;

  // Add an error state for charts
  let chartError: boolean = false;

  // Reference to the ChartPanel component
  let chartPanel: typeof ChartPanel;

  // Handle chart tab changes
  function handleChartTabChange(tab: string) {
    selectedChartTab = tab;
  }

  const [send, receive] = crossfade({
    duration: 300,
    fallback(node, params) {
      return {
        duration: 300,
        css: (t) => `
          opacity: ${t};
          transform: scale(${0.8 + 0.2 * t});
        `,
      };
    },
  });

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
      const allBets = await getMarketBets(Number($page.params.id));

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

  onMount(async () => {
    try {
      const marketId = Number($page.params.id);
      const marketData = await getMarket(marketId);
      console.log(marketData);
      market = marketData[0];

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
  });

  onDestroy(() => {
    if (timeLeftInterval) {
      clearInterval(timeLeftInterval);
    }
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
      const scaledAmount = toScaledAmount(amount, kongToken.decimals);

      await placeBet(kongToken, Number(market.id), outcomeIndex, scaledAmount);

      // Reset betting state
      betAmount = 0;
      selectedOutcome = null;

      // Refresh market data
      const marketId = Number($page.params.id);
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

  function shareToTwitter() {
    if (browser) {
      const marketUrl = `${window.location.origin}/predict/${$page.params.id}`;
      const marketQuestion = market?.question || "Prediction Market";
      const tweetText = encodeURIComponent(
        `"${marketQuestion}" \n\nWhat's your prediction? Bet now on KongSwap!\n\n${marketUrl} \n#KongSwap #PredictionMarket`,
      );
      const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
      window.open(twitterUrl, "_blank");
    }
  }

  function shareToFacebook() {
    if (browser) {
      const marketUrl = `${window.location.origin}/predict/${$page.params.id}`;
      // Simple share that just passes the URL - relies on OpenGraph meta tags for display
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(marketUrl)}`;
      window.open(facebookUrl, "_blank");
    }
  }

  function shareToReddit() {
    if (browser) {
      const marketUrl = `${window.location.origin}/predict/${$page.params.id}`;
      const marketQuestion = market?.question || "Prediction Market";
      const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(marketUrl)}&title=${encodeURIComponent(marketQuestion)}`;
      window.open(redditUrl, "_blank");
    }
  }

  function shareToTikTok() {
    if (browser) {
      const marketUrl = `${window.location.origin}/predict/${$page.params.id}`;
      const marketQuestion = market?.question || "Prediction Market";
      
      // Copy the link to clipboard
      navigator.clipboard
        .writeText(marketUrl)
        .then(() => {
          toastStore.info(
            "Link copied! Paste it in your TikTok caption to share this prediction market.",
            { title: "Share to TikTok" }
          );
          
          // Also open TikTok
          const hashtag = encodeURIComponent("KongSwap");
          const tiktokUrl = `https://www.tiktok.com/tag/${hashtag}`;
          window.open(tiktokUrl, "_blank");
        })
        .catch((err) => {
          console.error("Could not copy text: ", err);
          toastStore.error("Failed to copy link for TikTok", { title: "Error" });
          
          // Still try to open TikTok even if clipboard fails
          const hashtag = encodeURIComponent("KongSwap");
          const tiktokUrl = `https://www.tiktok.com/tag/${hashtag}`;
          window.open(tiktokUrl, "_blank");
        });
    }
  }

  function shareToTelegram() {
    if (browser) {
      const marketUrl = `${window.location.origin}/predict/${$page.params.id}`;
      const marketQuestion = market?.question || "Prediction Market";
      const telegramText = encodeURIComponent(
        `"${marketQuestion}" on KongSwap: ${marketUrl}`,
      );
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(marketUrl)}&text=${telegramText}`;
      window.open(telegramUrl, "_blank");
    }
  }

  function copyLinkToClipboard() {
    if (browser) {
      const marketUrl = `${window.location.origin}/predict/${$page.params.id}`;
      navigator.clipboard
        .writeText(marketUrl)
        .then(() => {
          toastStore.add({
            title: "Link Copied",
            message: "Market link copied to clipboard",
            type: "success",
          });
        })
        .catch((err) => {
          console.error("Could not copy text: ", err);
          toastStore.add({
            title: "Error",
            message: "Failed to copy link",
            type: "error",
          });
        });
    }
  }

  $: totalPool = Number(market?.total_pool || 0);
  $: outcomes = market?.outcomes || [];
  $: betCounts = market?.bet_counts?.map(Number) || [];
  $: betCountPercentages = market?.bet_count_percentages || [];
  $: outcomePercentages = market?.outcome_percentages || [];
  $: isMarketClosed = market?.status?.Closed !== undefined;
  $: winningOutcomes = isMarketClosed ? market.status.Closed : [];
  $: isMarketResolved = isMarketClosed;
  $: isMarketVoided = market?.status?.Voided !== undefined;
  $: marketEndTime = market?.end_time
    ? Number(market.end_time) / 1_000_000
    : null;
  $: isPendingResolution =
    !isMarketResolved &&
    !isMarketVoided &&
    marketEndTime &&
    marketEndTime < Date.now();
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
    content="https://kongswap.io/images/predictionmarket-og.png"
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
    <button
      on:click={() => goto("/predict")}
      class="mb-4 flex items-center gap-2 px-3 -mt-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors rounded-md hover:bg-kong-bg-dark/40"
    >
      <ArrowLeft class="w-4 h-4" />
      <span class="text-sm">Back</span>
    </button>

    {#if error}
      <div class="text-center py-8 sm:py-12">
        <p class="text-kong-accent-red text-base sm:text-lg" role="alert">
          {error}
        </p>
        <button
          on:click={() => location.reload()}
          class="mt-3 sm:mt-4 px-4 py-2 bg-kong-accent-blue text-white rounded-md shadow-sm hover:shadow-md transition-shadow"
          aria-label="Reload market data">Reload Market</button
        >
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
          <!-- Market Stats Panel -->
          <MarketStats
            {totalPool}
            {betCounts}
            {timeLeft}
            {isMarketResolved}
            marketEndTime={market.end_time}
          />

          <!-- Social Share Buttons -->
          <Panel
            variant="transparent"
            className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
          >
            <div class="">
              <h3 class="text-sm font-medium text-kong-text-secondary mb-3">
                Share Market
              </h3>
              <div class="grid grid-cols-3 gap-3">
                <!-- X Button -->
                <button
                  on:click={shareToTwitter}
                  class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-black hover:bg-gray-900 text-white font-medium transition-colors"
                  aria-label="Share to X"
                >
                  <X class="w-5 h-5" />
                  <span class="text-xs">X</span>
                </button>

                <!-- Telegram Button -->
                <button
                  on:click={shareToTelegram}
                  class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#0088cc] hover:bg-[#0077b3] text-white font-medium transition-colors"
                  aria-label="Share to Telegram"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    ><path
                      d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="0"
                    /><path
                      d="M5.5 12.5l3 1.5L9 17.5l4-5"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    /><path
                      d="M9 17.5l9-9-5 1-4.65 5.48"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    /></svg
                  >
                  <span class="text-xs">Telegram</span>
                </button>

                <!-- WhatsApp Button -->
                <button
                  on:click={shareToTikTok}
                  class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#000000] hover:bg-gray-900 text-white font-medium transition-colors"
                  aria-label="Share to TikTok"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                    />
                  </svg>
                  <span class="text-xs">TikTok</span>
                </button>

                <!-- Facebook Button -->
                <button
                  on:click={shareToFacebook}
                  class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#1877F2] hover:bg-[#0E65D9] text-white font-medium transition-colors"
                  aria-label="Share to Facebook"
                >
                  <Facebook class="w-5 h-5" />
                  <span class="text-xs">Facebook</span>
                </button>

                <!-- Reddit Button -->
                <button
                  on:click={shareToReddit}
                  class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#FF4500] hover:bg-[#E03D00] text-white font-medium transition-colors"
                  aria-label="Share to Reddit"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    ><path
                      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="0"
                    /><path
                      d="M17.05 13.2c0-.2.05-.5.05-.85 0-2.8-3.11-5.05-6.95-5.05s-7 2.25-7 5.05c0 2.75 3.11 5.05 7 5.05a7.66 7.66 0 004.28-1.2 4.77 4.77 0 002.62-3z"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    /><path
                      d="M13.9 14.09a1.13 1.13 0 01-1.9 0M11.95 14.89a2.84 2.84 0 01-1.9-.7"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    /><circle
                      cx="9.25"
                      cy="13"
                      r="1.25"
                      fill="currentColor"
                    /><circle
                      cx="14.75"
                      cy="13"
                      r="1.25"
                      fill="currentColor"
                    /><path
                      d="M18.55 10.65a1.5 1.5 0 10-3 0"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    /><circle
                      cx="17.05"
                      cy="8.8"
                      r="1.25"
                      fill="currentColor"
                    /></svg
                  >
                  <span class="text-xs">Reddit</span>
                </button>

                <!-- Copy Link Button -->
                <button
                  on:click={copyLinkToClipboard}
                  class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-kong-bg-light hover:bg-kong-hover-bg-light text-kong-text-primary font-medium transition-colors"
                  aria-label="Copy Link"
                >
                  <Copy class="w-5 h-5" />
                  <span class="text-xs">Copy Link</span>
                </button>
              </div>
            </div>
          </Panel>

          <!-- Restore the simplified RecentBets -->
          <RecentBets
            bets={marketBets}
            outcomes={market?.outcomes}
            showOutcomes={true}
            maxHeight="500px"
            panelVariant="transparent"
            title="Recent Predictions"
            loading={loadingBets}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

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
