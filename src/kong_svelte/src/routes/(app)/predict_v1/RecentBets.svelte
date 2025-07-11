<script lang="ts" runes>
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { onDestroy, onMount } from "svelte";

  const props = $props<{
    bets?: any[];
    outcomes?: string[] | null;
    title?: string;
    maxHeight?: string;
    showOutcomes?: boolean;
    className?: string;
    panelVariant?: "transparent" | "solid";
    loading?: boolean;
  }>();

  // Set default values for props in non-reactive way
  let bets = $state(props.bets ?? []);
  let outcomes = $state(props.outcomes ?? null);
  let title = $state(props.title ?? "Recent Predictions");
  let maxHeight = $state(props.maxHeight ?? "300px");
  let showOutcomes = $state(props.showOutcomes ?? true);
  let className = $state(props.className ?? "");
  let panelVariant = $state(props.panelVariant ?? "transparent");
  let loading = $state(props.loading ?? false);

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

  // Only update when props.bets changes
  $effect(() => {
    if (!props.bets) return;

    // Use a simple approach to just set the visibleBets directly
    visibleBets = [...props.bets];
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
  <h2 class="text-sm font-medium px-4 pt-4">{title}</h2>
  <div class="max-h-[{maxHeight}] overflow-y-auto scrollbar-thin relative">
    {#if visibleBets.length > 0}
      {#each visibleBets as bet}
        {@const betData = getBetData(bet)}
        {@const betId = getBetId(bet)}
        <div
          class="p-4 py-3 border-b border-kong-border/50 last:border-0 hover:bg-kong-bg-dark/30 transition-colors group rounded-md"
        >
          <div class="flex items-start gap-3">
            <!-- User Avatar -->
            <img
              src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${betData.user?.toString() || ""}&size=32`}
              alt="User avatar"
              class="w-8 h-8 rounded-full bg-kong-bg-secondary flex-shrink-0
                     border border-kong-border/20 shadow-sm"
            />

            <!-- Content -->
            <div class="flex-1">
              <div class="flex items-center justify-between">
                {#if showOutcomes && outcomes}
                  <div class="text-kong-text-primary font-medium">
                    {outcomes[Number(betData.outcome_index)]}
                  </div>
                {:else if betData.market}
                  <div class="flex flex-col flex-1 min-w-0">
                    <button
                      class="text-kong-text-primary font-medium line-clamp-2 text-left group-hover:text-kong-accent-blue transition-colors w-full relative p-0 m-0 appearance-none border-0 focus:outline-none bg-transparent"
                      on:click={() => goto(`/predict_v1/${betData.market.id}`)}
                    >
                      <span class="block pr-6">{betData.market.question}</span>
                    </button>
                    <div class="flex items-center gap-1">
                      <span class="text-kong-text-accent-green">
                        {betData.market.outcomes[Number(betData.outcome_index)]}
                      </span>
                    </div>
                  </div>
                {/if}
                <div class="flex items-center gap-1 ml-4 flex-shrink-0">
                  <span class="font-medium text-kong-text-accent-green">
                    {formatBalance(Number(betData.amount || 0), 8)}
                  </span>
                  <span class="text-xs text-kong-text-secondary">KONG</span>
                </div>
              </div>
              <div class="flex justify-between w-full items-center mt-2">
                <span class="text-xs text-kong-text-secondary">
                  {new Date(
                    Number(betData.timestamp) / 1_000_000,
                  ).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span class="text-xs text-kong-text-secondary/80">
                  by <span class="font-medium text-kong-text-accent-green"
                    >{betData.user
                      ? betData.user.toString().slice(0, 10)
                      : "Unknown"}...</span
                  >
                </span>
              </div>
            </div>
          </div>
        </div>
      {/each}
    {:else if loading}
      <div transition:fade class="space-y-3 px-4">
        {#each Array(3) as _}
          <div class="animate-pulse flex items-start gap-3 py-3">
            <!-- Avatar skeleton -->
            <div
              class="w-8 h-8 rounded-full bg-kong-bg-light/30 flex-shrink-0"
            ></div>

            <!-- Content skeleton -->
            <div class="flex-1">
              <div class="h-5 bg-kong-bg-light/30 rounded w-3/4 mb-2"></div>
              <div class="h-4 bg-kong-bg-light/30 rounded w-1/2"></div>
              <div class="flex justify-between items-center mt-2">
                <div class="h-3 bg-kong-bg-light/30 rounded w-24"></div>
                <div class="h-3 bg-kong-bg-light/30 rounded w-20"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div
        class="flex flex-col items-center justify-center py-8 px-4 text-center"
      >
        <div
          class="w-16 h-16 mb-4 rounded-full bg-kong-bg-dark/50 flex items-center justify-center"
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
