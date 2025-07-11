<script lang="ts">
  import Card from "$lib/components/common/Card.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import { Clock, History } from "lucide-svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens/TokenApiClient";

  let {
    bets = [],
    outcomes = null,
    title = "Recent Predictions",
    maxHeight = "400px",
    showOutcomes = true,
    className = "",
    loading = false,
  } = $props<{
    bets?: any[];
    outcomes?: string[] | null;
    title?: string;
    maxHeight?: string;
    showOutcomes?: boolean;
    className?: string;
    loading?: boolean;
  }>();

  // Store visible bets to avoid animation flashes
  let visibleBets = $state<any[]>([]);

  // Store fetched tokens for proper formatting
  let fetchedTokens = $state<Map<string, Kong.Token>>(new Map());

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

  // Fetch tokens for all bets
  async function fetchBetTokens(bets: any[]) {
    if (!bets || bets.length === 0) return;

    // Get unique token IDs from bets
    const tokenIds = new Set<string>();
    bets.forEach((bet) => {
      const betData = getBetData(bet);
      const tokenId = betData.token_id || betData.market?.token_id;
      if (tokenId) {
        tokenIds.add(tokenId);
      }
    });

    if (tokenIds.size === 0) return;

    try {
      // Fetch all tokens at once
      const tokens = await fetchTokensByCanisterId(Array.from(tokenIds));

      // Update the fetchedTokens map
      const newMap = new Map(fetchedTokens);
      tokens.forEach((token) => {
        if (token.address) {
          newMap.set(token.address, token);
        }
      });
      fetchedTokens = newMap;
    } catch (error) {
      console.error("Error fetching bet tokens:", error);
    }
  }

  // Process bets on component mount and when they change
  onMount(() => {
    // Initial setup
    if (bets && bets.length) {
      visibleBets = [...bets];
      fetchBetTokens(bets);
    }
  });

  // Only update when bets prop changes
  $effect(() => {
    if (!bets) return;

    // Use a simple approach to just set the visibleBets directly
    visibleBets = [...bets];

    // Fetch tokens for the new bets
    fetchBetTokens(bets);
  });

  function getBetData(bet: any) {
    if (bet.bet && bet.market) {
      return {
        timestamp: bet.bet.timestamp,
        outcome_index: bet.bet.outcome_index,
        amount: bet.bet.amount,
        user: bet.bet.user,
        market: bet.market,
        token_id: bet.bet.token_id || bet.market.token_id,
      };
    }
    return {
      timestamp: bet.timestamp,
      outcome_index: bet.outcome_index,
      amount: bet.amount,
      user: bet.user,
      market: bet.market || null,
      token_id: bet.token_id || null,
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
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  }

  function getFormattedTime(timestamp: number): string {
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTokenData(betData: any): Kong.Token | null {
    const tokenId = betData.token_id || betData.market?.token_id;
    if (!tokenId) return null;

    // First check fetchedTokens map
    const fetchedToken = fetchedTokens.get(tokenId);
    if (fetchedToken) return fetchedToken;

    // Fallback to userTokens store
    return $userTokens.tokens.find((t) => t.address === tokenId) || null;
  }

  function getTokenSymbol(betData: any): string {
    // Try to get the token from the bet data
    const token = getTokenData(betData);
    if (token) {
      return token.symbol;
    }

    // Default to KONG if we can't find the token
    return "KONG";
  }

  function getTokenDecimals(betData: any): number {
    const token = getTokenData(betData);
    return token?.decimals || 8; // Default to 8 decimals if not found
  }
</script>

<Card hasHeader={true} className="{className} flex flex-col min-h-[200px]">
  <svelte:fragment slot="header">
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2">
        <Clock class="w-5 h-5 text-kong-text-secondary" />
        <h2 class="text-base font-semibold text-kong-text-primary">{title}</h2>
      </div>
      <div class="flex items-center gap-3">
        {#if !showOutcomes}
          <button
            onclick={() => goto("/predict/history")}
            class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                   text-kong-text-secondary hover:text-kong-text-primary
                   bg-kong-bg-primary hover:bg-kong-bg-tertiary
                   border border-kong-border/20 hover:border-kong-border/40
                   transition-all duration-200"
            title="View your prediction history"
          >
            <History class="w-3 h-3" />
            <span>History</span>
          </button>
        {/if}
      </div>
    </div>
  </svelte:fragment>

  <div
    class="overflow-y-auto scrollbar-thin relative flex-1"
    style={maxHeight !== "100%" ? `max-height: ${maxHeight}` : ""}
  >
    {#if visibleBets.length > 0}
      <div class="divide-y divide-kong-border/10">
        {#each visibleBets as bet, i}
          {@const betData = getBetData(bet)}
          {@const betId = getBetId(bet)}
          <div
            in:fly={{ y: 10, duration: 200, delay: i * 30 }}
            class="{showOutcomes
              ? 'px-4 py-3'
              : 'px-3 py-2'} hover:bg-kong-bg-primary/20 transition-all duration-150 group cursor-pointer"
            onclick={() =>
              betData.market && goto(`/predict/${betData.market.id}`)}
          >
            <div class="flex items-start gap-3">
              <!-- Market Image or User Avatar -->
              {#if !showOutcomes && betData.market?.image_url}
                <img
                  src={betData.market.image_url}
                  alt={betData.market.question}
                  class="w-8 h-8 rounded bg-kong-bg-secondary flex-shrink-0
                         border border-kong-border/20 shadow-sm object-cover"
                  onerror={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.onerror = null;
                    img.src = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${betData.user?.toString() || ""}&size=32`;
                  }}
                />
              {:else}
                <img
                  src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${betData.user?.toString() || ""}&size=${showOutcomes && outcomes ? "40" : "32"}`}
                  alt="User avatar"
                  class="{showOutcomes && outcomes
                    ? 'w-10 h-10'
                    : 'w-8 h-8'} rounded-full bg-kong-bg-secondary flex-shrink-0
                         border border-kong-border/20 shadow-sm"
                />
              {/if}

              <!-- Content -->
              {#if showOutcomes && outcomes}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-medium text-kong-text-primary">
                      {formatAddress(betData.user?.toString() || "")}
                    </span>
                    <span class="text-xs text-kong-text-secondary">
                      predicted
                    </span>
                    <span
                      class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-kong-success/10 text-kong-success max-w-[120px] truncate"
                    >
                      {outcomes[Number(betData.outcome_index)]}
                    </span>
                  </div>
                  <div
                    class="flex items-center gap-3 text-xs text-kong-text-secondary"
                  >
                    <span class="flex items-center gap-1">
                      <Clock class="w-3 h-3" />
                      {formatTimestamp(betData.timestamp)}
                    </span>
                    <span>•</span>
                    <span>{getFormattedTime(betData.timestamp)}</span>
                  </div>
                </div>
              {:else if betData.market}
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-xs text-kong-text-secondary line-clamp-1 group-hover:text-kong-text-primary transition-colors"
                  >
                    {betData.market.question}
                  </h3>
                  <div class="space-y-1">
                    <div class="flex">
                      <span
                        class="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-kong-success/10 text-kong-success max-w-[140px] truncate"
                      >
                        {betData.market.outcomes[Number(betData.outcome_index)]}
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span
                        class="text-xs font-medium text-kong-text-secondary"
                      >
                        {formatAddress(betData.user?.toString() || "")}
                      </span>
                      <span class="text-xs text-kong-text-secondary">•</span>
                      <span class="text-xs text-kong-text-secondary">
                        {formatTimestamp(betData.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Amount -->
              <div class="flex items-start gap-1 flex-shrink-0">
                <div class="text-right">
                  <div class="flex items-center gap-1">
                    <div
                      class="{showOutcomes
                        ? 'text-sm'
                        : 'text-xs'} font-semibold text-kong-success"
                    >
                      {formatBalance(
                        Number(betData.amount || 0),
                        getTokenDecimals(betData),
                      )}
                    </div>
                  </div>
                  <div class="text-xs text-kong-text-secondary">
                    {getTokenSymbol(betData)}
                  </div>
                </div>
                {#if betData.market}
                  <svg
                    class="w-3 h-3 text-kong-text-secondary/30 group-hover:text-kong-accent-blue transition-colors {showOutcomes
                      ? 'mt-1'
                      : ''}"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
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
          <div
            in:fade={{ delay: i * 50 }}
            class="{showOutcomes ? 'px-4 py-3' : 'px-3 py-2'} animate-pulse"
          >
            <div class="flex items-start gap-3">
              <!-- Avatar/Image skeleton -->
              <div
                class="{showOutcomes
                  ? 'w-10 h-10 rounded-full'
                  : 'w-8 h-8 rounded'} bg-kong-bg-secondary/30 flex-shrink-0"
              ></div>

              <!-- Content skeleton -->
              <div class="flex-1">
                {#if showOutcomes}
                  <div class="flex items-center gap-2 mb-1">
                    <div class="h-4 bg-kong-bg-secondary/30 rounded w-24"></div>
                    <div class="h-3 bg-kong-bg-secondary/30 rounded w-16"></div>
                    <div
                      class="h-5 bg-kong-bg-secondary/30 rounded-full w-20"
                    ></div>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="h-3 bg-kong-bg-secondary/30 rounded w-16"></div>
                    <div class="h-3 bg-kong-bg-secondary/30 rounded w-12"></div>
                  </div>
                {:else}
                  <div
                    class="h-3 bg-kong-bg-secondary/30 rounded w-full mb-1"
                  ></div>
                  <div
                    class="h-3 bg-kong-bg-secondary/30 rounded w-3/4 mb-1"
                  ></div>
                  <div class="space-y-1">
                    <div class="h-4 bg-kong-bg-secondary/30 rounded w-20"></div>
                    <div class="flex items-center gap-2">
                      <div
                        class="h-3 bg-kong-bg-secondary/30 rounded w-16"
                      ></div>
                      <div
                        class="h-3 bg-kong-bg-secondary/30 rounded w-12"
                      ></div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Amount skeleton -->
              <div class="flex items-center gap-1">
                <div>
                  <div
                    class="{showOutcomes
                      ? 'h-4'
                      : 'h-3'} bg-kong-bg-secondary/30 rounded w-12"
                  ></div>
                  <div
                    class="h-3 bg-kong-bg-secondary/30 rounded w-10 mt-1"
                  ></div>
                </div>
                <div class="h-3 bg-kong-bg-secondary/30 rounded w-2"></div>
              </div>
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
