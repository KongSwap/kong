<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import {
    Coins,
    Droplet,
    Clock,
    User,
    Copy,
    Check,
    RefreshCw,
    Eye,
    EyeOff,
  } from "lucide-svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import {
    currentUserBalancesStore,
    loadBalances,
  } from "$lib/stores/balancesStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";
  import { truncateAddress } from "$lib/utils/principalUtils";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import WalletTokensList from "$lib/components/wallet/WalletTokensList.svelte";
  import WalletPoolsList from "$lib/components/wallet/WalletPoolsList.svelte";
  import WalletAddressesList from "$lib/components/wallet/WalletAddressesList.svelte";
  import WalletHistoryList from "$lib/components/wallet/WalletHistoryList.svelte";
  import SendTokenModal from "$lib/components/wallet/SendTokenModal.svelte";
  import { calculatePortfolioValue } from "$lib/utils/portfolioUtils";
  import { loadUserBalances, setLastRefreshed } from "$lib/services/balanceService";

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
  let showUsdValues = $state(true);

  const USD_VISIBILITY_KEY = "wallet_usd_visibility";

  // Define tabs configuration
  const tabsConfig = [
    { id: 'tokens', label: 'Tokens', icon: Coins },
    { id: 'pools', label: 'Pools', icon: Droplet },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'addresses', label: 'Addresses', icon: User }
  ];

  // Component map for tab content
  const tabComponents = {
    tokens: {
      component: WalletTokensList,
      props: () => {
        return ({
          walletId,
          isLoading: isLoadingBalances,
          onAction: handleTokenAction,
          onTokenAdded: handleTokenAdded,
          onBalancesLoaded: handleBalancesLoaded,
          showUsdValues,
          onRefresh: () => {
            refreshBalances(true);
          }
        });
      }
    },
    pools: {
      component: WalletPoolsList,
      props: () => ({
        liquidityPools: $currentUserPoolsStore?.filteredPools || [],
        isLoading: isLoadingBalances || $currentUserPoolsStore?.loading,
        onRefresh: refreshPoolsData,
        showUsdValues,
        isRefreshing,
        onNavigate: navigateAndClose
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
    if (!token?.token?.address && action !== "send") {
      console.error(`Cannot perform ${action}: Invalid token canister ID`);
      return;
    }

    // Handle different token actions
    if (action === "send") {
      selectedTokenForAction = token;
      showSendTokenModal = true;
    } else if (action === "swap") {
      navigateAndClose(`/pro?from=${token.token?.address}&to=ryjl3-tyaaa-aaaaa-aaaba-cai`);
    } else if (action === "info") {
      navigateAndClose(`/stats/${token.token?.address}`);
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
    const calculated = calculatePortfolioValue($currentUserBalancesStore, $currentUserPoolsStore?.filteredPools || []);
    
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
    
    // Add a safety timeout to reset loading state after 30 seconds
    const safetyTimeout = setTimeout(() => {
      isRefreshing = false;
      isLoadingBalances = false;
    }, 15000);
    
    // Refresh pools data if in pools section, without resetting first
    if (activeSection === 'pools') {
      currentUserPoolsStore.initialize();
    }
    
    // Refresh token balances
    if (walletId) {
      loadUserBalances(walletId, forceRefresh)
        .then(() => {
          // Balance loading handled within loadUserBalances
        })
        .catch((err) => {
          console.error("Error refreshing token balances:", err);
        })
        .finally(() => {
          // Always reset token loading state regardless of pools
          isLoadingBalances = false;
          
          // Reset refresh state if this specific operation initiated it
          if (!(activeSection === 'pools')) {
            isRefreshing = false;
          }
          
          setLastRefreshed(Date.now());
          clearTimeout(safetyTimeout);

          // Recalculate portfolio value after potentially new data
          const calculated = calculatePortfolioValue($currentUserBalancesStore, $currentUserPoolsStore?.filteredPools || []);
          if (calculated > 0) {
            lastKnownPortfolioValue = calculated;
            totalPortfolioValue = calculated;
          } else if (lastKnownPortfolioValue > 0) {
             totalPortfolioValue = lastKnownPortfolioValue;
          } else {
             totalPortfolioValue = 0;
          }
        });
    } else {
      // If no wallet ID, just end the loading state for balances
      isLoadingBalances = false;
      isRefreshing = false;
      clearTimeout(safetyTimeout);
    }
  }

  // Handle token added by the user
  function handleTokenAdded(newToken: Kong.Token) {
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

  // Effect to save USD visibility state
  $effect(() => {
    localStorage.setItem(USD_VISIBILITY_KEY, JSON.stringify(showUsdValues));
  });

  // Load token data on mount and load persisted state
  onMount(async () => {
    // Load persisted USD visibility state
    const stored = localStorage.getItem(USD_VISIBILITY_KEY);
    const persistedVisibility = stored ? JSON.parse(stored) as boolean : null;
    if (persistedVisibility !== null) {
      showUsdValues = persistedVisibility;
    }

    // User tokens might not be loaded yet
    userTokens.refreshTokenData();
    
    // Initialize pool data
    currentUserPoolsStore.initialize();

    // Get the current wallet ID
    if ($auth?.account?.owner) {
      walletId = $auth.account.owner;
      
      // Set loading state and trigger balance refresh when component mounts
      isLoadingBalances = true;
      refreshBalances(true);
      
      // Calculate initial portfolio value without delay
      const calculated = calculatePortfolioValue($currentUserBalancesStore, $currentUserPoolsStore?.filteredPools || []);
      if (calculated > 0) {
        lastKnownPortfolioValue = calculated;
        totalPortfolioValue = calculated;
      }
    }
  });

  // Toggle USD visibility
  function toggleUsdVisibility() {
    showUsdValues = !showUsdValues;
  }

  // Add a function to refresh pools data
  function refreshPoolsData() {
    if (activeSection === 'pools') {
      isRefreshing = true; // Indicate refresh start
      
      // Add a safety timeout to reset loading state after 30 seconds
      const safetyTimeout = setTimeout(() => {
        isRefreshing = false;
      }, 30000);
      
      currentUserPoolsStore.initialize()
        .finally(() => {
          // Always reset refreshing state when pools are done,
          // regardless of token balance loading state
          isRefreshing = false;
          clearTimeout(safetyTimeout);
        });
    }
  }
</script>

<!-- Fixed portfolio overview section -->
<div
  class="border-b border-kong-border"
>
  <!-- Portfolio Overview -->
  <div class="px-5 py-3 bg-kong-bg-secondary/50">
    <div class="flex justify-between items-center mb-2">
      <div class="text-sm text-kong-text-primary flex items-center gap-2 cursor-pointer" aria-label="Total Portfolio Value">
        <span onclick={() => {
          goto(`/wallets/${walletId}`);
        }}>Total Portfolio Value</span>
        <div class="flex items-center gap-2">
          <button
            class="p-1 {isRefreshing ? 'text-kong-text-primary bg-kong-primary/10' : 'text-kong-text-primary/60 hover:text-kong-primary hover:bg-kong-primary/10'} rounded-full transition-all"
            onclick={() => refreshBalances(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={12} class={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            class="p-1 text-kong-text-primary/60 hover:text-kong-primary rounded-full hover:bg-kong-bg-secondary/20 transition-all"
            onclick={toggleUsdVisibility}
          >
            {#if showUsdValues}
              <EyeOff size={12} />
            {:else}
              <Eye size={12} />
            {/if}
          </button>
        </div>
      </div>
      {#if $auth?.account?.owner}
        <div
          class="text-xs text-kong-text-secondary font-mono flex items-center gap-1 cursor-pointer group"
          title="Click to copy your Principal ID"
          onclick={() => handleCopyPrincipal(walletId)}
        >
          <span class="group-hover:text-kong-primary transition-colors"
            >{truncateAddress($auth?.account?.owner)}</span
          >
          {#if hasCopiedPrincipal}
            <Check size={11} class="text-kong-success" />
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
      {:else if !showUsdValues}
        $****
      {:else}
        ${(isNaN(totalPortfolioValue) ? 0 : totalPortfolioValue).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      {/if}
    </div>
  </div>

  <!-- Section Tabs -->
  <div class="flex">
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
<div class="h-full overflow-y-auto">
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
