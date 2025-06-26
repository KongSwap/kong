<script lang="ts">
  import Card from "$lib/components/common/Card.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import { fade, fly } from "svelte/transition";
  import { onDestroy, onMount } from "svelte";
    import { Clock } from "lucide-svelte";

  let {
    bets = [],
    outcomes = null,
    title = "Recent Predictions",
    maxHeight = "400px",
    showOutcomes = true,
    className = "",
    loading = false,
    tokenSymbol = "KONG"
  } = $props<{
    bets?: any[];
    outcomes?: string[] | null;
    title?: string;
    maxHeight?: string;
    showOutcomes?: boolean;
    className?: string;
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

  function formatAddress(address: string): string {
    if (!address) return "Unknown";
    const str = address.toString();
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(Number(timestamp) / 1_000_000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
    }
  }
</script>

<Card hasHeader={true} className={className}>
  <svelte:fragment slot="header">
    <div class="flex items-center gap-2">
      <Clock class="w-5 h-5 text-kong-text-secondary" />
      <h2 class="text-base font-semibold text-kong-text-primary">{title}</h2>
    </div>
  </svelte:fragment>
  
  <div class="max-h-[{maxHeight}] overflow-y-auto scrollbar-thin relative">
    {#if visibleBets.length > 0}
      <div class="divide-y divide-kong-border/10">
        {#each visibleBets as bet, i}
          {@const betData = getBetData(bet)}
          {@const betId = getBetId(bet)}
          <div
            in:fly={{ y: 10, duration: 200, delay: i * 30 }}
            class="px-4 py-2 hover:bg-kong-bg-primary/10 transition-all duration-150 group cursor-pointer"
            onclick={() => betData.market && goto(`/predict/${betData.market.id}`)}
          >
            <div class="flex items-center gap-3">
              {#if showOutcomes && outcomes}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-kong-success/10 text-kong-success whitespace-nowrap">
                      {outcomes[Number(betData.outcome_index)]}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5 text-xs text-kong-text-secondary">
                    <span>{formatAddress(betData.user?.toString() || "")}</span>
                    <span>•</span>
                    <span>{formatTimestamp(betData.timestamp)}</span>
                  </div>
                </div>
              {:else if betData.market}
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium text-kong-text-primary line-clamp-1 group-hover:text-kong-accent-blue transition-colors">
                    {betData.market.question}
                  </h3>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-kong-success/10 text-kong-success whitespace-nowrap">
                      {betData.market.outcomes[Number(betData.outcome_index)]}
                    </span>
                    <span class="text-xs text-kong-text-secondary">{formatAddress(betData.user?.toString() || "")}</span>
                    <span class="text-xs text-kong-text-secondary">•</span>
                    <span class="text-xs text-kong-text-secondary">{formatTimestamp(betData.timestamp)}</span>
                  </div>
                </div>
              {/if}
              <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                <div class="text-right w-20">
                  <div class="text-sm font-semibold text-kong-success">
                    {formatBalance(Number(betData.amount || 0), 8)}
                  </div>
                  <div class="text-xs text-kong-text-secondary">
                    {tokenSymbol}
                  </div>
                </div>
                {#if betData.market}
                  <svg class="w-3.5 h-3.5 text-kong-text-secondary/30 group-hover:text-kong-accent-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if loading}
      <div class="divide-y divide-kong-border/10">
        {#each Array(5) as _, i}
          <div in:fade={{ delay: i * 50 }} class="px-4 py-2 animate-pulse">
            <div class="flex items-center justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <div class="h-3.5 bg-kong-bg-secondary/30 rounded w-2/3"></div>
                  <div class="h-3 bg-kong-bg-secondary/30 rounded w-16"></div>
                </div>
                <div class="h-3 bg-kong-bg-secondary/30 rounded w-1/3"></div>
              </div>
              <div class="h-4 bg-kong-bg-secondary/30 rounded w-20"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div
        in:fade
        class="flex flex-col items-center justify-center py-12 px-4 text-center"
      >
        <div
          class="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-kong-bg-secondary/50 to-kong-bg-primary/50 flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-10 h-10 text-kong-text-secondary/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-kong-text-primary mb-1">
          No predictions yet
        </h3>
        <p class="text-sm text-kong-text-secondary/70 max-w-xs">
          Be the first to make a prediction on this market
        </p>
      </div>
    {/if}
  </div>
</Card>

<style lang="postcss" scoped>
  .scrollbar-thin {
    overflow-y: auto !important;
    padding: 1px;
    transform: translateZ(0);
    scrollbar-width: thin;
    
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background-color: rgb(var(--kong-border) / 0.3);
      border-radius: 2px;
      
      &:hover {
        background-color: rgb(var(--kong-border) / 0.5);
      }
    }
  }
</style>
