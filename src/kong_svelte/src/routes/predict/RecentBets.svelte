<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import { fade } from 'svelte/transition';

  export let bets: any[] = [];
  export let outcomes: string[] | null = null;
  export let title: string = "Recent Bets";
  export let maxHeight: string = "300px";
  export let showOutcomes: boolean = true;
  export let className: string = "";
  export let panelVariant: "transparent" | "solid" = "transparent";
  export let loading: boolean = false;

  let localNewBetIds: Set<string> = new Set();
  let seenBetIds: Set<string> = new Set();
  let hasInitialLoad = false;

  $: (() => {
    if (!bets.length) return;
    
    const currentBetIds = new Set(
      bets.map(bet => {
        const betData = getBetData(bet);
        return `${betData.timestamp}-${betData.user}`;
      })
    );

    if (!hasInitialLoad) {
      seenBetIds = new Set(currentBetIds);
      hasInitialLoad = true;
      return;
    }

    const newIds = new Set([...currentBetIds].filter(id => !seenBetIds.has(id)));

    newIds.forEach(id => {
      localNewBetIds.add(id);
      seenBetIds.add(id);
      setTimeout(() => {
        localNewBetIds.delete(id);
        localNewBetIds = new Set(localNewBetIds);
      }, 1000);
    });

    // Update seen IDs with all current bets
    seenBetIds = new Set([...seenBetIds, ...currentBetIds]);
  })();

  function getBetData(bet: any) {
    if (bet.bet && bet.market) {
      return {
        timestamp: bet.bet.timestamp,
        outcome_index: bet.bet.outcome_index,
        amount: bet.bet.amount,
        user: bet.bet.user,
        market: bet.market
      };
    }
    return {
      timestamp: bet.timestamp,
      outcome_index: bet.outcome_index,
      amount: bet.amount,
      user: bet.user,
      market: null
    };
  }
</script>

<Panel variant={panelVariant} className={className} unpadded>
  <div class="sticky top-4">
    <h2 class="text-sm uppercase font-medium px-4">{title}</h2>
    <div class="max-h-[{maxHeight}] overflow-y-auto scrollbar-thin relative">
      {#if bets.length > 0}
        {#each bets as bet}
          {@const betData = getBetData(bet)}
          {@const betId = `${betData.timestamp}-${betData.user}`}
          <div
            class="flex p-4 flex-col py-3 border-b border-kong-border/50 last:border-0 hover:bg-kong-bg-dark/30 transition-colors group rounded-md"
            class:flash={localNewBetIds.has(betId)}
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
                    on:click={() => goto(`/predict/${betData.market.id}`)}
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
                <span class="text-xs text-kong-pm-text-secondary">KONG</span>
              </div>
            </div>
            <div class="flex justify-between w-full items-center mt-2">
              <span class="text-xs text-kong-pm-text-secondary">
                {new Date(Number(betData.timestamp) / 1_000_000).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span class="text-xs text-kong-pm-text-secondary/80">
                by <span class="font-medium text-kong-text-accent-green">{betData.user ? betData.user.toString().slice(0, 10) : 'Unknown'}...</span>
              </span>
            </div>
          </div>
        {/each}
      {:else}
        {#if loading}
          <div transition:fade class="space-y-3 px-4">
            {#each Array(3) as _}
              <div class="animate-pulse">
                <div class="h-5 bg-kong-bg-light/30 rounded w-3/4 mb-2"></div>
                <div class="h-4 bg-kong-bg-light/30 rounded w-1/2"></div>
                <div class="flex justify-between items-center mt-2">
                  <div class="h-3 bg-kong-bg-light/30 rounded w-24"></div>
                  <div class="h-3 bg-kong-bg-light/30 rounded w-20"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div class="w-16 h-16 mb-4 rounded-full bg-kong-bg-dark/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-kong-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 class="text-kong-text-secondary/80 font-medium mb-1">No bets yet</h3>
            <p class="text-sm text-kong-text-secondary/60">Be the first one to place a bet!</p>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</Panel>

<style lang="postcss" scoped>
  @keyframes flash {
    0% {
      background-color: rgb(34, 197, 94);
      transform: scale(1);
    }
    50% {
      background-color: rgba(34, 197, 94, 0.2);
      transform: scale(0.98);
    }
    100% {
      background-color: transparent;
      transform: scale(1);
    }
  }

  .flash {
    animation: flash 1s ease-out;
    position: relative;
    z-index: 1;
    margin: 1px 0;
  }

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