<script lang="ts">
  import {
    toShortNumber,
  } from "$lib/utils/numberFormatUtils";
  import {
    Calendar,
    CircleHelp,
    Star,
    Dice1,
    Gift,
    MessageSquare,
  } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { goto } from "$app/navigation";
  import AdminResolutionModal from "./AdminResolutionModal.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { setMarketFeatured } from "$lib/api/predictionMarket";
  import { voidMarketViaAdmin } from "$lib/api/predictionMarket";
  import { userTokens } from "$lib/stores/userTokens";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import MarketOutcomeButton from "./MarketOutcomeButton.svelte";
  import AdminDropdownButton from "./AdminDropdownButton.svelte";
  import { auth } from "$lib/stores/auth";

  let {
    market,
    showEndTime = true,
    openBetModal,
    onMarketResolved,
    hasClaim = false,
    isDropdownOpen = false,
    onDropdownToggle,
    isUserAdmin = false,
    commentCount = 0,
  } = $props<{
    market: any;
    showEndTime?: boolean;
    openBetModal: (market: any, outcomeIndex?: number) => void;
    onMarketResolved: () => Promise<void>;
    hasClaim?: boolean;
    isDropdownOpen?: boolean;
    onDropdownToggle?: () => void;
    isUserAdmin?: boolean;
    commentCount?: number;
  }>();

  // Convert local state to use $state
  let showResolutionModal = $state(false);
  let imageError = $state(false);
  // Remove local dropdown state - now managed by parent

  // Check if current user is the market creator
  let isCurrentUserCreator = $derived(
    market && $auth.account?.owner && market.creator?.toText() === $auth.account.owner
  );

  // Consolidated market status helpers
  const marketStatus = {
    isExpiredUnresolved: (market: any): boolean => {
      if (!market) return false;
      if (market.status && "Closed" in market.status) return false;
      return BigInt(market.end_time) <= BigInt(Date.now()) * BigInt(1_000_000);
    },
    isResolved: (market: any): boolean => {
      return market && market.status && "Closed" in market.status;
    },
    isVoided: (market: any): boolean => {
      return market && market.status && "Voided" in market.status;
    },
    isPending: (market: any): boolean => {
      return market && market.status && "PendingActivation" in market.status;
    },
    isOpen: (market: any): boolean => {
      return market && market.status && "Active" in market.status;
    },
    canResolveOrVoid: (market: any): boolean => {
      return (
        market &&
        (marketStatus.isOpen(market) || marketStatus.isPending(market))
      );
    },
  };

  // Determine if outcomes should be shown
  let shouldShowOutcomes = $derived(!marketStatus.isPending(market) || isCurrentUserCreator);
  
  // Helper function to check if an outcome is a winner
  function isWinningOutcome(market: any, outcomeIndex: number): boolean {
    try {
      if (market.winning_outcomes) {
        return market.winning_outcomes.some(
          (winningIndex: any) => Number(winningIndex) === outcomeIndex,
        );
      }

      if (market.market) {
        if (market.market.status && typeof market.market.status === "object") {
          const status = market.market.status;

          if ("Closed" in status && Array.isArray(status.Closed)) {
            return status.Closed.some(
              (winningIndex: any) => Number(winningIndex) === outcomeIndex,
            );
          }
        }

        if (market.market.winning_outcomes) {
          return market.market.winning_outcomes.some(
            (winningIndex: any) => Number(winningIndex) === outcomeIndex,
          );
        }
      }

      if (market.status && typeof market.status === "object") {
        if ("Closed" in market.status && Array.isArray(market.status.Closed)) {
          return market.status.Closed.some(
            (winningIndex: any) => Number(winningIndex) === outcomeIndex,
          );
        }
      }

      // Only warn if the market is actually closed (not voided or expired unresolved)
      if (outcomeIndex === 0 && market.status && "Closed" in market.status) {
        console.warn(
          "Could not determine winning outcome. Market structure:",
          market,
        );
      }

      return false;
    } catch (error) {
      console.error("Error in isWinningOutcome:", error, market);
      return false;
    }
  }

  function openResolutionModal(market: any) {
    showResolutionModal = true;
  }

  async function handleResolved() {
    await onMarketResolved();
  }

  async function handleVoidMarket(market: any) {
    if (
      !confirm(`Are you sure you want to void the market "${market.question}"?`)
    ) {
      return;
    }

    try {
      await voidMarketViaAdmin(BigInt(market.id));
      await onMarketResolved();
    } catch (error) {
      console.error("Failed to void market:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async function handleSetFeatured(market: any, featured: boolean) {
    try {
      await setMarketFeatured(BigInt(market.id), featured);
      await onMarketResolved();
    } catch (error) {
      console.error("Failed to set market featured status:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Get status color and text
  function getMarketStatusInfo(market: any): { color: string; text: string } {
    if (marketStatus.isResolved(market))
      return {
        color: "bg-kong-bg-secondary text-kong-text-secondary",
        text: "Resolved",
      };
    if (marketStatus.isVoided(market))
      return { color: "bg-kong-error/10 text-kong-error", text: "Voided" };
    if (marketStatus.isPending(market))
      return {
        color: "bg-kong-accent-yellow/10 text-kong-accent-yellow",
        text: "Pending",
      };
    if (marketStatus.isExpiredUnresolved(market))
      return { color: "bg-indigo-400/10 text-indigo-400", text: "Unresolved" };
    return { color: "bg-kong-success/10 text-kong-success", text: "Active" };
  }

  // Check if it's a Yes/No market
  function isYesNoMarket(market: any): boolean {
    return (
      market.outcomes.length === 2 &&
      (market.outcomes[0].toLowerCase() === "yes" ||
        market.outcomes[0].toLowerCase() === "no") &&
      (market.outcomes[1].toLowerCase() === "yes" ||
        market.outcomes[1].toLowerCase() === "no")
    );
  }

  // Get the index of Yes and No outcomes
  function getYesNoIndices(market: any): { yesIndex: number; noIndex: number } {
    const yesIndex = market.outcomes.findIndex(
      (outcome: string) => outcome.toLowerCase() === "yes",
    );
    const noIndex = market.outcomes.findIndex(
      (outcome: string) => outcome.toLowerCase() === "no",
    );
    return { yesIndex, noIndex };
  }

  function toggleDropdown() {
    onDropdownToggle?.();
  }

  // Click outside handling is now managed by parent component

  // Reactive status info
  const statusInfo = $derived(getMarketStatusInfo(market));

  // Handle image load error
  function handleImageError() {
    imageError = true;
  }

  // Validate image URL
  function isValidImageUrl(url: string): boolean {
    if (!url || url.length === 0) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
</script>

<!-- Snippet Components -->
{#snippet marketIcon()}
  {#if isValidImageUrl(market.image_url) && !imageError}
    <div class="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-kong-bg-primary">
      <img
        src={market.image_url}
        alt={market.category || "Market"}
        class="object-cover w-full h-full"
        loading="lazy"
        onerror={handleImageError}
      />
    </div>
  {:else}
    <div
      class="w-10 h-10 flex-shrink-0 bg-kong-bg-primary rounded-lg flex items-center justify-center"
    >
      {#if market.category === "Sports"}
        <Gift class="w-5 h-5 text-kong-text-secondary/60" />
      {:else if market.category === "Crypto"}
        <Star class="w-5 h-5 text-kong-text-secondary/60" />
      {:else if market.featured}
        <CircleHelp class="w-5 h-5 text-kong-text-secondary/60" />
      {:else}
        <Dice1 class="w-5 h-5 text-kong-text-secondary/60" />
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet marketHeader()}
  <div class="flex gap-2 items-start">
    {@render marketIcon()}
    <div class="flex-1 min-w-0 pr-8">
      <h3
        class="font-semibold leading-tight line-clamp-2 text-kong-text-primary"
        title={market.question}
      >
        {market.question}
      </h3>
    </div>
  </div>
{/snippet}

{#snippet marketOutcomes()}
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden rounded-kong-roundness mt-2 p-1">
    {#if shouldShowOutcomes}
      {#if isYesNoMarket(market)}
        <!-- Yes/No buttons side by side, centered vertically -->
        <div class="flex-1 flex items-center">
          <div class="w-full flex gap-2 justify-center">
            {#if getYesNoIndices(market).yesIndex !== -1}
              {@const yesIndex = getYesNoIndices(market).yesIndex}
              <MarketOutcomeButton
                outcome="Yes"
                index={yesIndex}
                {market}
                {openBetModal}
                isYesNo={true}
              />
            {/if}
            {#if getYesNoIndices(market).noIndex !== -1}
              {@const noIndex = getYesNoIndices(market).noIndex}
              <MarketOutcomeButton
                outcome="No"
                index={noIndex}
                {market}
                {openBetModal}
                isYesNo={true}
              />
            {/if}
          </div>
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-kong-border">
          <div class="flex flex-col gap-1">
            {#each market.outcomes as outcome, i}
              <MarketOutcomeButton
                {outcome}
                index={i}
                {market}
                {openBetModal}
              />
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      <!-- Show pending activation message for non-creators -->
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center px-4 py-2">
          <p class="text-sm text-kong-text-secondary">
            {#if marketStatus.isPending(market)}
              Activating
            {:else}
              Outcomes hidden
            {/if}
          </p>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet marketFooter()}
  <div class="mt-auto pt-2 border-t border-kong-border/20 flex-shrink-0">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        {#if !marketStatus.isResolved(market)}
          <span
            class="px-1.5 py-0.5 rounded text-[10px] font-medium {statusInfo.color}"
          >
            {statusInfo.text}
          </span>
        {/if}
        <span
          class="text-kong-text-secondary text-xs whitespace-nowrap flex items-center gap-1"
        >
          <TokenImages
            tokens={[
              $userTokens.tokens.find((t) => t.address === market.token_id),
            ].filter(Boolean)}
            size={16}
          />
          {toShortNumber(
            market.outcome_pools.reduce(
              (acc, pool) => acc + Number(pool || 0),
              0,
            ),
            $userTokens.tokens.find((t) => t.address === market.token_id) || undefined
          )}
        </span>
        <span
          class="text-kong-text-secondary text-xs whitespace-nowrap flex items-center gap-1"
        >
          <MessageSquare class="w-3 h-3" />
          {commentCount}
        </span>
      </div>
      <div class="flex items-center gap-2">
        {#if showEndTime}
          <span
            class="flex items-center gap-1 text-kong-text-secondary text-xs whitespace-nowrap"
          >
            <Calendar class="w-3 h-3" />
            {#if marketStatus.isResolved(market)}
              <span>Ended</span>
            {:else if marketStatus.isVoided(market)}
              <span>Voided</span>
            {:else}
              <CountdownTimer endTime={market.end_time} showSeconds={false} />
            {/if}
          </span>
        {/if}
        {#if isUserAdmin}
          <AdminDropdownButton
            isOpen={isDropdownOpen}
            onToggle={(e) => {
              e.stopPropagation();
              toggleDropdown();
            }}
            onSetFeatured={() => {
              handleSetFeatured(market, !market.featured);
              onDropdownToggle?.();
            }}
            onResolve={() => {
              openResolutionModal(market);
              onDropdownToggle?.();
            }}
            onVoid={() => {
              handleVoidMarket(market);
              onDropdownToggle?.();
            }}
            isFeatured={market.featured}
          />
        {/if}
      </div>
    </div>
  </div>
{/snippet}

<AdminResolutionModal
  isOpen={showResolutionModal}
  {market}
  onClose={() => (showResolutionModal = false)}
  onResolved={handleResolved}
/>

<Card
  className="relative !p-0 group transition-all duration-200 h-[230px] overflow-hidden {(marketStatus.isResolved(
    market,
  ) || marketStatus.isVoided(market)) && !hasClaim
    ? 'grayscale opacity-40 hover:opacity-60'
    : marketStatus.isPending(market) && !isCurrentUserCreator
    ? 'opacity-60 hover:opacity-80'
    : ''}"
  onClick={() => goto(`/predict/${market.id}`)}
>
  <!-- Card content -->
  <div class="relative flex flex-col h-full p-3">
    <div class="flex flex-col h-full min-h-0">
      <!-- Market header -->
      {#if market.featured}
        <div class="mb-1 flex-shrink-0">
          {@render marketHeader()}
        </div>
      {:else}
        <div class="flex-shrink-0">
          {@render marketHeader()}
        </div>
      {/if}

      <!-- Market outcomes -->
      {@render marketOutcomes()}

      <!-- Market footer -->
      {@render marketFooter()}
    </div>

    <!-- Featured badge positioned at top right -->
    {#if market.featured && !marketStatus.isResolved(market)}
      <div class="absolute top-2 right-2">
        <div
          class="px-1.5 py-0.5 rounded text-[10px] bg-kong-accent-yellow text-black font-medium flex items-center gap-0.5"
        >
          <Star class="w-2.5 h-2.5" fill="currentColor" />
        </div>
      </div>
    {/if}

    <!-- Resolved overlay - show text only when not hovered -->
    {#if marketStatus.isResolved(market) && !hasClaim}
      <div
        class="absolute inset-0 flex items-center justify-center z-10 bg-black/30 {hasClaim ? 'backdrop-blur-sm' : 'backdrop-blur-[1px] group-hover:backdrop-blur-none'} rounded-kong-roundness transition-all duration-200 group-hover:opacity-0"
      >
        <span class="text-white/50 font-semibold text-lg">RESOLVED</span>
      </div>
    {/if}
    
    <!-- Voided overlay - show text only when not hovered -->
    {#if marketStatus.isVoided(market)}
      <div
        class="absolute inset-0 flex items-center justify-center z-10 bg-black/30 backdrop-blur-[1px] group-hover:backdrop-blur-none rounded-kong-roundness transition-all duration-200 group-hover:opacity-0"
      >
        <span class="text-white/50 font-semibold text-lg">VOIDED</span>
      </div>
    {/if}
    
    <!-- Claim overlay for resolved markets with rewards -->
    {#if marketStatus.isResolved(market) && hasClaim}
      <div
        class="absolute inset-0 flex items-center justify-center z-10 bg-black/30 backdrop-blur-sm rounded-kong-roundness"
      >
        <ButtonV2
          theme="accent-green"
          variant="shine"
          size="lg"
          onclick={(e) => {
            e.stopPropagation();
            goto(`/predict/${market.id}`);
          }}
          className="shadow-xl hover:scale-102"
        >
          <div class="flex items-center gap-2">
            <Gift class="w-5 h-5" />
            <span>Claim Rewards</span>
          </div>
        </ButtonV2>
      </div>
    {/if}
  </div>
</Card>

<style lang="postcss">
  /* Smooth hover transitions */
  .group\/outcome:hover :global(.bg-kong-success\/40) {
    @apply bg-kong-success/60;
  }

  /* Custom scrollbar styling */
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-track-transparent::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thumb-kong-border::-webkit-scrollbar-thumb {
    background-color: var(--kong-border, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
  }

  .scrollbar-thumb-kong-border::-webkit-scrollbar-thumb:hover {
    background-color: var(--kong-border, rgba(255, 255, 255, 0.2));
  }
</style>
