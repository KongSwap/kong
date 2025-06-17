<script lang="ts">
  import { onMount } from "svelte";
  import { writable, derived } from "svelte/store";
  import { fetchUserTransactions } from "$lib/api/users";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { ArrowRightLeft, ChevronLeft, ChevronRight } from "lucide-svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { walletDataStore, WalletDataService } from "$lib/services/wallet";
  import Panel from "$lib/components/common/Panel.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import { page } from "$app/state";
  
  // Get layout props
  let { initialDataLoading, initError } = $props<{ initialDataLoading: boolean, initError: string | null }>();
  
  // Reactive store for the principal
  const currentPrincipal = writable(page.params.principalId);
  let isLoading = writable(false);
  let totalPages = writable(1);
  let currentPage = writable(1);
  const PAGE_SIZE = 10;
  
  // Store cursor values for each page
  let pageCursors: Map<number, number | undefined> = new Map();
  // Initialize first page with undefined cursor
  pageCursors.set(1, undefined);
  
  // Transaction store
  const transactionStore = writable<any[]>([]);
  
  // Keep track of the URL timestamp to detect changes
  let lastTimestamp = $state(page.url.searchParams.get('t') || '');

  // Create a derived store for wallet data
  const walletData = derived(walletDataStore, $walletDataStore => $walletDataStore);

  // Helper function to find token by canister ID
  function findToken(address: string): Kong.Token | undefined {
    return $walletData?.tokens?.find((t) => t.address === address);
  }

  async function loadPage(pageNumber: number, forPrincipal: string) {
    if ($isLoading) {
      return;
    }
    
    isLoading.set(true);
    currentPage.set(pageNumber);
    
    try {
      // Get the cursor for the requested page
      const cursor = pageCursors.get(pageNumber);
      
      const response = await fetchUserTransactions(
        forPrincipal,
        cursor,
        PAGE_SIZE,
        'swap'
      );
      
      const { transactions: userTransactions, has_more, next_cursor } = response;

      if (!userTransactions || userTransactions.length === 0) {
        transactionStore.set([]);
        
        // Update total pages if we got no results
        if (pageNumber === 1) {
          totalPages.set(1);
        } else {
          // If a page beyond the first returns no results, we may have overestimated pages
          totalPages.set(pageNumber - 1);
          // Go back to the last valid page
          if ($currentPage > $totalPages) {
            loadPage($totalPages, forPrincipal);
            return;
          }
        }
      } else {
        transactionStore.set(userTransactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp)));
        
        // Store the next cursor for the next page
        if (has_more && next_cursor !== undefined) {
          pageCursors.set(pageNumber + 1, next_cursor);
          totalPages.set(Math.max($totalPages, pageNumber + 1));
        } else {
          totalPages.set(pageNumber);
        }
      }
    } catch (error) {
      console.error(`Failed to load swap transactions for principal: ${forPrincipal}`, error);
      transactionStore.set([]);
      // Ensure we have at least one page even on error
      if (pageNumber === 1) {
        totalPages.set(1);
      } else {
        // If an error occurred on a page beyond the first, try to go back to a valid page
        loadPage(Math.max(pageNumber - 1, 1), forPrincipal);
        return;
      }
    } finally {
      isLoading.set(false);
    }
  }

  function goToPage(pageNum: number) {
    if (pageNum >= 1 && pageNum <= $totalPages && pageNum !== $currentPage) {
      loadPage(pageNum, $currentPrincipal);
    }
  }

  // Helper to ensure wallet data is loaded and then initialize data
  async function ensureWalletDataAndLoadSwaps(principalId: string) {
    try {
      // Check if we need to load wallet data first
      if (!$walletData?.tokens || $walletData.tokens.length === 0) {
        await WalletDataService.initializeWallet(principalId);
      }
    } catch (error) {
      console.error("Failed to load wallet data:", error);
    } finally {
      // Load swap data regardless of token loading success/failure
      initializeData(principalId);
    }
  }

  function initializeData(forPrincipal: string) {
    // Reset all data structures
    transactionStore.set([]);
    totalPages.set(1);
    currentPage.set(1);
    pageCursors = new Map([[1, undefined]]);
    
    // Load the first page for this principal
    loadPage(1, forPrincipal);
  }

  // Filter for swap transactions
  const swapTransactions = derived(
    transactionStore,
    ($transactions) => {
      return $transactions.filter(tx => tx && tx.tx_type === "swap" && tx.details);
    }
  );
  
  onMount(() => {
    // Only load additional data if initial wallet loading is complete
    if (!initialDataLoading) {
      ensureWalletDataAndLoadSwaps($currentPrincipal);
    }
  });

  // Watch for changes in URL parameters AND the timestamp query parameter
  // This ensures we detect both direct principal changes and cache-busting timestamps
  $effect(() => {
    const newPrincipal = page.params.principalId;
    const urlTimestamp = page.url.searchParams.get('t') || '';
    const currentUrl = page.url.pathname + page.url.search;

    if (newPrincipal !== $currentPrincipal || urlTimestamp !== lastTimestamp) {
      // Update our tracking variables
      currentPrincipal.set(newPrincipal);
      lastTimestamp = urlTimestamp;
      
      // Only load additional data if initial wallet loading is complete
      if (!initialDataLoading) {
        ensureWalletDataAndLoadSwaps(newPrincipal);
      }
    }
  });

  // Watch for initialDataLoading state changes
  $effect(() => {
    if (initialDataLoading === false && $currentPrincipal) {
      // Check if we have tokens loaded
      const hasTokens = $walletData?.tokens?.length > 0;
        
      // When layout loading completes, load token and swap data
      ensureWalletDataAndLoadSwaps($currentPrincipal);
    }
  });
</script>

<svelte:head>
  <title>Recent Swaps by {$currentPrincipal} - KongSwap</title>
</svelte:head>

<Panel variant="transparent">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm uppercase font-medium text-kong-text-primary">Recent Swaps</h3>
    <div class="p-2 rounded-lg bg-kong-primary/10">
      <ArrowRightLeft class="w-3 h-3 text-kong-primary" />
    </div>
  </div>

  <div>
    {#if initialDataLoading}
      <LoadingIndicator message="Initializing wallet data..." />
    {:else if initError}
      <div class="text-center py-8 text-kong-error">
        {initError}
      </div>
    {:else if $isLoading}
      <LoadingIndicator message="Loading swap transactions..." />
    {:else if $swapTransactions.length === 0}
      <div class="text-center py-8 text-kong-text-secondary">
        No recent swap transactions found for {$currentPrincipal}
      </div>
    {:else}
      <!-- Table Headers - Hidden on mobile -->
      <div class="hidden sm:grid sm:grid-cols-[1fr,1fr,1fr,0.8fr] gap-4 px-4 py-2 text-sm text-kong-text-secondary font-medium border-b border-kong-bg-primary">
        <div>From</div>
        <div>To</div>
        <div class="text-right">Value</div>
        <div class="text-right">Date/Time</div>
      </div>
      
      <!-- Table Body -->
      <div class="divide-y divide-kong-bg-primary">
        {#each $swapTransactions as tx (`${tx.tx_id}-${tx.timestamp}`)}
          <!-- Desktop view - grid layout -->
          <div class="hidden sm:grid sm:grid-cols-[1fr,1fr,1fr,0.8fr] sm:gap-4 sm:items-center px-4 py-3 hover:bg-kong-bg-primary/30 transition-colors">
            <!-- From -->
            <div class="flex items-center gap-2">
              <TokenImages
                tokens={[findToken(tx.details.pay_token_canister)].filter(Boolean)}
                size={28}
              />
              <div class="text-sm">
                <div class="font-medium text-kong-error">
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
                <div class="font-medium text-kong-success">
                  +{formatToNonZeroDecimal(tx.details.receive_amount)} {tx.details.receive_token_symbol}
                </div>
              </div>
            </div>

            <!-- USD Value -->
            <div class="text-right text-sm">
              <div class="font-medium">
                ${formatToNonZeroDecimal(tx.details.receive_amount * Number(findToken(tx.details.receive_token_canister)?.metrics?.price || 0))}
              </div>
            </div>

            <!-- Date/Time -->
            <div class="text-right text-sm text-kong-text-secondary">
              {new Date(Number(tx.timestamp) / 1_000_000).toLocaleDateString()} 
              {new Date(Number(tx.timestamp) / 1_000_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          <!-- Mobile view - card layout -->
          <div class="sm:hidden p-4 hover:bg-kong-bg-primary/30 transition-colors">
            <!-- Top row: From → To and Date -->
            <div class="flex justify-between items-center mb-3">
              <!-- From → To -->
              <div class="flex items-center gap-1">
                <div class="flex items-center">
                  <TokenImages
                    tokens={[findToken(tx.details.pay_token_canister)].filter(Boolean)}
                    size={24}
                  />
                </div>
                <ArrowRightLeft class="w-3 h-3 mx-1 text-kong-text-secondary" />
                <div class="flex items-center">
                  <TokenImages
                    tokens={[findToken(tx.details.receive_token_canister)].filter(Boolean)}
                    size={24}
                  />
                </div>
              </div>
              
              <!-- Date -->
              <div class="text-xs text-kong-text-secondary">
                {new Date(Number(tx.timestamp) / 1_000_000).toLocaleDateString()}
              </div>
            </div>
            
            <!-- Amount details -->
            <div class="flex justify-between items-center">
              <!-- From amount -->
              <div class="text-sm">
                <div class="font-medium text-kong-error">
                  -{formatToNonZeroDecimal(tx.details.pay_amount)} {tx.details.pay_token_symbol}
                </div>
              </div>
              
              <!-- To amount -->
              <div class="text-sm">
                <div class="font-medium text-kong-success">
                  +{formatToNonZeroDecimal(tx.details.receive_amount)} {tx.details.receive_token_symbol}
                </div>
              </div>
            </div>
            
            <!-- Bottom row: USD Value and Time -->
            <div class="flex justify-between items-center mt-2">
              <div class="text-xs text-kong-text-secondary">
                {new Date(Number(tx.timestamp) / 1_000_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div class="text-sm font-medium">
                ${formatToNonZeroDecimal(tx.details.receive_amount * Number(findToken(tx.details.receive_token_canister)?.metrics?.price || 0))}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Pagination Controls - Always displayed -->
    <div class="mt-4 sm:mt-6 pt-3 border-t border-kong-bg-primary flex justify-between sm:justify-end">
      <div class="flex items-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm text-kong-text-secondary">
        <span class="whitespace-nowrap">Page {$currentPage} of {Math.max($totalPages, 1)}</span>
        
        <div class="flex">
          <button 
            class="px-1 sm:px-2 py-1 rounded-l-md border border-kong-bg-primary hover:bg-kong-bg-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={$currentPage === 1 || $isLoading || initialDataLoading}
            onclick={() => goToPage($currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft class="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
          
          <button 
            class="px-1 sm:px-2 py-1 rounded-r-md border-t border-r border-b border-kong-bg-primary hover:bg-kong-bg-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={$currentPage === $totalPages || $isLoading || initialDataLoading}
            onclick={() => goToPage($currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight class="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</Panel>
