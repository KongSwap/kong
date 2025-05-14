<script lang="ts">
  import { onMount } from "svelte";
  import {
    marketStore,
    type StatusFilter,
    type SortOption,
  } from "$lib/stores/marketStore";
  import { auth } from "$lib/stores/auth";
  import { isAdmin } from "$lib/api/predictionMarket";
  import MarketSection from "../MarketSection.svelte";
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { formatCategory, formatBalance } from "$lib/utils/numberFormatUtils";
  import { Calendar, Folder, Coins } from "lucide-svelte";
  import AdminResolutionModal from "../AdminResolutionModal.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { baseTheme } from "$lib/themes/baseTheme";

  let isUserAdmin = false;
  let loadingAdmin = true;
  let showResolutionModal = false;
  let selectedMarket = null;

  // Stats summary
  $: totalMarkets = $marketStore.markets.length;
  $: activeMarkets = $marketStore.markets.filter(
    (m) => m.status && "Active" in m.status,
  ).length;
  $: pendingMarkets = $marketStore.markets.filter(
    (m) => m.status && "Pending" in m.status,
  ).length;
  $: closedMarkets = $marketStore.markets.filter(
    (m) => m.status && "Closed" in m.status,
  ).length;
  $: voidedMarkets = $marketStore.markets.filter(
    (m) => m.status && "Voided" in m.status,
  ).length;
  $: disputedMarkets = $marketStore.markets.filter(
    (m) => m.status && "Disputed" in m.status,
  ).length;

  // Status counts
  $: statusCounts = {
    all: $marketStore.markets.length,
    active: $marketStore.markets.filter((m) => m.status && "Active" in m.status)
      .length,
    pending: $marketStore.markets.filter(
      (m) => m.status && "Pending" in m.status,
    ).length,
    closed: $marketStore.markets.filter((m) => m.status && "Closed" in m.status)
      .length,
    disputed: $marketStore.markets.filter(
      (m) => m.status && "Disputed" in m.status,
    ).length,
    voided: $marketStore.markets.filter((m) => m.status && "Voided" in m.status)
      .length,
  };

  // Filters
  const statusOptions = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "closed", label: "Closed" },
    { value: "disputed", label: "Disputed" },
    { value: "voided", label: "Voided" },
  ];
  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "pool_desc", label: "Pool Size (High to Low)" },
    { value: "pool_asc", label: "Pool Size (Low to High)" },
    { value: "end_time_asc", label: "End Time (Soonest First)" },
    { value: "end_time_desc", label: "End Time (Latest First)" },
  ];

  $: currentStatus = $marketStore.statusFilter;
  $: currentSort = $marketStore.sortOption;

  // Chart.js chart for market stats
  let createdPerDayCanvas: HTMLCanvasElement;
  let createdPerDayChart: any = null;

  function getMarketsCreatedPerDay() {
    const counts: Record<string, number> = {};
    for (const m of $marketStore.markets) {
      if (!m.created_at) continue;
      const date = new Date(Number(m.created_at.toString()) / 1_000_000)
        .toISOString()
        .slice(0, 10); // YYYY-MM-DD
      counts[date] = (counts[date] || 0) + 1;
    }
    // Sort by date ascending
    const sorted = Object.entries(counts).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return {
      labels: sorted.map(([date]) => date),
      data: sorted.map(([, count]) => count),
    };
  }

  async function renderCreatedPerDayChart() {
    if (!createdPerDayCanvas) return;
    const Chart = (await import("chart.js/auto")).default;
    if (createdPerDayChart) {
      createdPerDayChart.destroy();
      createdPerDayChart = null;
    }
    const { labels, data } = getMarketsCreatedPerDay();
    createdPerDayChart = new Chart(createdPerDayCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Markets Created",
            data,
            borderColor: baseTheme.colors.accentBlue,
            backgroundColor: baseTheme.colors.accentBlue + "33", // 20% opacity
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: "transparent",
            titleColor: baseTheme.colors.textSecondary,
            bodyColor: baseTheme.colors.textPrimary,
            borderColor: baseTheme.colors.border,
            borderWidth: 1,
            padding: 10,
          },
        },
        layout: { padding: 0 },
        scales: {
          x: {
            grid: { display: false },
            ticks: { display: false },
          },
          y: {
            beginAtZero: false,
            grid: { display: false },
            ticks: { display: false },
            position: "right",
          },
        },
      },
    });
  }

  $: $marketStore.markets, renderCreatedPerDayChart();

  onMount(async () => {
    if ($auth.isConnected && $auth.account) {
      loadingAdmin = true;
      isUserAdmin = await isAdmin($auth.account.owner);
      loadingAdmin = false;
    }
    // Always load markets on mount
    await marketStore.init();
  });

  function getMarketStatusColor(market: any): string {
    if (market.status && "Closed" in market.status)
      return "bg-kong-accent-blue/20 text-kong-text-accent-blue";
    if (market.status && "Voided" in market.status)
      return "bg-kong-accent-red/20 text-kong-text-accent-red";
    if (market.status && "Pending" in market.status)
      return "bg-kong-accent-yellow/20 text-kong-accent-yellow";
    return "bg-kong-accent-green/20 text-kong-text-accent-green";
  }
  function getMarketStatusText(market: any): string {
    if (market.status && "Closed" in market.status) return "Resolved";
    if (market.status && "Voided" in market.status) return "Voided";
    if (market.status && "Pending" in market.status) return "Pending";
    return "Active";
  }
  function formatEndTime(endTime: string | bigint) {
    if (!endTime) return "-";
    // Ensure we always pass a string to new Date(Number(...))
    return new Date(Number(endTime.toString()) / 1_000_000).toLocaleString();
  }
  async function handleVoidMarket(market: any) {
    if (
      !confirm(`Are you sure you want to void the market "${market.question}"?`)
    )
      return;
    try {
      const { voidMarketViaAdmin } = await import("$lib/api/predictionMarket");
      await voidMarketViaAdmin(BigInt(market.id));
      await marketStore.refreshMarkets();
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
  async function handleResolveMarket(market: any) {
    selectedMarket = market;
    showResolutionModal = true;
  }
  function closeResolutionModal() {
    showResolutionModal = false;
    selectedMarket = null;
  }
  async function handleResolved() {
    await marketStore.refreshMarkets();
    closeResolutionModal();
  }
</script>

<div class="max-w-7xl mx-auto px-4">
  <div class="flex justify-between mb-4 items-center">
    <div class="flex flex-col gap-2">
      <h1
        class="text-3xl font-bold text-kong-accent-green flex items-center gap-3"
      >
        <svg
          class="w-7 h-7 text-kong-accent-green"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          ><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg
        >
        Prediction Markets Admin Panel
      </h1>
      <div class="mb-6 text-kong-text-secondary text-base">
        <strong>Admin tools:</strong> Manage, resolve, or void prediction
        markets. <br />
        <span class="text-xs text-kong-accent-red"
          >Warning: Admin actions are irreversible and affect user funds.</span
        >
      </div>
    </div>

    <!-- Markets Created Per Day Chart -->
    <div class="h-28 flex items-center justify-center px-2">
      <canvas bind:this={createdPerDayCanvas} class="w-full h-full"></canvas>
    </div>
  </div>

  {#if loadingAdmin}
    <div>Checking admin status...</div>
  {:else if !isUserAdmin}
    <div class="mb-6">
      <Badge variant="red" size="md">You are not an admin.</Badge>
    </div>
  {/if}

  <div class="flex flex-wrap gap-2 mb-4">
    {#each statusOptions as option}
      <ButtonV2
        size="sm"
        theme={option.value === $marketStore.statusFilter
          ? "accent-green"
          : "secondary"}
        on:click={() =>
          marketStore.setStatusFilter(option.value as StatusFilter)}
      >
        {option.label} ({statusCounts[option.value]})
      </ButtonV2>
    {/each}
    <div class="ml-auto flex gap-2">
      <select
        class="border rounded px-2 py-1 text-sm"
        bind:value={$marketStore.sortOption}
        on:change={(e) =>
          marketStore.setSortOption(
            (e.target as HTMLSelectElement).value as SortOption,
          )}
      >
        {#each sortOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Table layout for admin markets -->
  <AdminResolutionModal
    isOpen={showResolutionModal}
    market={selectedMarket}
    onClose={closeResolutionModal}
    onResolved={handleResolved}
  />
  <div
    class="overflow-x-auto rounded shadow border border-kong-border bg-kong-bg-light"
  >
    <table class="min-w-full text-sm">
      <thead class="bg-kong-bg-dark/80">
        <tr>
          <th class="px-4 py-2 text-left">Question</th>
          <th class="px-4 py-2 text-left">Status</th>
          <th class="px-4 py-2 text-left">Pool Size</th>
          <th class="px-4 py-2 text-left">End Time</th>
          <th class="px-4 py-2 text-left">Category</th>
          <th class="px-4 py-2 text-left">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if $marketStore.markets.length === 0}
          <tr>
            <td colspan="6" class="text-center py-6 text-kong-text-secondary"
              >No markets in this category</td
            >
          </tr>
        {:else}
          {#each $marketStore.markets as market}
            <tr
              class="border-b border-kong-border hover:bg-kong-bg-dark/10 transition"
            >
              <td class="px-4 py-2 max-w-xs truncate">
                <a
                  class="text-kong-primary hover:underline"
                  href={`/predict/${market.id}`}>{market.question}</a
                >
              </td>
              <td class="px-4 py-2">
                <span
                  class={`px-2 py-1 rounded text-xs font-semibold ${getMarketStatusColor(market)}`}
                  >{getMarketStatusText(market)}</span
                >
              </td>
              <td class="px-4 py-2 whitespace-nowrap">
                <span class="flex items-center gap-1">
                  <TokenImages
                    tokens={[
                      $userTokens.tokens.find(
                        (t) => t.address === market.token_id,
                      ),
                    ]}
                    size={22}
                  />
                  {formatBalance(
                    market.outcome_pools?.reduce(
                      (a, b) => a + Number(b || 0),
                      0,
                    ) || 0,
                    8,
                  )}
                  {$userTokens.tokens.find((t) => t.address === market.token_id)
                    ?.symbol}</span
                >
              </td>
              <td class="px-4 py-2 whitespace-nowrap">
                <span class="flex items-center gap-1"
                  ><Calendar class="w-4 h-4" />{formatEndTime(
                    market.end_time,
                  )}</span
                >
              </td>
              <td class="px-4 py-2 whitespace-nowrap">
                <span class="flex items-center gap-1"
                  ><Folder class="w-4 h-4" />{formatCategory(
                    market.category,
                  )}</span
                >
              </td>
              <td class="px-4 py-2">
                {#if isUserAdmin}
                  <div class="flex gap-2">
                    <button
                      class="px-2 py-1 rounded bg-kong-accent-green/10 text-kong-accent-green border border-kong-accent-green/30 hover:bg-kong-accent-green/20 text-xs font-medium"
                      on:click={() => handleResolveMarket(market)}
                      >Resolve</button
                    >
                    <button
                      class="px-2 py-1 rounded bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/30 hover:bg-kong-accent-red/20 text-xs font-medium"
                      on:click={() => handleVoidMarket(market)}>Void</button
                    >
                  </div>
                {:else}
                  <span class="text-xs text-kong-text-secondary">-</span>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
  h1 {
    color: var(--kong-accent-green);
  }
</style>
