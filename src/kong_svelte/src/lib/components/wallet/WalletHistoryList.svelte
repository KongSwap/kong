<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    Clock,
    ExternalLink,
    Check,
    ArrowDownRight,
    ArrowUpRight,
    Plus,
    Minus,
    Repeat,
    RefreshCw,
    Filter,
    Download,
    ArrowRightLeft,
    Loader2
  } from 'lucide-svelte';
  import Badge from "$lib/components/common/Badge.svelte";
  import { auth } from "$lib/services/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { writable, derived } from "svelte/store";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { formatDate } from "$lib/utils/dateUtils";
  import { fetchUserTransactions } from '$lib/api/users';
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    refresh: void;
  }>();
  
  // Create a store for tokens
  const tokensStore = writable<FE.Token[]>([]);
  
  // State variables
  let isLoading = false;
  let error: string | null = null;
  let transactions: any[] = [];
  let hasMore = true;
  let loadingMore = false;
  let authSubscription: () => void;
  
  // Filter state
  type FilterType = 'swap' | 'pool' | 'send' | 'all';
  let selectedFilter: FilterType = "all";
  const filterOptions = [
    { id: "all" as const, label: "All" },
    { id: "swap" as const, label: "Swaps" },
    { id: "pool" as const, label: "Pools" },
    { id: "send" as const, label: "Transfers" }
  ];
  
  // Current API cursor for pagination
  let currentCursor: number | undefined = undefined;
  const PAGE_SIZE = 20;

  
  // Function to load tokens
  async function loadTokens() {
    try {
      const response = await fetchTokens({
        limit: 500,
        page: 1
      });
      tokensStore.set(response.tokens);
      
      // Subscribe to store changes
      const unsubscribe = tokensStore.subscribe(value => {
        console.log('TokensStore updated:', value.length);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error loading tokens:', error);
      return undefined;
    }
  }
  
  // Function to handle filter changes
  function handleFilterChange(filter: FilterType) {
    if (filter === selectedFilter) return;
    
    selectedFilter = filter;
    transactions = [];
    currentCursor = undefined;
    hasMore = true;
    
    // Load transactions with the new filter
    loadTransactions();
  }
  
  // Function to load transactions
  async function loadTransactions(loadMore = false) {
    if (!$auth.isConnected || !$auth.account?.owner) {
      console.log('No principal ID available', $auth.isConnected, $auth.account?.owner);
      
      // Wait for a short time and try again if auth might still be initializing
      if (!error) {
        error = "Waiting for wallet connection...";
        setTimeout(() => {
          error = null;
          loadTransactions();
        }, 1500);
      }
      return;
    }
    
    // Convert Principal object to string
    const principal = $auth.account.owner.toString();
    console.log('Principal ID found:', principal);
    
    if (!loadMore) {
      isLoading = true;
      currentCursor = undefined;
      error = null;
    } else {
      if (loadingMore || !hasMore) return;
      loadingMore = true;
    }
    
    try {
      let txType: 'swap' | 'pool' | 'send' = 'swap';
      
      // Determine the tx_type based on the filter
      if (selectedFilter === 'swap') {
        txType = 'swap';
      } else if (selectedFilter === 'pool') {
        txType = 'pool';
      } else if (selectedFilter === 'send') {
        txType = 'send';
      }
      
      console.log(`Loading transactions: ${txType}, cursor: ${currentCursor}, filter: ${selectedFilter}`);
      
      // Fetch transactions using direct API call
      const response = await fetchUserTransactions(
        principal,
        currentCursor,
        PAGE_SIZE,
        selectedFilter === 'all' ? undefined : txType
      );
      
      console.log('Transaction response:', response);
      
      if (response.transactions) {
        const newTransactions = response.transactions
          .map(processTransaction)
          .filter(Boolean);
          
        console.log(`Received ${newTransactions.length} transactions`);
        
        if (loadMore) {
          transactions = [...transactions, ...newTransactions];
        } else {
          transactions = newTransactions;
        }
        
        hasMore = response.has_more;
        if (response.next_cursor) {
          currentCursor = response.next_cursor;
        } else {
          hasMore = false;
        }
      } else {
        console.log('No transactions received');
        if (!loadMore) {
          transactions = [];
        }
        hasMore = false;
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      toastStore.add({
        type: 'error',
        title: 'Failed to Load Transactions',
        message: err.message || 'Could not load transaction history.',
        duration: 5000
      });
      
      if (!loadMore) {
        transactions = [];
      }
      hasMore = false;
      error = err.message || 'Failed to load transactions';
    } finally {
      isLoading = false;
      loadingMore = false;
    }
  }
  
  // Handle refresh button click
  function handleRefresh() {
    console.log('Manual refresh requested');
    transactions = [];
    currentCursor = undefined;
    hasMore = true;
    loadTransactions();
    dispatch('refresh');
  }
  
  // Process transaction data
  function processTransaction(tx: any) {
    if (!tx?.tx_type) {
      console.log('Missing tx_type:', tx);
      return null;
    }
    
    const { tx_type, status, timestamp, details } = tx;
    
    // Safely handle the timestamp
    let dateInMs;
    let formattedDate;
    
    try {
      // Convert timestamp to milliseconds for Date if needed
      if (timestamp) {
        dateInMs = Number(timestamp);
        
        // Handle various timestamp formats
        if (dateInMs > 1e15) { // If timestamp is in nanoseconds
          dateInMs = Math.floor(dateInMs / 1_000_000);
        } else if (isNaN(dateInMs) && typeof timestamp === 'string') {
          // Try to parse ISO date string
          dateInMs = Date.parse(timestamp);
        }
        
        // Validate the date is not in the future
        const currentTime = Date.now();
        if (isNaN(dateInMs) || dateInMs > currentTime + 60000) { // 1 minute tolerance
          console.warn('Invalid or future timestamp detected:', timestamp);
          dateInMs = currentTime;
        }
        
        formattedDate = formatDate(new Date(dateInMs));
      } else {
        // Use current date if timestamp is missing
        console.warn('Missing timestamp for transaction:', tx.tx_id);
        formattedDate = formatDate(new Date());
      }
    } catch (err) {
      console.warn('Error parsing timestamp:', timestamp, err);
      // Fallback to current date
      formattedDate = formatDate(new Date());
    }
    
    let result;
    try {
      if (tx_type === 'swap') {
        result = {
          type: "Swap",
          status,
          formattedDate,
          details: {
            ...details,
            pay_amount: formatAmount(details?.pay_amount || 0),
            receive_amount: formatAmount(details?.receive_amount || 0),
            price: formatAmount(details?.price || 0)
          },
          tx_id: tx.tx_id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      } else if (tx_type === 'add_liquidity' || tx_type === 'remove_liquidity' || tx_type === 'pool') {
        const type = tx_type === 'add_liquidity' ? "Add Liquidity" : 
                     tx_type === 'remove_liquidity' ? "Remove Liquidity" : 
                     details?.type === 'add' ? "Add Liquidity" : "Remove Liquidity";
        result = {
          type,
          status,
          formattedDate,
          details: {
            ...details,
            amount_0: formatAmount(details?.amount_0 || 0),
            amount_1: formatAmount(details?.amount_1 || 0),
            lp_token_amount: formatAmount(details?.lp_token_amount || 0)
          },
          tx_id: tx.tx_id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      } else if (tx_type === 'send') {
        result = {
          type: "Send",
          status,
          formattedDate,
          details: {
            ...details,
            amount: formatAmount(details?.amount || 0)
          },
          tx_id: tx.tx_id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        console.log('Unknown transaction type:', tx_type);
        return null;
      }
    } catch (err) {
      console.error('Error processing transaction:', err, tx);
      return null;
    }
    
    return result;
  }
  
  // Format amount helper
  function formatAmount(amount: number | string): string {
    try {
      if (amount === undefined || amount === null) return '0';
      
      if (typeof amount === 'string') {
        amount = parseFloat(amount);
      }
      
      if (isNaN(amount)) return '0';
      
      // Convert to string without scientific notation
      const str = amount.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 20 });
      
      // Remove trailing zeros after decimal point
      if (str.includes('.')) {
        return str.replace(/\.?0+$/, '');
      }
      return str;
    } catch (err) {
      console.warn('Error formatting amount:', amount, err);
      return '0';
    }
  }
  
  // Download transaction history as CSV
  function downloadTransactionHistory() {
    if (!transactions.length) return;
    
    // Create CSV content
    const headers = ['Date', 'Type', 'Status', 'Details', 'Transaction ID'];
    
    const rows = transactions.map(tx => {
      let details = '';
      
      if (tx.type === 'Swap') {
        details = `${tx.details.pay_amount} ${tx.details.pay_token_symbol} → ${tx.details.receive_amount} ${tx.details.receive_token_symbol}`;
      } else if (tx.type === 'Send') {
        details = `${tx.details.amount} ${tx.details.token_symbol}`;
      } else {
        details = `${tx.details.amount_0} ${tx.details.token_0_symbol} + ${tx.details.amount_1} ${tx.details.token_1_symbol}`;
      }
      
      return [
        tx.formattedDate,
        tx.type,
        tx.status,
        details,
        tx.tx_id
      ];
    });
    
    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kong-transaction-history-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  // Transaction details modal
  let selectedTransaction: any = null;
  let showTransactionModal = false;
  
  function handleTransactionClick(tx: any) {
    selectedTransaction = tx;
    showTransactionModal = true;
  }
  
  function getTransactionIcon(type: string) {
    switch (type) {
      case "Swap":
        return ArrowRightLeft;
      case "Add Liquidity":
        return Plus;
      case "Remove Liquidity":
        return Minus;
      case "Send":
        return ArrowUpRight;
      case "Receive":
        return ArrowDownRight;
      default:
        return Repeat;
    }
  }
  
  // Load data on mount and subscribe to auth changes
  onMount(() => {
    let tokenUnsubscribePromise = loadTokens();
    
    // Subscribe to auth changes
    authSubscription = auth.subscribe(authState => {
      if (authState?.isConnected && authState?.account?.owner) {
        console.log('Auth state updated - user is connected:', authState.account.owner.toString());
        if (transactions.length === 0 && !isLoading) {
          loadTransactions();
        }
      }
    });
    
    // Initial load attempt
    if ($auth.isConnected && $auth.account?.owner) {
      loadTransactions();
    }
    
    // Clean up function
    return () => {
      // Clean up auth subscription
      if (authSubscription) authSubscription();
      
      // Clean up token subscription when it resolves
      tokenUnsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    };
  });
</script>

<!-- Transaction Details Modal -->
<Modal
  isOpen={showTransactionModal}
  variant="transparent"
  onClose={() => showTransactionModal = false}
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
        <span class="text-xs px-2 py-1 rounded-full {selectedTransaction.status === 'Success' ? 'bg-kong-accent-green/10 text-kong-text-accent-green' : 'bg-kong-accent-red/10 text-kong-accent-red'}">
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
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.pay_token_canister)]} 
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
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.receive_token_canister)]} 
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
                <span class="text-xs">{selectedTransaction.details.slippage || '0'}%</span>
              </div>
            </div>
          </div>
        {:else if selectedTransaction.type === "Add Liquidity" || selectedTransaction.type === "Remove Liquidity"}
          <div class="bg-kong-bg-dark/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 1</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.token_0_canister)]} 
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
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.token_1_canister)]} 
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
        {:else if selectedTransaction.type === "Send"}
          <div class="bg-kong-bg-dark/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.token_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.amount} {selectedTransaction.details.token_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">From</span>
                <span class="text-xs font-mono">{selectedTransaction.details.from}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">To</span>
                <span class="text-xs font-mono">{selectedTransaction.details.to}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Fee</span>
                <span class="text-xs">{selectedTransaction.details.fee || '0'} {selectedTransaction.details.token_symbol}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>

<div class="py-3">
  <!-- Header with filters -->
  <div class="px-4 mb-2 flex items-center justify-between">
    <div class="text-xs font-medium text-kong-text-secondary uppercase tracking-wide">Transaction History</div>
    
    <div class="flex items-center gap-2">
      <!-- Refresh button -->
      <button 
        class="p-1.5 rounded-md text-kong-text-secondary hover:text-kong-primary hover:bg-kong-text-primary/5 transition-colors"
        on:click={handleRefresh}
        disabled={isLoading}
        title="Refresh transaction history"
      >
        <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
      </button>
      
      <!-- Download CSV button -->
      <button 
        class="p-1.5 rounded-md text-kong-text-secondary hover:text-kong-primary hover:bg-kong-text-primary/5 transition-colors"
        on:click={downloadTransactionHistory}
        disabled={isLoading || !transactions.length}
        title="Download transaction history as CSV"
      >
        <Download size={14} />
      </button>
    </div>
  </div>
  
  <!-- Filter tabs -->
  <div class="px-4 mb-3 flex items-center gap-1.5">
    {#each filterOptions as option}
      <button 
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors {selectedFilter === option.id ? 'bg-kong-primary/10 text-kong-primary' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5'}"
        on:click={() => handleFilterChange(option.id)}
      >
        {option.label}
      </button>
    {/each}
  </div>
  
  <!-- Loading state -->
  {#if isLoading && !transactions.length}
    <div class="py-10 text-center">
      <div class="flex justify-center items-center h-32">
        <Loader2 class="w-6 h-6 animate-spin text-kong-text-secondary" />
      </div>
    </div>
  {:else if error}
    <div class="text-kong-accent-red text-sm text-center py-4">
      {error}
    </div>
  {:else if transactions.length === 0}
    <!-- Empty state -->
    <div class="py-10 text-center">
      <div class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto" style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);">
        <Clock size={24} class="text-kong-primary/40" />
      </div>
      <p class="text-base font-medium text-kong-text-primary">No Transaction History</p>
      <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
        Your transaction history will appear here once you start using the platform.
      </p>
    </div>
  {:else}
    <!-- Transaction list -->
    <div class="space-y-0">
      {#each transactions as tx (tx.tx_id)}
        <div 
          class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-colors cursor-pointer"
          on:click={() => handleTransactionClick(tx)}
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full flex items-center justify-center {tx.status === 'Success' ? 'bg-kong-accent-green/10' : 'bg-kong-accent-red/10'} flex-shrink-0">
                <svelte:component 
                  this={getTransactionIcon(tx.type)} 
                  class={tx.status === 'Success' ? 'text-kong-accent-green' : 'text-kong-accent-red'} 
                  size={16}
                />
              </div>
              
              <div class="flex flex-col justify-center">
                <div class="font-medium text-kong-text-primary text-sm leading-tight">
                  {tx.type}
                </div>
                <div class="text-xs text-kong-text-secondary mt-1 leading-tight">
                  {#if tx.type === "Swap"}
                    {tx.details.pay_amount} {tx.details.pay_token_symbol} → {tx.details.receive_amount} {tx.details.receive_token_symbol}
                  {:else if tx.type === "Send"}
                    {tx.details.amount} {tx.details.token_symbol}
                  {:else}
                    {tx.details.amount_0} {tx.details.token_0_symbol} + {tx.details.amount_1} {tx.details.token_1_symbol}
                  {/if}
                </div>
              </div>
            </div>
            
            <div class="text-right flex flex-col justify-center">
              <div class="text-xs font-medium {tx.status === 'Success' ? 'text-kong-accent-green' : 'text-kong-accent-red'} capitalize leading-tight">
                {tx.status}
              </div>
              <div class="text-xs text-kong-text-secondary mt-1 leading-tight">
                {tx.formattedDate}
              </div>
            </div>
          </div>
          
          <!-- Transaction ID display -->
          <div class="flex items-center justify-between text-xs">
            <div class="text-kong-text-secondary font-mono">
              {tx.tx_id}
            </div>
            <div class="flex items-center gap-2">
              <Badge variant="blue" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
                ICP
              </Badge>
              <button 
                class="text-kong-text-secondary hover:text-kong-primary transition-colors" 
                title="View Details"
              >
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>
      {/each}
      
      <!-- Load more button -->
      {#if hasMore}
        <div class="p-4 text-center">
          <button 
            class="px-4 py-2 text-xs font-medium rounded-lg bg-kong-text-primary/10 text-kong-text-primary hover:bg-kong-text-primary/15 transition-colors"
            on:click={() => loadTransactions(true)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More Transactions'}
          </button>
        </div>
      {/if}
      
      <!-- Loading more indicator -->
      {#if loadingMore}
        <div class="flex justify-center py-4">
          <Loader2 class="w-5 h-5 animate-spin text-kong-text-secondary" />
        </div>
      {/if}
    </div>
  {/if}
</div>
