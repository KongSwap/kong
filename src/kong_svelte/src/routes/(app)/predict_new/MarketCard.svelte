<script lang="ts">
  import {
    formatCategory,
    calculatePercentage,
    formatBalance,
  } from "$lib/utils/numberFormatUtils";
  import {
    Coins,
    Calendar,
    CircleHelp,
    Folder,
    MoreVertical,
    Star,
    Dice1,
  } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { goto } from "$app/navigation";
  import AdminResolutionModal from "./AdminResolutionModal.svelte";
  import { auth } from "$lib/stores/auth";
  import { isAdmin, setMarketFeatured } from "$lib/api/predictionMarket";
  import { voidMarketViaAdmin } from "$lib/api/predictionMarket";
  import { userTokens } from "$lib/stores/userTokens";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import MarketOutcomeButton from "./MarketOutcomeButton.svelte";
  import AdminDropdownButton from "./AdminDropdownButton.svelte";

  let {
    market,
    showEndTime = true,
    openBetModal,
    onMarketResolved,
    columns = { mobile: 1, tablet: 2, desktop: 3 },
  } = $props<{
    market: any;
    showEndTime?: boolean;
    openBetModal: (market: any, outcomeIndex?: number) => void;
    onMarketResolved: () => Promise<void>;
    columns?: { mobile?: number; tablet?: number; desktop?: number };
  }>();

  // Convert local state to use $state
  let showResolutionModal = $state(false);
  let isUserAdmin = $state(false);
  let showDropdown = $state(false);

  // Check if user is admin using $effect
  $effect(() => {
    if ($auth.isConnected && $auth.account) {
      isAdmin($auth.account.owner).then((result) => {
        isUserAdmin = result;
      });
    }
  });

  // Check if market is expired but not resolved
  function isMarketExpiredUnresolved(market: any): boolean {
    if (!market) return false;
    if (market.status && "Closed" in market.status) return false;
    return BigInt(market.end_time) <= BigInt(Date.now()) * BigInt(1_000_000);
  }

  // Check if market is resolved
  function isMarketResolved(market: any): boolean {
    return market && market.status && "Closed" in market.status;
  }

  // Check if market is open
  function showResolveVoid(market: any): boolean {
    return (
      market &&
      ((market.status && "Open" in market.status) ||
        (market.status && "Pending" in market.status))
    );
  }

  // Check if market is voided
  function isMarketVoided(market: any): boolean {
    return market && market.status && "Voided" in market.status;
  }

  function isMarketPending(market: any): boolean {
    return market && market.status && "Pending" in market.status;
  }

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

      if (outcomeIndex === 0) {
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

  // Get status color based on market state
  function getMarketStatusColor(market: any): string {
    if (isMarketResolved(market)) return "bg-kong-accent-blue";
    if (isMarketVoided(market)) return "bg-kong-error";
    if (isMarketPending(market)) return "bg-kong-accent-yellow";
    if (isMarketExpiredUnresolved(market)) return "bg-indigo-400";
    return "bg-kong-success";
  }

  // Get status text based on market state
  function getMarketStatusText(market: any): string {
    if (isMarketResolved(market)) return "Resolved";
    if (isMarketVoided(market)) return "Voided";
    if (isMarketPending(market)) return "Pending";
    if (isMarketExpiredUnresolved(market)) return "Unresolved";
    return "Active";
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
    showDropdown = !showDropdown;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".admin-dropdown")) {
      showDropdown = false;
    }
  }

  // Add click outside listener
  $effect(() => {
    if (showDropdown) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });
</script>

<AdminResolutionModal
  isOpen={showResolutionModal}
  {market}
  onClose={() => (showResolutionModal = false)}
  onResolved={handleResolved}
/>

<Panel
  className="relative !bg-kong-bg-secondary !p-2 {isMarketResolved(market)
    ? 'opacity-100'
    : ''} group hover:bg-kong-bg-primary/10 transition-all duration-200 flex flex-col {market.featured
    ? '!h-[260px]'
    : '!h-[260px]'}"
>
  <!-- Card content -->
  <div class="relative flex flex-col justify-between h-full">
    {#if market.featured}
      <!-- Featured market layout -->
      <div class="flex flex-col h-full">
        <div class="px-2 pt-4 flex gap-3 items-start">
          {#if market.image_url.length != 0}
            <div class="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-black">
              <img
                src={market.image_url}
                alt="Category Icon"
                class="object-cover w-full h-full bg-black bg-blend-overlay opacity-100"
              />
            </div>
          {:else}
            <div
              class="w-12 h-12 flex-shrink-0 bg-kong-accent/10 rounded-lg bg-kong-bg-primary flex items-center justify-center"
            >
              <CircleHelp class="w-8 h-8 text-kong-bg-secondary/80" />
            </div>
          {/if}
          <button
            class="flex-1 text-left group-hover:text-kong-primary transition-colors"
            title={market.question}
            onclick={() => {
              goto(`/predict/${market.id}`);
            }}
          >
            <span
              class="font-bold text-base sm:text-lg tracking-tight block line-clamp-2 overflow-hidden text-ellipsis"
            >
              {market.question}
            </span>
          </button>
        </div>
        <!-- Outcomes section vertically centered -->
        <div class="flex-1 flex flex-col justify-center px-2">
          <div class="flex flex-col justify-center">
            {#if isYesNoMarket(market)}
              <!-- Yes/No buttons side by side -->
              <div class="h-full items-center flex gap-2 justify-center">
                {#if getYesNoIndices(market).yesIndex !== -1}
                  {@const yesIndex = getYesNoIndices(market).yesIndex}
                  <MarketOutcomeButton
                    outcome="Yes"
                    index={yesIndex}
                    {market}
                    {isWinningOutcome}
                    {isMarketResolved}
                    {isMarketExpiredUnresolved}
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
                    {isWinningOutcome}
                    {isMarketResolved}
                    {isMarketExpiredUnresolved}
                    {openBetModal}
                    isYesNo={true}
                  />
                {/if}
              </div>
            {:else}
              <div
                class="flex flex-col max-h-[135px] gap-0.5 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-kong-border"
              >
                {#each market.outcomes as outcome, i}
                  <div
                    class="relative rounded {!isMarketExpiredUnresolved(market) &&
                    !isMarketResolved(market)
                      ? 'hover:bg-kong-bg-secondary/40 cursor-pointer'
                      : ''}"
                  >
                    <MarketOutcomeButton
                      {outcome}
                      index={i}
                      {market}
                      {isWinningOutcome}
                      {isMarketResolved}
                      {isMarketExpiredUnresolved}
                      {openBetModal}
                    />
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <!-- Category and time information moved to bottom -->
        <div
          class="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 pb-2"
        >
          <div class="flex items-center gap-1">
            <span
              class="text-kong-text-secondary text-xs whitespace-nowrap flex items-center gap-1"
            >
              <TokenImages
                tokens={[
                  $userTokens.tokens.find((t) => t.address === market.token_id),
                ]}
                size={20}
              />
              {formatBalance(
                market.outcome_pools.reduce(
                  (acc, pool) => acc + Number(pool || 0),
                  0,
                ),
                8,
              )}
            </span>
            <span
              class="py-0.5 px-1.5 flex items-center gap-1 text-kong-text-secondary bg-kong-accent/10 text-kong-accent rounded text-xs font-medium"
            >
              <Folder class="w-3 h-3" />
              {formatCategory(market.category)}
            </span>
          </div>
          <div class="flex items-center justify-end gap-2">
            {#if showEndTime}
              <span
                class="flex items-center gap-1 text-kong-text-secondary text-xs whitespace-nowrap"
              >
                <Calendar class="w-3 h-3" />
                <CountdownTimer endTime={market.end_time} />
              </span>
            {/if}
            {#if isUserAdmin}
              <AdminDropdownButton
                isOpen={showDropdown}
                onToggle={(e) => {
                  e.stopPropagation();
                  toggleDropdown();
                }}
                onSetFeatured={() => {
                  handleSetFeatured(market, !market.featured);
                  showDropdown = false;
                }}
                onResolve={() => {
                  openResolutionModal(market);
                  showDropdown = false;
                }}
                onVoid={() => {
                  handleVoidMarket(market);
                  showDropdown = false;
                }}
                isFeatured={market.featured}
              />
            {/if}
          </div>
        </div>
        <!-- Card Footer -->
        {#if showResolveVoid(market)}
          <div class="px-4 py-3 border-t border-kong-border">
            <div class="text-center text-xs text-kong-text-secondary">
              Awaiting resolution
            </div>
          </div>
        {:else if isMarketResolved(market)}
          <div class="px-4 py-3 border-t border-kong-border">
            <div class="text-center text-xs text-kong-text-secondary">
              Resolved on {new Date(
                Number(market.end_time) / 1_000_000,
              ).toLocaleDateString()}
            </div>
          </div>
        {:else if isMarketVoided(market)}
          <div class="px-4 py-3 border-t border-kong-border">
            <div class="text-center text-xs text-kong-text-secondary">
              Market voided on {new Date(
                Number(market.end_time) / 1_000_000,
              ).toLocaleDateString()}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Non-featured market layout -->
      <div class="px-2 pt-4 flex gap-3 items-start">
        {#if market.image_url.length != 0}
          <div class="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-black">
            <img
              src={market.image_url}
              alt="Category Icon"
              class="object-cover w-full h-full bg-black bg-blend-overlay opacity-100"
            />
          </div>
        {:else}
          <div
            class="w-16 h-16 flex-shrink-0 bg-kong-accent/10 rounded-lg bg-kong-bg-primary flex items-center justify-center"
          >
            <Dice1 class="w-10 h-10 text-kong-bg-secondary/80" />
          </div>
        {/if}
        <button
          class="flex-1 text-left group-hover:text-kong-primary transition-colors"
          title={market.question}
          onclick={() => {
            goto(`/predict/${market.id}`);
          }}
        >
          <span
            class="font-bold text-base sm:text-lg tracking-tight block !line-clamp-2 overflow-hidden text-ellipsis"
          >
            {market.question}
          </span>
        </button>
      </div>

      <!-- Add outcomes section to non-featured cards -->
      <div class="flex-1 flex flex-col justify-center px-2">
        <div class="flex flex-col justify-center">
          {#if isYesNoMarket(market)}
            <!-- Yes/No buttons side by side -->
            <div class="h-full items-center flex gap-2 justify-center">
              {#if getYesNoIndices(market).yesIndex !== -1}
                {@const yesIndex = getYesNoIndices(market).yesIndex}
                <MarketOutcomeButton
                  outcome="Yes"
                  index={yesIndex}
                  {market}
                  {isWinningOutcome}
                  {isMarketResolved}
                  {isMarketExpiredUnresolved}
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
                  {isWinningOutcome}
                  {isMarketResolved}
                  {isMarketExpiredUnresolved}
                  {openBetModal}
                  isYesNo={true}
                />
              {/if}
            </div>
          {:else}
            <div
              class="max-h-[135px] flex flex-col gap-0.5 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-kong-border"
            >
              {#each market.outcomes as outcome, i}
                <div
                  class="relative rounded {!isMarketExpiredUnresolved(market) &&
                  !isMarketResolved(market)
                    ? 'hover:bg-kong-bg-secondary/40 cursor-pointer'
                    : ''}"
                >
                  <MarketOutcomeButton
                    {outcome}
                    index={i}
                    {market}
                    {isWinningOutcome}
                    {isMarketResolved}
                    {isMarketExpiredUnresolved}
                    {openBetModal}
                  />
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Add footer info similar to featured cards -->
      <div class="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 pb-2 mt-auto">
        <div class="flex items-center gap-1">
          <span
            class="text-kong-text-secondary text-xs whitespace-nowrap flex items-center gap-1"
          >
            <TokenImages
              tokens={[
                $userTokens.tokens.find((t) => t.address === market.token_id),
              ]}
              size={20}
            />
            {formatBalance(
              market.outcome_pools.reduce(
                (acc, pool) => acc + Number(pool || 0),
                0,
              ),
              8,
            )}
          </span>
          <span
            class="py-0.5 px-1.5 flex items-center gap-1 text-kong-text-secondary bg-kong-accent/10 text-kong-accent rounded text-xs font-medium"
          >
            <Folder class="w-3 h-3" />
            {formatCategory(market.category)}
          </span>
        </div>
        <div class="flex items-center justify-end gap-2">
          {#if showEndTime}
            <span
              class="flex items-center gap-1 text-kong-text-secondary text-xs whitespace-nowrap"
            >
              <Calendar class="w-3 h-3" />
              <CountdownTimer endTime={market.end_time} />
            </span>
          {/if}
          {#if isUserAdmin}
            <AdminDropdownButton
              isOpen={showDropdown}
              onToggle={(e) => {
                e.stopPropagation();
                toggleDropdown();
              }}
              onSetFeatured={() => {
                handleSetFeatured(market, !market.featured);
                showDropdown = false;
              }}
              onResolve={() => {
                openResolutionModal(market);
                showDropdown = false;
              }}
              onVoid={() => {
                handleVoidMarket(market);
                showDropdown = false;
              }}
              isFeatured={market.featured}
            />
          {/if}
        </div>
      </div>
    {/if}

    <!-- Status badge (moved to top right) -->
    <div class="absolute top-0 right-0 flex items-center gap-1">
      <div
        class="px-1.5 py-0.5 rounded text-xs text-kong-bg-secondary {getMarketStatusColor(
          market,
        )}"
      >
        {getMarketStatusText(market)}
      </div>
      {#if market.featured}
        <div
          class="px-1.5 h-5 rounded text-xs bg-kong-accent-yellow text-kong-text-primary/90 flex items-center gap-1"
        >
          <Star class="w-3 h-3" stroke="" strokeWidth="1" fill="currentColor" />
        </div>
      {/if}
    </div>
  </div>
</Panel>

<style>
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

  /* Title text clamp to 2 lines */
  /* Use Tailwind's line-clamp utility instead */
</style>
