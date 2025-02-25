<script lang="ts">
  import { onMount } from "svelte";
  import { writable, derived } from "svelte/store";
  import { TokenService } from "$lib/services/tokens/TokenService";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { ArrowRightLeft } from "lucide-svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userTokens } from "$lib/stores/userTokens";
  import Panel from "$lib/components/common/Panel.svelte";
  import { page } from "$app/state";
  
  let principal = page.params.principalId;
  let isLoading = false;
  let hasMore = true;
  let currentCursor: number | undefined = undefined;
  const PAGE_SIZE = 10;
  
  // Transaction store
  const transactionStore = writable<any[]>([]);
  
  // Helper function to find token by canister ID
  function findToken(canisterId: string): FE.Token | undefined {
    return $userTokens.tokens.find((t) => t.canister_id === canisterId);
  }

  async function loadMoreTransactions() {
    if (isLoading || !hasMore) {
      console.log("Skipping load - isLoading:", isLoading, "hasMore:", hasMore);
      return;
    }
    
    isLoading = true;
    
    try {
      const response = await TokenService.fetchUserTransactions(
        principal,
        currentCursor,
        PAGE_SIZE,
        'swap'
      );
      
      const { transactions: userTransactions, has_more, next_cursor } = response;

      if (!userTransactions || userTransactions.length === 0) {
        console.log("No transactions received");
        hasMore = false;
      } else {
        console.log("Received transactions:", userTransactions.length, userTransactions);
        transactionStore.update(txs => {
          console.log("txs", txs)
          // Create a map of existing transactions using composite key
          const existingTxs = new Map(
            txs.map(tx => [`${tx.tx_id}-${tx.timestamp}`, tx])
          );
          
          // Add new transactions, overwriting any duplicates
          userTransactions.forEach(tx => {
            existingTxs.set(`${tx.tx_id}-${tx.timestamp}`, tx);
          });
          
          // Convert back to array and sort by timestamp descending
          const newTxs = Array.from(existingTxs.values())
            .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
          return newTxs;
        });
        
        hasMore = has_more;
        if (next_cursor && next_cursor !== currentCursor) {
          currentCursor = next_cursor;
        } else {
          hasMore = false;
          console.log("No more transactions available or same cursor received");
        }
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
      hasMore = false;
    } finally {
      isLoading = false;
    }
  }

  // Filter for swap transactions with additional logging
  const swapTransactions = derived(
    transactionStore,
    ($transactions) => {
      console.log("Processing transactions:", $transactions);
      const filtered = $transactions.filter(tx => {
        console.log("Checking transaction:", tx);
        const isValid = tx && tx.tx_type === "swap" && tx.details;
        if (!isValid) {
          console.log("Filtered out transaction:", tx);
        }
        return isValid;
      });
      console.log("Filtered transactions:", filtered.length, filtered);
      return filtered;
    }
  );

  // Intersection Observer for infinite scroll
  let observerTarget: HTMLDivElement;
  
  onMount(() => {
    console.log("Component mounted, initializing for principal:", principal);
    const observer = new IntersectionObserver(
      (entries) => {
        const shouldLoad = entries[0].isIntersecting && !isLoading && hasMore;
        console.log("Intersection observer triggered:", {
          isIntersecting: entries[0].isIntersecting,
          isLoading,
          hasMore,
          shouldLoad
        });
        if (shouldLoad) {
          loadMoreTransactions();
        }
      },
      {
        rootMargin: "100px",
      }
    );

    if (observerTarget) {
      observer.observe(observerTarget);
      console.log("Observer attached to target");
    }

    // Initial load
    loadMoreTransactions();

    return () => {
      if (observerTarget) {
        observer.unobserve(observerTarget);
      }
    };
  });

  // Reset when principal changes with logging
  $: if (principal) {
    console.log("Principal changed, resetting transactions for:", principal);
    transactionStore.set([]);
    currentCursor = undefined;
    hasMore = true;
    loadMoreTransactions();
  }
</script>

<Panel variant="transparent">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm uppercase font-medium text-kong-text-primary">Recent Swaps</h3>
    <div class="p-2 rounded-lg bg-kong-primary/10">
      <ArrowRightLeft class="w-3 h-3 text-kong-primary" />
    </div>
  </div>

  <div class="max-h-[600px] overflow-y-auto">
    {#if $swapTransactions.length === 0 && !isLoading}
      <div class="text-center py-8 text-kong-text-secondary">
        No recent transactions
      </div>
    {:else}
      <!-- Table Headers -->
      <div class="grid grid-cols-[1fr,1fr,1fr,0.8fr] gap-4 px-4 py-2 text-sm text-kong-text-secondary font-medium border-b border-kong-bg-dark">
        <div>From</div>
        <div>To</div>
        <div class="text-right">Value</div>
        <div class="text-right">Date/Time</div>
      </div>
      
      <!-- Table Body -->
      <div class="divide-y divide-kong-bg-dark">
        {#each $swapTransactions as tx (`${tx.tx_id}-${tx.timestamp}`)}
          <div class="grid grid-cols-[1fr,1fr,1fr,0.8fr] gap-4 items-center px-4 py-3 hover:bg-kong-bg-dark/30 transition-colors">
            <!-- From -->
            <div class="flex items-center gap-2">
              <TokenImages
                tokens={[findToken(tx.details.pay_token_canister)].filter(Boolean)}
                size={28}
              />
              <div class="text-sm">
                <div class="font-medium text-kong-accent-red">
                  -{formatToNonZeroDecimal(tx.details.pay_amount)} {tx.details.pay_token_symbol}
                </div>
              </div>
            </div>

            <!-- To -->
            <div class="flex items-center gap-2">
              <TokenImages
                tokens={[findToken(tx.details.receive_token_canister)].filter(Boolean)}
                size={28}
              />
              <div class="text-sm">
                <div class="font-medium text-kong-text-accent-green">
                  +{formatToNonZeroDecimal(tx.details.receive_amount)} {tx.details.receive_token_symbol}
                </div>
              </div>
            </div>

            <!-- USD Value -->
            <div class="text-right text-sm">
              <div class="font-medium">
                ${formatToNonZeroDecimal(tx.details.receive_amount * $userTokens.tokens.find(t => t.canister_id === tx.details.receive_token_canister)?.metrics.price || 0)}
              </div>
            </div>

            <!-- Date/Time -->
            <div class="text-right text-sm text-kong-text-secondary">
              {new Date(Number(tx.timestamp) / 1_000_000).toLocaleDateString()} 
              {new Date(Number(tx.timestamp) / 1_000_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        {/each}

        <!-- Infinite scroll observer target -->
        <div
          bind:this={observerTarget}
          class="h-4 w-full"
        >
          {#if isLoading}
            <div class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-kong-primary" />
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</Panel>
