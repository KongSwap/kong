<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { liveTokens, TokenService } from "$lib/services/tokens";
  import { ArrowRightLeft, Plus, Minus, Loader2 } from "lucide-svelte";
  import { onMount } from "svelte";
  import { tick } from "svelte";
  import { formatDate } from "$lib/utils/dateUtils";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  let isLoading = false;
  let error: string | null = null;
  let transactions: any[] = [];
  let hasMore = true;
  let currentPage = 1;
  let loadingMore = false;
  let observer: IntersectionObserver;
  let loadMoreTrigger: HTMLDivElement;
  let containerHeight: number;
  let scrollY: number = 0;
  let listContainer: HTMLDivElement;

  // Constants for virtual scrolling
  const ITEM_HEIGHT = 56; // 48px height + 8px margin bottom
  const BUFFER_SIZE = 5; // Number of items to render above/below viewport

  let selectedFilter: string = "all";
  const filterOptions = [
    { id: "all", label: "All" },
    { id: "swap", label: "Swap" },
    { id: "pool", label: "Pool" },
  ];

  // Memoized filtered transactions with type optimization
  $: filteredTransactions = selectedFilter === "all" 
    ? transactions 
    : transactions.filter(tx => {
        switch (selectedFilter) {
          case "swap": return tx.type === "Swap";
          case "pool": return tx.type.includes("Liquidity");
          default: return true;
        }
      });

  // Virtual scrolling calculations
  $: totalHeight = filteredTransactions.length * ITEM_HEIGHT;
  $: start = Math.max(0, Math.floor(scrollY / ITEM_HEIGHT) - BUFFER_SIZE);
  $: end = Math.min(
    filteredTransactions.length,
    Math.ceil((scrollY + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
  );
  $: visibleTransactions = filteredTransactions.slice(start, end);
  $: translateY = start * ITEM_HEIGHT;

  let selectedTransaction: any = null;
  let isModalOpen = false;

  function handleTransactionClick(tx: any) {
    selectedTransaction = tx;
    isModalOpen = true;
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    scrollY = target.scrollTop;
    
    // Check if we're near the bottom for infinite scroll
    const threshold = 100; // Pixels from bottom to trigger load
    const bottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    
    if (bottom && hasMore && !loadingMore && !isLoading) {
      currentPage++;
      loadTransactions(true);
    }
  }

  async function loadTransactions(loadMore = false) {
    if (!$auth.isConnected) {
      transactions = [];
      return;
    }

    if (!loadMore) {
      isLoading = true;
      currentPage = 1;
      transactions = [];
      hasMore = true;
    } else {
      if (loadingMore || !hasMore) return;
      loadingMore = true;
    }

    try {
      const pageSize = 10; // Reduced page size for smoother loading
      const response = await TokenService.fetchUserTransactions(
        $auth.account?.owner?.toString(),
        currentPage,
        pageSize,
        null
      );

      if (response.transactions) {
        const newTransactions = response.transactions
          .map(processTransaction)
          .filter(Boolean);

        if (loadMore) {
          transactions = [...transactions, ...newTransactions];
        } else {
          transactions = newTransactions;
        }

        // Update hasMore based on whether we got a full page
        hasMore = newTransactions.length === pageSize;
      } else if (response.Err) {
        error = typeof response.Err === "string" ? response.Err : "Failed to load transactions";
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      error = err.message || "Failed to load transactions";
    } finally {
      isLoading = false;
      loadingMore = false;
    }
  }

  // Create observer once and handle loadMoreTrigger changes with debounce
  $: if (loadMoreTrigger) {
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loadingMore && !isLoading) {
          // Small delay to prevent multiple triggers
          setTimeout(() => {
            if (first.isIntersecting) {
              currentPage++;
              loadTransactions(true);
            }
          }, 100);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );
    observer.observe(loadMoreTrigger);
  }

  onMount(() => {
    const setup = async () => {
      await tick();
      if (listContainer) {
        containerHeight = listContainer.clientHeight;
        
        // Set up resize observer
        const resizeObserver = new ResizeObserver(entries => {
          for (const entry of entries) {
            containerHeight = entry.contentRect.height;
          }
        });
        
        resizeObserver.observe(listContainer);
        return () => {
          resizeObserver.disconnect();
          observer?.disconnect();
        };
      }
    };
    
    setup();
    return () => {
      observer?.disconnect();
    };
  });

  // Watch filter changes
  $: if (selectedFilter) {
    currentPage = 1;
    loadTransactions(false);
  }

  function processTransaction(tx: any) {
    if (!tx?.tx_type) return null;

    const { tx_type, status, timestamp, details } = tx;
    const formattedDate = formatDate(new Date(timestamp));
    
    switch (tx_type) {
      case 'swap':
        return {
          type: "Swap",
          status,
          formattedDate,
          details,
          tx_id: tx.tx_id
        };
      case 'add_liquidity':
      case 'remove_liquidity':
        return {
          type: tx_type === 'add_liquidity' ? "Add Liquidity" : "Remove Liquidity",
          status,
          formattedDate,
          details,
          tx_id: tx.tx_id
        };
      default:
        return null;
    }
  }

  function getTransactionIcon(type: string) {
    switch (type) {
      case "Swap":
        return ArrowRightLeft;
      case "Add Liquidity":
        return Plus;
      case "Remove Liquidity":
        return Minus;
      default:
        return ArrowRightLeft;
    }
  }
</script>

<Modal
  isOpen={isModalOpen}
  variant="transparent"
  onClose={() => isModalOpen = false}
  title="Transaction Details"
  width="400px"
  height="auto"
>
  {#if selectedTransaction}
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Type</span>
        <span class="text-sm font-medium">{selectedTransaction.type}</span>
      </div>
      
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Status</span>
        <span class="text-xs px-2 py-1 rounded-full {selectedTransaction.status === 'Success' ? 'bg-kong-accent-green/10 text-kong-accent-green' : 'bg-kong-accent-red/10 text-kong-accent-red'}">
          {selectedTransaction.status}
        </span>
      </div>
      
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Date</span>
        <span class="text-sm">{selectedTransaction.formattedDate}</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Transaction ID</span>
        <span class="text-sm font-mono">{selectedTransaction.tx_id}</span>
      </div>

      <div class="space-y-2">
        <div class="text-sm text-kong-text-secondary mb-2">Transaction Details</div>
        {#if selectedTransaction.type === "Swap"}
          <div class="bg-kong-bg-dark/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">From</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$liveTokens.find(token => token.address === selectedTransaction.details.pay_token_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.pay_amount} {selectedTransaction.details.pay_token_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.pay_token_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.pay_token_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">To</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$liveTokens.find(token => token.address === selectedTransaction.details.receive_token_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.receive_amount} {selectedTransaction.details.receive_token_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.receive_token_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.receive_token_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Price</span>
                <span class="text-xs">{selectedTransaction.details.price}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Slippage</span>
                <span class="text-xs">{selectedTransaction.details.slippage}%</span>
              </div>
            </div>
          </div>
        {:else}
          <div class="bg-kong-bg-dark/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 1</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$liveTokens.find(token => token.address === selectedTransaction.details.token_0_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.amount_0} {selectedTransaction.details.token_0_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_0_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_0_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 2</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$liveTokens.find(token => token.address === selectedTransaction.details.token_1_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.amount_1} {selectedTransaction.details.token_1_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_1_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_1_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">LP Token</span>
                <span class="text-xs">{selectedTransaction.details.lp_token_symbol}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">LP Amount</span>
                <span class="text-xs">{selectedTransaction.details.lp_token_amount}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Pool ID</span>
                <span class="text-xs">{selectedTransaction.details.pool_id}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>

<div class="flex flex-col h-[87dvh] px-2">
  <!-- Filter Navigation -->
  <nav class="flex rounded-t-lg bg-kong-bg-dark/50 mt-2 w-full">
    {#each filterOptions as option, index}
      <button
        class="tab-button flex-1 relative"
        class:active={selectedFilter === option.id}
        on:click={() => (selectedFilter = option.id)}
        role="tab"
        aria-selected={selectedFilter === option.id}
        aria-controls={`${option.id}-panel`}
      >
        <div class="flex items-center justify-center gap-1.5 py-2.5">
          {#if selectedFilter === option.id}
            <div class="absolute inset-0 bg-kong-accent-blue/5 {index === 0 ? 'rounded-tl-lg' : ''} {index === filterOptions.length - 1 ? 'rounded-tr-lg' : ''}" />
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-kong-accent-blue" />
          {/if}
          <span class="relative z-10 text-xs font-medium">
            {option.label}
          </span>
        </div>
      </button>
    {/each}
  </nav>

  <!-- Transaction List -->
  <div 
    class="flex-1 overflow-y-auto px-2 pt-2 mb-4 scrollbar-custom bg-kong-bg-dark/50 rounded-b-lg"
    bind:this={listContainer}
    on:scroll={handleScroll}
  >
    {#if isLoading && !loadingMore}
      <div class="flex justify-center items-center h-32">
        <Loader2 class="w-6 h-6 animate-spin text-kong-text-secondary" />
      </div>
    {:else if error}
      <div class="text-kong-accent-red text-sm text-center py-4">
        {error}
      </div>
    {:else if filteredTransactions.length === 0}
      <div class="text-kong-text-secondary text-sm text-center py-4">
        No transactions found
      </div>
    {:else}
      <div class="relative" style="height: {totalHeight}px">
        <div class="absolute w-full" style="transform: translateY({translateY}px)">
          {#each visibleTransactions as tx (tx.tx_id)}
            <div 
              class="mb-2 px-2 sm:px-3 h-12 rounded-lg bg-kong-bg-light/50 hover:bg-kong-bg-dark/40 border border-kong-border hover:border-kong-primary/70 transition-all duration-100 flex items-center cursor-pointer"
              on:click={() => handleTransactionClick(tx)}
            >
              <div class="p-1.5 rounded-full bg-kong-bg-dark/50 mr-2 sm:mr-3 shrink-0">
                <svelte:component 
                  this={getTransactionIcon(tx.type)} 
                  class="w-3.5 h-3.5 text-kong-text-primary"
                />
              </div>

              <div class="flex-1 min-w-0">
                {#if tx.type === "Swap"}
                  <div class="flex items-center gap-1 text-[11px] sm:text-xs text-kong-text-secondary truncate">
                    <span>{tx.details.pay_amount} {tx.details.pay_token_symbol}</span>
                    <ArrowRightLeft class="w-3 h-3 shrink-0" />
                    <span>{tx.details.receive_amount} {tx.details.receive_token_symbol}</span>
                  </div>
                {:else}
                  <div class="flex items-center gap-1 text-[11px] sm:text-xs text-kong-text-secondary truncate">
                    <span>{tx.details.amount_0} {tx.details.token_0_symbol}</span>
                    <span class="shrink-0">+</span>
                    <span>{tx.details.amount_1} {tx.details.token_1_symbol}</span>
                  </div>
                {/if}
              </div>

              <div class="ml-2 sm:ml-3 flex items-center gap-1 sm:gap-2 shrink-0">
                <span class="hidden sm:inline text-xs text-kong-text-secondary">{tx.formattedDate}</span>
                <span 
                  class="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full shrink-0 min-w-[52px] text-center {tx.status === 'Success' ? 'bg-kong-accent-green/10 text-kong-accent-green' : 'bg-kong-accent-red/10 text-kong-accent-red'}"
                >
                  {tx.status}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      {#if loadingMore}
        <div class="flex justify-center py-4">
          <Loader2 class="w-5 h-5 animate-spin text-kong-text-secondary" />
        </div>
      {/if}

      {#if !hasMore && transactions.length > 0}
        <div class="text-center py-4 text-xs text-kong-text-secondary">
          No more transactions
        </div>
      {/if}

      <div bind:this={loadMoreTrigger} class="h-px" />
    {/if}
  </div>
</div>
