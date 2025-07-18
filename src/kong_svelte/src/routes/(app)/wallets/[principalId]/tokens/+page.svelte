<script lang="ts">
  import WalletTokenList from "./WalletTokenList.svelte";
  import { WalletDataService, walletDataStore } from "$lib/services/wallet";
  import Card from "$lib/components/common/Card.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import LoadingEllipsis from "$lib/components/common/LoadingEllipsis.svelte";
  import { page } from "$app/state";
  import {
    Coins,
    DollarSign,
    TrendingUp,
    ArrowUp,
    ArrowDown,
  } from "lucide-svelte";
  import type { PortfolioHistory } from "$lib/utils/portfolio/portfolioHistory";
  import { getPortfolioHistory } from "$lib/utils/portfolio/portfolioHistory";
  import { calculatePerformanceMetrics } from "$lib/utils/portfolio/performanceMetrics";

  let { principal } = $props<{ principal?: string }>();
  let isLoading = $state(false);
  let isLoadingHistory = $state(false);
  let loadingError = $state<string | null>(null);
  let portfolioHistory = $state<PortfolioHistory[]>([]);
  let performanceMetrics = $state({
    dailyChange: 0,
    bestPerformer: { symbol: "", change: 0 },
  });

  let walletData = $derived($walletDataStore);
  let currentPrincipalId = $state<string>("");

  // Load wallet data when component mounts or principal changes
  async function loadWalletData(principalId: string) {
    if (!principalId || principalId === "anonymous") {
      return;
    }
    
    // Check if we already have data for this principal
    if ($walletDataStore.currentWallet === principalId && 
        $walletDataStore.tokens.length > 0 &&
        Object.keys($walletDataStore.balances).length > 0) {
      return;
    }
    
    try {
      isLoading = true;
      await WalletDataService.initializeWallet(principalId);
    } catch (error) {
      console.error("Failed to load wallet data:", error);
      loadingError = error instanceof Error ? error.message : "Failed to load wallet data";
    } finally {
      isLoading = false;
    }
  }

  // Reactive calculations for overview metrics
  let tokensWithBalance = $derived(
    walletData.tokens.filter((token) => {
      const balance = walletData.balances[token.address];
      return balance && Number(balance.in_tokens || "0") > 0;
    }) || [],
  );

  let totalTokenValue = $derived(
    Object.values(walletData.balances).reduce(
      (sum, balance) => sum + Number(balance?.in_usd || "0"),
      0,
    ),
  );

  // Derived loading state that accounts for all loading conditions
  let isDataLoading = $derived(
    isLoading ||
      isLoadingHistory ||
      walletData.isLoading ||
      (walletData.tokens.length > 0 &&
        Object.keys(walletData.balances).length === 0),
  );

  // Format currency
  function formatCurrency(value: number): string {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Format percentage
  function formatPercentage(value: number): string {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  // Load wallet data and history
  async function loadTokensOnly(principalId: string) {
    if (isLoading || !principalId) return;

    try {
      isLoading = true;
      loadingError = null;

      await WalletDataService.loadTokensOnly(principalId);

      if (Object.keys(walletData.balances).length > 0) {
        loadHistory(principalId);
      }
    } catch (error) {
      console.error("Failed to load tokens:", error);
      loadingError =
        error instanceof Error
          ? error.message
          : "Failed to load token metadata";
    } finally {
      isLoading = false;
    }
  }

  // Load history data for accurate 24h performance
  async function loadHistory(principal: string) {
    try {
      isLoadingHistory = true;
      const history = getPortfolioHistory(principal, 1);

      if (history && history.length >= 2) {
        portfolioHistory = history;
        performanceMetrics = calculatePerformanceMetrics(
          history,
          walletData.tokens,
        );
      } else {
        resetPerformanceData();
      }
    } catch (err) {
      console.error("Failed to load portfolio history:", err);
      resetPerformanceData();
    } finally {
      isLoadingHistory = false;
    }
  }

  function resetPerformanceData() {
    portfolioHistory = [];
    performanceMetrics = {
      dailyChange: 0,
      bestPerformer: { symbol: "", change: 0 },
    };
  }

  // Debounced history loading
  let historyLoadTimeout: number | null = null;

  // Load data when principal changes
  $effect(() => {
    const newPrincipal = page.params.principalId;
    if (newPrincipal && newPrincipal !== currentPrincipalId) {
      currentPrincipalId = newPrincipal;
      resetPerformanceData();
      loadWalletData(newPrincipal);
    } else if (newPrincipal && !$walletDataStore.currentWallet) {
      // Initial load
      loadWalletData(newPrincipal);
    }
  });

  // Load history when balances are available
  $effect(() => {
    const principal = page.params.principalId;
    const walletState = $walletDataStore;
    const hasBalances = Object.keys(walletState.balances).length > 0;
    const hasTokens = walletState.tokens.length > 0;

    // Update local error state from store
    loadingError = walletState.error;

    // Clear any pending history load timeout
    if (historyLoadTimeout !== null) {
      clearTimeout(historyLoadTimeout);
      historyLoadTimeout = null;
    }

    // Load history only when we have both tokens and balances for the correct principal
    if (
      principal &&
      walletState.currentWallet === principal &&
      hasTokens &&
      hasBalances &&
      !isLoadingHistory &&
      portfolioHistory.length === 0
    ) {
      // Debounce history loading slightly
      historyLoadTimeout = setTimeout(
        () => loadHistory(principal),
        100,
      ) as unknown as number;
    }
  });
</script>

<svelte:head>
  <title>Token balances for {page.params.principalId} - KongSwap</title>
</svelte:head>

<div class="space-y-6">
  <!-- Tokens Overview Card -->
  <Card isPadded={true}>
    <div class="flex items-center justify-between">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">
        Tokens Overview
      </h3>
      <div class="p-2 rounded-lg">
        <Coins class="w-3 h-3 text-kong-primary" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mt-4">
      <div class="flex flex-col p-3 sm:p-4 rounded-lg">
        <div
          class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
        >
          <DollarSign class="w-3 h-3 sm:w-4 sm:h-4" />
          <span>Total Value</span>
        </div>
        <div class="text-lg sm:text-xl font-medium">
          {#if isDataLoading}
            <span class="flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-lg" />
            </span>
          {:else}
            {formatCurrency(totalTokenValue)}
          {/if}
        </div>
      </div>

      <div class="flex flex-col p-3 sm:p-4 rounded-lg">
        <div
          class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
        >
          <TrendingUp class="w-3 h-3 sm:w-4 sm:h-4" />
          <span>24h Change</span>
        </div>
        {#if isDataLoading}
          <div class="text-lg sm:text-xl font-medium">
            <span class="flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-lg" />
            </span>
          </div>
        {:else}
          <div
            class="text-lg sm:text-xl font-medium flex items-center"
            class:text-kong-success={performanceMetrics.dailyChange > 0}
            class:text-kong-error={performanceMetrics.dailyChange < 0}
          >
            {formatPercentage(performanceMetrics.dailyChange)}
            {#if performanceMetrics.dailyChange > 0}
              <ArrowUp class="inline h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            {:else if performanceMetrics.dailyChange < 0}
              <ArrowDown class="inline h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex flex-col p-3 sm:p-4 rounded-lg">
        <div
          class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
        >
          <Coins class="w-3 h-3 sm:w-4 sm:h-4" />
          <span>Active Tokens</span>
        </div>
        <div class="text-lg sm:text-xl font-medium">
          {#if isDataLoading}
            <span class="flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-lg" />
            </span>
          {:else}
            {tokensWithBalance.length}
          {/if}
        </div>
      </div>
    </div>
  </Card>

  <!-- Token List Card -->
  <Card isPadded={true}>
    <div class="flex flex-col gap-4">
      <!-- Header with Filter Toggle -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm uppercase font-medium text-kong-text-primary">
          Token Balances
        </h3>
        <div class="p-2 rounded-lg">
          <Coins class="w-3 h-3 text-kong-primary" />
        </div>
      </div>

      <!-- Content -->
      {#if isDataLoading}
        <LoadingIndicator
          message={isLoading
            ? "Initializing wallet data..."
            : "Loading balances..."}
        />
      {:else if loadingError}
        <div class="text-kong-error mb-4">{loadingError}</div>
        <button
          class="text-sm text-kong-primary hover:text-opacity-80 transition-colors"
          onclick={() =>
            page.params.principalId && loadTokensOnly(page.params.principalId)}
        >
          Try Again
        </button>
      {:else if walletData.tokens.length === 0}
        <LoadingIndicator message="Loading token data..." />
      {:else}
        <WalletTokenList
          tokens={walletData.tokens}
          showHeader={false}
          showOnlyWithBalance={true}
          isLoading={isDataLoading}
        />
      {/if}
    </div>
  </Card>
</div>
