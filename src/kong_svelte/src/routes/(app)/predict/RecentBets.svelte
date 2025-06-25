<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { onDestroy, onMount } from "svelte";

  let {
    bets = [],
    outcomes = null,
    title = "Recent Predictions",
    maxHeight = "300px",
    showOutcomes = true,
    className = "",
    panelVariant = "transparent",
    loading = false,
    tokenSymbol = "KONG"
  } = $props<{
    bets?: any[];
    outcomes?: string[] | null;
    title?: string;
    maxHeight?: string;
    showOutcomes?: boolean;
    className?: string;
    panelVariant?: "transparent" | "solid";
    loading?: boolean;
    tokenSymbol?: string;
  }>();

  // Store visible bets to avoid animation flashes
  let visibleBets = $state<any[]>([]);

  // Simple state for animation
  let animatingBetIds = $state<Set<string>>(new Set());

  // Helper function to convert any value to string safely
  function safeToString(value: any): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "bigint") return value.toString();
    return String(value);
  }

  // Helper to get unique ID for a bet
  function getBetId(bet: any): string {
    const data = getBetData(bet);
    return `${safeToString(data.timestamp)}-${safeToString(data.user)}`;
  }

  // Process bets on component mount and when they change
  onMount(() => {
    // Initial setup
    if (bets && bets.length) {
      visibleBets = [...bets];
    }
  });

  // Only update when bets prop changes
  $effect(() => {
    if (!bets) return;

    // Use a simple approach to just set the visibleBets directly
    visibleBets = [...bets];
  });

  function getBetData(bet: any) {
    if (bet.bet && bet.market) {
      return {
        timestamp: bet.bet.timestamp,
        outcome_index: bet.bet.outcome_index,
        amount: bet.bet.amount,
        user: bet.bet.user,
        market: bet.market,
      };
    }
    return {
      timestamp: bet.timestamp,
      outcome_index: bet.outcome_index,
      amount: bet.amount,
      user: bet.user,
      market: null,
    };
  }
</script>

<Panel variant={panelVariant} {className} height={maxHeight} unpadded>
  <h2 class="text-sm text-kong-text-secondary font-medium px-4 pt-4">{title}</h2>
  <div class="max-h-[{maxHeight}] overflow-y-auto scrollbar-thin relative">
    {#if visibleBets.length > 0}
      {#each visibleBets as bet}
        {@const betData = getBetData(bet)}
        {@const betId = getBetId(bet)}
        <div
          class="flex p-4 flex-col py-3 border-b border-kong-border/50 last:border-0 hover:bg-kong-bg-primary/30 transition-colors group rounded-md"
        >
          <div class="flex items-center justify-between">
            {#if showOutcomes && outcomes}
              <div class="text-kong-text-primary font-medium">
                {outcomes[Number(betData.outcome_index)]}
              </div>
            {:else if betData.market}
              <div class="flex flex-col flex-1 min-w-0">
                <button
                  class="text-kong-text-primary font-medium line-clamp-2 text-left group-hover:text-kong-accent-blue transition-colors w-full relative p-0 m-0 appearance-none border-0 focus:outline-none bg-transparent"
                  onclick={() => goto(`/predict/${betData.market.id}`)}
                >
                  <span class="block pr-6">{betData.market.question}</span>
                </button>
                <div class="flex items-center gap-1">
                  <span class="text-kong-success">
                    {betData.market.outcomes[Number(betData.outcome_index)]}
                  </span>
                </div>
              </div>
            {/if}
            <div class="flex items-center gap-1 ml-4 flex-shrink-0">
              <span class="font-medium text-kong-success">
                {formatBalance(Number(betData.amount || 0), 8)}
              </span>
              <span class="text-xs text-kong-text-secondary">{tokenSymbol}</span>
            </div>
          </div>
          <div class="flex justify-between w-full items-center mt-2">
            <span class="text-xs text-kong-text-secondary">
              {new Date(Number(betData.timestamp) / 1_000_000).toLocaleString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </span>
            <span class="text-xs text-kong-text-secondary/80">
              by <span class="font-medium text-kong-success"
                >{betData.user
                  ? betData.user.toString().slice(0, 10)
                  : "Unknown"}...</span
              >
            </span>
          </div>
        </div>
      {/each}
    {:else if loading}
      <div transition:fade class="space-y-3 px-4">
        {#each Array(3) as _}
          <div class="animate-pulse">
            <div class="h-5 bg-kong-bg-secondary/30 rounded w-3/4 mb-2"></div>
            <div class="h-4 bg-kong-bg-secondary/30 rounded w-1/2"></div>
            <div class="flex justify-between items-center mt-2">
              <div class="h-3 bg-kong-bg-secondary/30 rounded w-24"></div>
              <div class="h-3 bg-kong-bg-secondary/30 rounded w-20"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div
        class="flex flex-col items-center justify-center py-8 px-4 text-center"
      >
        <div
          class="w-16 h-16 mb-4 rounded-full bg-kong-bg-primary/50 flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-8 h-8 text-kong-text-secondary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 class="text-kong-text-secondary/80 font-medium mb-1">
          No bets yet
        </h3>
        <p class="text-sm text-kong-text-secondary/60">
          Be the first one to place a bet!
        </p>
      </div>
    {/if}
  </div>
</Panel>

<style lang="postcss" scoped>
  .scrollbar-thin {
    overflow-y: auto !important;
    padding: 1px;
    transform: translateZ(0);
  }

  .scrollbar-thin {
    scrollbar-width: thin;
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgb(var(--kong-border) / 0.5);
      border-radius: 3px;
    }
  }
</style>
