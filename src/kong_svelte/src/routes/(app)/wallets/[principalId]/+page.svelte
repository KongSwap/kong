<script lang="ts">
  import { page } from "$app/state";
  import { walletDataStore, WalletDataService } from "$lib/services/wallet";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import {
    formatBalance,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import LoadingEllipsis from "$lib/components/common/LoadingEllipsis.svelte";
  import {
    Wallet,
    ArrowRight,
    Coins,
    ChartPie,
    DollarSign,
    TrendingUp,
    ExternalLink,
  } from "lucide-svelte";
  import { onDestroy } from "svelte";
  import { calculatePortfolioValue, formatCurrency } from "$lib/utils/portfolioUtils";

  // Get props passed from layout
  let { initialDataLoading, initError } = $props<{
    initialDataLoading?: boolean;
    initError?: string | null;
  }>();

  // Use derived values from the store for loading state
  let isLoading = $derived(initialDataLoading ?? $walletDataStore.isLoading);
  let loadingError = $derived(initError ?? $walletDataStore.error);
  let totalValue = $state<number>(0);

  // Track the current principal ID to detect changes
  let currentPrincipalId = $state(page.params.principalId);

  // Whale threshold - percentage of total supply that makes a holder a "whale"
  const WHALE_THRESHOLD = 1; // 1% of total supply

  // Calculate tokens with non-zero balances
  let tokensWithBalance = $derived(
    $walletDataStore?.balances
      ? Object.entries($walletDataStore.balances).filter(
          ([_, balance]) => Number(balance?.in_tokens || "0") > 0,
        ).length
      : 0,
  );

  // Computed total value from wallet balances
  $effect(() => {
    if ($walletDataStore?.balances) {
      totalValue = calculatePortfolioValue($walletDataStore.balances, []);
    } else {
      totalValue = 0;
    }
  });

  // Reset data when principal ID changes
  $effect(() => {
    if (page.params.principalId !== currentPrincipalId) {
      // Force a complete reset of the wallet data
      WalletDataService.reset();

      // Reset the total value and UI state
      totalValue = 0;

      // Update the current principal ID
      currentPrincipalId = page.params.principalId;

      // Re-initialize wallet data for the new principal
      WalletDataService.initializeWallet(page.params.principalId);
    }
  });

  // Format percentage of total supply
  function formatSupplyPercentage(percent: number): string {
    return percent.toFixed(2) + "%";
  }

  // Check if a token position is a whale position
  function isWhalePosition(tokenId: string, balance: string | bigint): boolean {
    const token = $walletDataStore.tokens?.find(
      (t) => t.address === tokenId,
    );
    if (!token || !token.metrics?.total_supply) return false;

    const totalSupply = Number(token.metrics.total_supply);
    if (totalSupply <= 0) return false;

    const balanceStr =
      typeof balance === "bigint" ? balance.toString() : balance;
    const percentOfSupply = (Number(balanceStr) / totalSupply) * 100;
    return percentOfSupply >= WHALE_THRESHOLD;
  }

  // Get percentage of total supply for a token
  function getSupplyPercentage(
    tokenId: string,
    balance: string | bigint,
  ): number {
    const token = $walletDataStore.tokens?.find(
      (t) => t.address === tokenId,
    );
    if (!token || !token.metrics?.total_supply) return 0;

    const totalSupply = Number(token.metrics.total_supply);
    if (totalSupply <= 0) return 0;

    const balanceStr =
      typeof balance === "bigint" ? balance.toString() : balance;
    return (Number(balanceStr) / totalSupply) * 100;
  }

  // Tooltip text for whale indicator
  const whaleTooltipText = `This wallet holds at least ${WHALE_THRESHOLD}% of the token's total supply, making it a significant holder ("whale").`;

  // Clean up when component is destroyed
  onDestroy(() => {
    // Reset any component-specific state here if needed
    totalValue = 0;
  });
</script>

<svelte:head>
  <title>Wallet Overview for {page.params.principalId} - KongSwap</title>
  <meta name="description" content="View your wallet overview and portfolio distribution" />
</svelte:head>

<div class="space-y-2">
  <!-- Wallet Overview Header Panel -->
  <Panel>
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">
        Wallet Overview
      </h3>
      <div class="p-2 rounded-lg">
        <Wallet class="w-3 h-3 text-kong-primary" />
      </div>
    </div>

    {#if isLoading}
      <div class="flex flex-col gap-4">
        <!-- Stats Cards with Loading Ellipsis -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total Value Card -->
          <div class="rounded-lg p-4">
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <DollarSign class="w-4 h-4" />
              <span>Total Value</span>
            </div>
            <div class="text-xl font-medium flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-xl" />
            </div>
          </div>

          <!-- Active Tokens Card -->
          <div class="rounded-lg p-4">
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <Coins class="w-4 h-4" />
              <span>Tokens</span>
            </div>
            <div class="text-xl font-medium flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-xl" />
            </div>
          </div>

          <!-- Most Valuable Token Card -->
          <div class="rounded-lg p-4">
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <TrendingUp class="w-4 h-4" />
              <span>Largest Position</span>
            </div>
            <div class="text-xl font-medium flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-xl" />
            </div>
          </div>

          <!-- Portfolio Status Card -->
          <div class="rounded-lg p-4">
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <ChartPie class="w-4 h-4" />
              <span>Portfolio Status</span>
            </div>
            <div class="text-xl font-medium flex items-center">
              <LoadingEllipsis color="text-kong-text-primary" size="text-xl" />
            </div>
          </div>
        </div>
      </div>
    {:else if loadingError}
      <div class="flex flex-col gap-4">
        <div class="text-kong-error mb-2">{loadingError}</div>
        <button
          class="text-sm text-kong-primary hover:text-opacity-80 transition-colors"
          onclick={() =>
            WalletDataService.initializeWallet(page.params.principalId)}
        >
          Try Again
        </button>
      </div>
    {:else}
      <div class="flex flex-col gap-6">
        <!-- Asset Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total Value Card -->
          <div
            class=" rounded-lg p-4 hover:bg-kong-bg-primary/40 transition-colors cursor-pointer"
          >
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <DollarSign class="w-4 h-4" />
              <span>Total Value</span>
            </div>
            <div class="text-xl font-medium">
              {formatCurrency(totalValue)}
            </div>
          </div>

          <!-- Active Tokens Card -->
          <div
            class=" rounded-lg p-4 hover:bg-kong-bg-primary/40 transition-colors cursor-pointer"
            onclick={() => goto(`/wallets/${page.params.principalId}/tokens`)}
          >
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <Coins class="w-4 h-4" />
              <span>Tokens</span>
            </div>
            <div class="text-xl font-medium flex items-center">
              {tokensWithBalance}
              <ArrowRight class="w-4 h-4 ml-2 text-kong-primary opacity-70" />
            </div>
          </div>

          <!-- Most Valuable Token Card -->
          <div
            class=" rounded-lg p-4 hover:bg-kong-bg-primary/40 transition-colors cursor-pointer"
          >
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <TrendingUp class="w-4 h-4" />
              <span>Largest Holding</span>
            </div>
            {#if Object.entries($walletDataStore.balances).length > 0}
              {@const topAsset = Object.entries($walletDataStore.balances).sort(
                (a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0),
              )[0]}
              {@const token = $walletDataStore.tokens?.find(
                (t) => t.address === topAsset[0],
              )}
              {@const isWhale = isWhalePosition(
                topAsset[0],
                topAsset[1]?.in_tokens || "0",
              )}
              {@const whalePercentage = getSupplyPercentage(
                topAsset[0],
                topAsset[1]?.in_tokens || "0",
              )}
              <div class="flex flex-col">
                {#if token}
                  <div class="flex items-center gap-2">
                    <TokenImages tokens={[token]} size={20} />
                    <div class="text-xl font-medium">{token.symbol}</div>
                    {#if isWhale}
                      <Badge
                        variant="blue"
                        icon="🐋"
                        size="sm"
                        tooltip={whaleTooltipText}
                      >
                        {formatSupplyPercentage(whalePercentage)}
                      </Badge>
                    {/if}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="text-xl font-medium">-</div>
            {/if}
          </div>

          <!-- Portfolio Status Card -->
          <div
            class=" rounded-lg p-4 hover:bg-kong-bg-primary/40 transition-colors cursor-pointer"
          >
            <div
              class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1"
            >
              <ChartPie class="w-4 h-4" />
              <span>Portfolio Status</span>
            </div>
            <div class="text-xl font-medium">
              {Object.keys($walletDataStore.balances).length > 0
                ? "Active"
                : "Empty"}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </Panel>

  <!-- Portfolio Distribution Chart Panel -->
  <Panel variant="transparent">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">
        Portfolio Distribution
      </h3>
      <div class="p-2 rounded-lg">
        <ChartPie class="w-3 h-3 text-kong-primary" />
      </div>
    </div>

    {#if isLoading}
      <LoadingIndicator message="Loading portfolio data..." />
    {:else if loadingError}
      <div class="text-kong-error mb-4">{loadingError}</div>
    {:else if Object.keys($walletDataStore.balances).length === 0 || $walletDataStore.currentWallet !== page.params.principalId}
      <div
        class="flex items-center justify-center min-h-[300px] text-kong-text-secondary"
      >
        No assets to display
      </div>
    {:else}
      <div class="flex flex-col md:flex-row items-start justify-between gap-6">
        <div class="w-full md:w-1/2 flex flex-col gap-0 order-2 md:order-1">
          {#each Object.entries($walletDataStore.balances)
            .sort((a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0))
            .slice(0, 5) as [canisterId, balance], i}
            {#if $walletDataStore.tokens}
              {@const token = $walletDataStore.tokens.find(
                (t) => t.address === canisterId,
              )}
              {#if token}
                <div
                  class="flex items-center gap-2 hover:bg-kong-bg-primary/40 p-2 rounded-md transition-colors"
                >
                  <div
                    class="w-3 h-3 rounded-full"
                    style="background-color: {[
                      '#3B82F6',
                      '#10B981',
                      '#F59E0B',
                      '#EF4444',
                      '#8B5CF6',
                    ][i]}"
                  ></div>
                  <div class="flex-1 flex items-center gap-2">
                    <TokenImages tokens={[token]} size={20} />
                    <span>{token.symbol}</span>
                  </div>
                  <div class="text-right">
                    <div class="font-medium">
                      {(
                        (Number(balance?.in_usd || 0) / totalValue) *
                        100
                      ).toFixed(1)}%
                    </div>
                    <div class="text-xs text-kong-text-secondary">
                      ${formatToNonZeroDecimal(balance?.in_usd || 0)}
                    </div>
                  </div>
                </div>
              {/if}
            {/if}
          {/each}
          {#if Object.keys($walletDataStore.balances).length > 5}
            {@const othersValue = Object.entries($walletDataStore.balances)
              .sort(
                (a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0),
              )
              .slice(5)
              .reduce(
                (acc, [_, balance]) => acc + Number(balance?.in_usd || 0),
                0,
              )}
            {@const othersPercentage = (othersValue / totalValue) * 100}
            <div
              class="flex items-center gap-2 hover:bg-kong-bg-primary/40 p-2 rounded-md transition-colors"
            >
              <div class="w-3 h-3 rounded-full bg-kong-text-secondary"></div>
              <div class="flex-1">Others</div>
              <div class="text-right">
                <div class="font-medium">{othersPercentage.toFixed(1)}%</div>
                <div class="text-xs text-kong-text-secondary">
                  ${formatToNonZeroDecimal(othersValue)}
                </div>
              </div>
            </div>
          {/if}
        </div>
        <div
          class="w-full md:w-1/2 flex items-center justify-center mb-6 md:mb-0 order-1 md:order-2"
        >
          <!-- SVG Pie Chart - Responsive container -->
          {#key `${page.params.principalId}-${$walletDataStore.lastUpdated}-${totalValue}`}
            <div
              class="relative w-full max-w-[280px] md:max-w-[320px] aspect-square"
            >
              <svg viewBox="0 0 100 100" class="w-full h-full">
                <!-- Calculate and create pie slices based on token distribution -->
                {#if Object.entries($walletDataStore.balances).length > 0 && totalValue > 0 && $walletDataStore.currentWallet === page.params.principalId}
                  {@const sortedBalances = Object.entries(
                    $walletDataStore.balances,
                  ).sort(
                    (a, b) =>
                      Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0),
                  )}

                  {@const topFive = sortedBalances.slice(0, 5)}
                  {@const others = sortedBalances.slice(5)}

                  {@const colors = [
                    "#3B82F6",
                    "#10B981",
                    "#F59E0B",
                    "#EF4444",
                    "#8B5CF6",
                    "#6B7280",
                  ]}

                  <!-- Create SVG pie slices -->
                  {#if totalValue > 0}
                    {@const slices = [
                      ...topFive.map(([canisterId, balance], i) => ({
                        value: Number(balance?.in_usd || 0),
                        color: colors[i],
                        percentage:
                          (Number(balance?.in_usd || 0) / totalValue) * 100,
                      })),
                      ...(others.length > 0
                        ? [
                            {
                              value: others.reduce(
                                (sum, [_, balance]) =>
                                  sum + Number(balance?.in_usd || 0),
                                0,
                              ),
                              color: colors[5],
                              percentage:
                                (others.reduce(
                                  (sum, [_, balance]) =>
                                    sum + Number(balance?.in_usd || 0),
                                  0,
                                ) /
                                  totalValue) *
                                100,
                            },
                          ]
                        : []),
                    ]}

                    <!-- Normalize percentages to ensure they add up to exactly 100% -->
                    {@const totalPercentage = slices.reduce(
                      (sum, slice) => sum + slice.percentage,
                      0,
                    )}
                    {@const normalizedSlices = slices.map((slice, i) => ({
                      ...slice,
                      percentage:
                        i === slices.length - 1
                          ? 100 -
                            slices
                              .slice(0, -1)
                              .reduce((sum, s) => sum + s.percentage, 0)
                          : slice.percentage,
                    }))}

                    <!-- Draw the slices -->
                    {@const cumulativePercentage = [0]}
                    {#each normalizedSlices as slice, i (i)}
                      {@const startAngle =
                        (cumulativePercentage[i] / 100) * 360}
                      {@const endAngle =
                        ((cumulativePercentage[i] + slice.percentage) / 100) *
                        360}
                      {@const startRad = ((startAngle - 90) * Math.PI) / 180}
                      {@const endRad = ((endAngle - 90) * Math.PI) / 180}

                      {@const x1 = 50 + 40 * Math.cos(startRad)}
                      {@const y1 = 50 + 40 * Math.sin(startRad)}
                      {@const x2 = 50 + 40 * Math.cos(endRad)}
                      {@const y2 = 50 + 40 * Math.sin(endRad)}

                      {@const largeArcFlag = slice.percentage > 50 ? 1 : 0}

                      <path
                        d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                        fill={slice.color}
                        class="hover:opacity-90 transition-opacity cursor-pointer"
                      />

                      {cumulativePercentage.push(
                        cumulativePercentage[i] + slice.percentage,
                      )}
                    {/each}

                    <!-- Center circle for total value -->
                    <circle cx="50" cy="50" r="25" fill="#1E1E1E" />
                  {/if}
                {/if}
              </svg>
              <!-- Overlay text in the center -->
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <div class="text-xl font-bold">
                    ${formatToNonZeroDecimal(totalValue)}
                  </div>
                  <div class="text-xs text-kong-text-secondary">
                    Total Value
                  </div>
                </div>
              </div>
            </div>
          {/key}
        </div>
      </div>
    {/if}
  </Panel>

  <!-- Top Assets Section -->
  <Panel variant="transparent">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">
        Top Assets
      </h3>
      <div class="flex items-center gap-2">
        <button
          onclick={() => goto(`/wallets/${page.params.principalId}/tokens`)}
          class="flex items-center gap-1 text-sm text-kong-primary hover:text-opacity-80 transition-colors"
        >
          View All
          <ExternalLink class="w-3 h-3" />
        </button>
      </div>
    </div>

    {#if isLoading}
      <LoadingIndicator message="Loading assets..." />
    {:else if loadingError}
      <div class="text-kong-error mb-4">{loadingError}</div>
    {:else}
      <div class="overflow-x-auto rounded-lg">
        <table class="w-full">
          <thead
            class="text-sm text-kong-text-secondary border-b border-kong-border"
          >
            <tr>
              <th class="text-left py-3 px-4">Asset</th>
              <th class="text-right py-3 px-4">Balance</th>
              <th class="text-right py-3 px-4">USD Value</th>
              <th class="text-right py-3 px-4">% of Portfolio</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries($walletDataStore.balances)
              .sort((a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0))
              .slice(0, 5) as [canisterId, balance], i}
              {#if $walletDataStore.tokens}
                {@const token = $walletDataStore.tokens.find(
                  (t) => t.address === canisterId,
                )}
                {@const isWhale = isWhalePosition(
                  canisterId,
                  balance?.in_tokens || "0",
                )}
                {@const whalePercentage = getSupplyPercentage(
                  canisterId,
                  balance?.in_tokens || "0",
                )}
                {#if token}
                  <tr
                    class="border-b border-kong-border/50 hover:bg-kong-bg-primary/60 transition-colors cursor-pointer"
                  >
                    <td class="py-4 px-4">
                      <div class="flex items-center gap-3">
                        <TokenImages tokens={[token]} size={32} />
                        <div class="flex flex-col">
                          <div class="flex items-center gap-1">
                            <div class="font-semibold text-kong-text-primary">
                              {token.symbol}
                            </div>
                            {#if isWhale}
                              <Badge
                                variant="blue"
                                icon="🐋"
                                size="xs"
                                tooltip={whaleTooltipText}
                              >
                                {formatSupplyPercentage(whalePercentage)}
                              </Badge>
                            {/if}
                          </div>
                          <div class="text-xs text-kong-text-secondary">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-right py-4 px-4 text-kong-text-primary">
                      {#if balance && balance.in_tokens !== undefined}
                        <div class="font-medium">
                          {formatBalance(balance.in_tokens, token.decimals)}
                        </div>
                      {:else}
                        <div>-</div>
                      {/if}
                    </td>
                    <td class="text-right py-4 px-4 text-kong-text-primary">
                      <div class="font-medium">
                        ${formatToNonZeroDecimal(balance?.in_usd || "0")}
                      </div>
                    </td>
                    <td class="text-right py-4 px-4 text-kong-text-primary">
                      <div class="font-medium">
                        {(
                          (Number(balance?.in_usd || 0) / totalValue) *
                          100
                        ).toFixed(2)}%
                      </div>
                    </td>
                  </tr>
                {/if}
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Panel>
</div>
