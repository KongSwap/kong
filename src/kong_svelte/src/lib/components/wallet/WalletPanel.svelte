<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import {
    Coins,
    LayoutGrid,
    Clock,
    User,
    Copy,
    Check,
    RefreshCw,
  } from "lucide-svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import {
    currentUserBalancesStore,
    loadBalances,
  } from "$lib/stores/balancesStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";
  import { tooltip } from "$lib/actions/tooltip";
  import { truncateAddress } from "$lib/utils/principalUtils";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import WalletTokensList from "$lib/components/wallet/WalletTokensList.svelte";
  import WalletPoolsList from "$lib/components/wallet/WalletPoolsList.svelte";
  import WalletAddressesList from "$lib/components/wallet/WalletAddressesList.svelte";
  import WalletHistoryList from "$lib/components/wallet/WalletHistoryList.svelte";
  import SendTokenModal from "$lib/components/wallet/SendTokenModal.svelte";

  // Props type definition
  type WalletPanelProps = {
    onClose?: () => void;
    onTokenAction?: (action: "send" | "receive" | "swap" | "info", token: any) => void;
  };

  // Destructure props with defaults
  let { 
    onClose = () => {},
    onTokenAction = () => {}
  }: WalletPanelProps = $props();

  // State management
  type WalletSection = "tokens" | "pools" | "history" | "addresses";
  let activeSection = $state<WalletSection>("tokens");
  let showSendTokenModal = $state(false);
  let selectedTokenForAction = $state<any>(null);
  let isLoadingBalances = $state(false);
  let lastRefreshed = $state(Date.now());
  let isRefreshing = $state(false);
  let hasCopiedPrincipal = $state(false);
  let walletId = $state("");

  // Define tabs configuration
  const tabsConfig = [
    { id: 'tokens', label: 'Tokens', icon: Coins },
    { id: 'pools', label: 'Pools', icon: LayoutGrid },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'addresses', label: 'Addresses', icon: User }
  ];

  // Component map for tab content
  const tabComponents = {
    tokens: {
      component: WalletTokensList,
      props: () => ({
        walletId,
        isLoading: isLoadingBalances,
        forceRefresh: lastRefreshed === Date.now(),
        onAction: handleTokenAction,
        onRefresh: () => refreshBalances(true),
        onTokenAdded: handleTokenAdded,
        onBalancesLoaded: handleBalancesLoaded
      })
    },
    pools: {
      component: WalletPoolsList,
      props: () => ({
        liquidityPools: $currentUserPoolsStore?.filteredPools || [],
        isLoading: isLoadingBalances || $currentUserPoolsStore?.loading,
        onRefresh: () => {
          // Only refresh if data hasn't been loaded yet
          if (!$currentUserPoolsStore?.filteredPools?.length) {
            currentUserPoolsStore.initialize();
          }
        }
      })
    },
    history: {
      component: WalletHistoryList,
      props: () => ({
        onRefresh: () => refreshBalances(true)
      })
    },
    addresses: {
      component: WalletAddressesList,
      props: () => ({
        userAddresses,
        isLoading: isLoadingBalances
      })
    }
  };

  // Handle token actions (send, receive, swap, info)
  function handleTokenAction(action: "send" | "receive" | "swap" | "info", token: any) {
    if (!token?.token?.canister_id && action !== "send") {
      console.error(`Cannot perform ${action}: Invalid token canister ID`);
      return;
    }

    // Handle different token actions
    if (action === "send") {
      selectedTokenForAction = token;
      showSendTokenModal = true;
    } else if (action === "swap") {
      navigateAndClose(`/swap?from=${token.token?.canister_id}&to=ryjl3-tyaaa-aaaaa-aaaba-cai`);
    } else if (action === "info") {
      navigateAndClose(`/stats/${token.token?.canister_id}`);
    } else {
      // For other actions, call the callback
      onTokenAction(action, token);
    }
  }

  // Helper function to navigate and close the panel
  function navigateAndClose(path: string) {
    goto(path);
    onClose();
  }

  // Use $effect instead of $: reactive statement
  $effect(() => {
    if ($auth?.account?.owner && $auth.account.owner !== walletId) {
      walletId = $auth.account.owner;
    }
  });

  // User addresses data - Now we don't need this, our WalletAddressesList will get the data directly from auth
  // We keep it for backward compatibility
  const userAddresses = $derived([]);

  // Calculate total portfolio value from all sources
  let lastKnownPortfolioValue = $state(0);
  let totalPortfolioValue = $state(0);
  
  // Update total portfolio value whenever stores change
  $effect(() => {
    const calculated = calculateTotalPortfolioValue($currentUserBalancesStore, $currentUserPoolsStore?.filteredPools || []);
    
    // Only update last known value if calculated is greater than 0
    if (calculated > 0) {
      lastKnownPortfolioValue = calculated;
      totalPortfolioValue = calculated;
    } else if (lastKnownPortfolioValue > 0) {
      // Use last known good value if current calculation is zero
      totalPortfolioValue = lastKnownPortfolioValue;
    } else {
      totalPortfolioValue = calculated;
    }
  });

  // Helper function to calculate total portfolio value
  function calculateTotalPortfolioValue(balances: any, pools: any[]): number {
    const tokensValue = Object.values(balances || {})
      .reduce((acc: number, balance: any) => {
        if (balance && balance.in_usd) {
          // Safely convert to number, handling non-numeric strings
          const numValue = parseFloat(balance.in_usd);
          return acc + (isNaN(numValue) ? 0 : numValue);
        }
        return acc;
      }, 0);
    
    const poolsValue = (pools || []).reduce((acc, pool: any) => {
      // Safely convert usd_balance to number, handling all edge cases
      let usdBalance = 0;
      if (pool && pool.usd_balance) {
        usdBalance = parseFloat(pool.usd_balance);
        if (isNaN(usdBalance)) usdBalance = 0;
      }
      return acc + usdBalance;
    }, 0);
    
    return tokensValue + poolsValue;
  }

  // Local copy function with feedback
  function handleCopyPrincipal(text: string) {
    copyToClipboard(text);
    hasCopiedPrincipal = true;
    setTimeout(() => {
      hasCopiedPrincipal = false;
    }, 2000);
  }

  // Refresh balances
  function refreshBalances(forceRefresh = true) {
    isRefreshing = true;
    isLoadingBalances = true;
    
    // Update last refreshed timestamp to trigger reactive updates
    lastRefreshed = Date.now();
    
    // Load balances for the current wallet ID if available
    if (walletId && $userTokens?.tokens?.length > 0) {
      loadBalances($userTokens.tokens, walletId, forceRefresh)
        .then(() => {
          isLoadingBalances = false;
          isRefreshing = false;
          
          // Manually recalculate portfolio value after balances are loaded
          setTimeout(() => {
            const calculated = calculateTotalPortfolioValue($currentUserBalancesStore, $currentUserPoolsStore?.filteredPools || []);
            if (calculated > 0) {
              lastKnownPortfolioValue = calculated;
              totalPortfolioValue = calculated;
            }
          }, 100);
        })
        .catch((err) => {
          console.error("Error refreshing balances:", err);
          isLoadingBalances = false;
          isRefreshing = false;
        });
    } else {
      // If no wallet ID or tokens, just end the loading state after a brief delay
      setTimeout(() => {
        isLoadingBalances = false;
        isRefreshing = false;
      }, 500);
    }
  }

  // Handle token added by the user
  function handleTokenAdded(newToken: any) {
    // Load balance for the newly added token
    if (walletId) {
      loadBalances([newToken], walletId, true)
        .catch((err) =>
          console.error("Error loading balance for new token:", err),
        );
    }
  }

  // Handle when balances are loaded
  function handleBalancesLoaded() {
    isLoadingBalances = false;
  }

  // Close modal helper
  function closeModal() {
    showSendTokenModal = false;
    selectedTokenForAction = null;
  }

  // Success handler for send token
  function handleSendSuccess() {
    closeModal();
    refreshBalances(true);
  }

  // Load token data on mount
  onMount(() => {
    // User tokens might not be loaded yet
    userTokens.refreshTokenData();
    
    // Initialize pool data
    currentUserPoolsStore.initialize();

    // Get the current wallet ID
    if ($auth?.account?.owner) {
      walletId = $auth.account.owner.toString();
      
      // Set loading state and trigger balance refresh when component mounts
      isLoadingBalances = true;
      refreshBalances(true);
      
      // Calculate initial portfolio value after a small delay to allow data loading
      setTimeout(() => {
        const calculated = calculateTotalPortfolioValue($currentUserBalancesStore, $currentUserPoolsStore?.filteredPools || []);
        if (calculated > 0) {
          lastKnownPortfolioValue = calculated;
          totalPortfolioValue = calculated;
        }
      }, 1000);
    }
  });
</script>

<!-- Fixed portfolio overview section -->
<div
  class="z-10 bg-kong-bg-dark/95 backdrop-blur-sm border-b border-kong-border"
>
  <!-- Portfolio Overview -->
  <div class="px-5 py-3">
    <div class="flex justify-between items-center mb-2">
      <div class="text-sm text-kong-text-secondary flex items-center gap-2 cursor-pointer" aria-label="Total Portfolio Value" onclick={() => {
        goto(`/wallets/${walletId}`);
      }}>
        Total Portfolio Value
        <div class="flex items-center gap-2">
          <button
            class="p-1 text-kong-text-secondary/60 hover:text-kong-primary rounded-full hover:bg-kong-bg-light/20 transition-all {isRefreshing
              ? 'animate-spin'
              : ''}"
            onclick={() => refreshBalances(true)}
            disabled={isRefreshing}
            use:tooltip={{ text: "Refresh balance data", direction: "bottom" }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      {#if $auth?.account?.owner}
        <div
          class="text-xs text-kong-text-secondary font-mono flex items-center gap-1 cursor-pointer group"
          title="Click to copy your Principal ID"
          onclick={() => handleCopyPrincipal(walletId)}
          use:tooltip={{ text: "Copy Principal ID", direction: "bottom" }}
        >
          <span class="group-hover:text-kong-primary transition-colors"
            >{truncateAddress($auth?.account?.owner?.toString())}</span
          >
          {#if hasCopiedPrincipal}
            <Check size={11} class="text-kong-accent-green" />
          {:else}
            <Copy
              size={11}
              class="opacity-60 group-hover:opacity-100 transition-opacity"
            />
          {/if}
        </div>
      {/if}
    </div>
    <div class="text-2xl font-bold text-kong-text-primary cursor-pointer" aria-label="Total Portfolio Value" onclick={() => {
      goto(`/wallets/${walletId}`);
    }}>
      {#if isLoadingBalances && Object.keys($currentUserBalancesStore || {}).length === 0}
        <span class="opacity-50">Loading...</span>
      {:else}
        ${(isNaN(totalPortfolioValue) ? 0 : totalPortfolioValue).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      {/if}
    </div>
  </div>

  <!-- Section Tabs -->
  <div class="flex border-b border-kong-border">
    {#each tabsConfig as tab}
      {@const Icon = tab.icon}
      <button
        class="flex-1 py-2.5 px-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors relative {activeSection === tab.id
          ? 'text-kong-primary'
          : 'text-kong-text-secondary hover:text-kong-text-primary'}"
        onclick={() => {
          activeSection = tab.id as WalletSection;
          // Don't trigger a balance refresh when switching tabs
        }}
      >
        <Icon size={14} />
        <span>{tab.label}</span>
        {#if activeSection === tab.id}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-kong-primary animate-tab-indicator"></div>
        {/if}
      </button>
    {/each}
  </div>
</div>

<!-- Scrollable content area for tab content -->
<div
  class="overflow-y-auto scrollbar-thin"
  style="height: calc(100vh - 144px);"
>
  <!-- Tab Content: Dynamically show the appropriate component -->
  {#if tabComponents[activeSection]}
    {@const tabData = tabComponents[activeSection]}
    {@const props = tabData.props ? tabData.props() : {}}
    {@const Component = tabData.component}
    <Component {...props} />
  {/if}
</div>

<!-- Token Action Modals -->
{#if showSendTokenModal && selectedTokenForAction}
  <div transition:fade={{ duration: 200 }}>
    <SendTokenModal
      token={selectedTokenForAction.token}
      isOpen={showSendTokenModal}
      onClose={closeModal}
      onSuccess={handleSendSuccess}
    />
  </div>
{/if}

<style>
  /* Scrollbar styling */
  :global(.scrollbar-thin::-webkit-scrollbar) {
    width: 0.375rem; /* w-1.5 */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-track) {
    background-color: transparent; /* bg-transparent */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-thumb) {
    background-color: var(--kong-border); /* bg-kong-border */
    border-radius: 9999px; /* rounded-full */
  }

  @keyframes tabIndicatorIn {
    from { transform: scaleX(0); opacity: 0; }
    to { transform: scaleX(1); opacity: 1; }
  }

  .animate-tab-indicator {
    transform-origin: center;
    animation: tabIndicatorIn 0.2s ease-out forwards;
  }
</style>
