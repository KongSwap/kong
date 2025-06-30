<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import type { Balance } from "$lib/services/wallet";
  import type { Token } from "$lib/types/token";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { balances, tokens, totalValue } = $props<{
    balances: Record<string, Balance>;
    tokens: Token[];
    totalValue: number;
  }>();

  const CHART_COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#6B7280",
  ];

  // Sort and prepare data
  let chartData = $derived.by(() => {
    const sorted = Object.entries(balances)
      .filter(([_, balance]) => Number(balance?.in_usd || 0) > 0)
      .sort((a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0));

    const topFive = sorted.slice(0, 5);
    const others = sorted.slice(5);

    const items = topFive.map(([canisterId, balance], i) => {
      const token = tokens.find((t) => t.address === canisterId);
      return {
        token,
        balance,
        value: Number(balance?.in_usd || 0),
        percentage: (Number(balance?.in_usd || 0) / totalValue) * 100,
        color: CHART_COLORS[i],
      };
    });

    if (others.length > 0) {
      const othersValue = others.reduce(
        (acc, [_, balance]) => acc + Number(balance?.in_usd || 0),
        0,
      );
      items.push({
        token: null,
        balance: null,
        value: othersValue,
        percentage: (othersValue / totalValue) * 100,
        color: CHART_COLORS[5],
      });
    }

    return items;
  });

  // Create pie chart slices
  function createSlicePath(startAngle: number, endAngle: number): string {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  }
</script>

<div class="flex flex-col md:flex-row items-start justify-between gap-6">
  <!-- Legend -->
  <div class="w-full md:w-1/2 flex flex-col gap-0 order-2 md:order-1">
    {#each chartData as item, i}
      <div
        class="flex items-center gap-2 hover:bg-kong-bg-primary/40 p-2 rounded-md transition-colors {item.token
          ? 'cursor-pointer'
          : ''}"
        onclick={() =>
          item.token &&
          goto(
            `/wallets/${page.params.principalId}/tokens/${item.token.address}`,
          )}
      >
        <div
          class="w-3 h-3 rounded-full flex-shrink-0"
          style="background-color: {item.color}"
        ></div>
        <div class="flex-1 flex items-center gap-2 min-w-0">
          {#if item.token}
            <TokenImages tokens={[item.token]} size={20} />
            <span class="truncate">{item.token.symbol}</span>
          {:else}
            <span>Others</span>
          {/if}
        </div>
        <div class="text-right flex-shrink-0">
          <div class="font-medium">{item.percentage.toFixed(1)}%</div>
          <div class="text-xs text-kong-text-secondary">
            ${formatToNonZeroDecimal(item.value)}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Pie Chart -->
  <div
    class="w-full md:w-1/2 flex items-center justify-center mb-6 md:mb-0 order-1 md:order-2"
  >
    <div class="relative w-full max-w-[280px] md:max-w-[320px] aspect-square">
      <svg viewBox="0 0 100 100" class="w-full h-full">
        {#if totalValue > 0}
          {#each chartData as item, i}
            {@const startAngle = chartData
              .slice(0, i)
              .reduce((sum, d) => sum + (d.percentage / 100) * 360, 0)}
            {@const endAngle = startAngle + (item.percentage / 100) * 360}

            <path
              d={createSlicePath(startAngle, endAngle)}
              fill={item.color}
              class="hover:opacity-90 transition-opacity cursor-pointer"
            />
          {/each}

          <!-- Center circle -->
          <circle cx="50" cy="50" r="25" fill="#1E1E1E" />
        {/if}
      </svg>

      <!-- Center text -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <div class="text-xl font-bold">
            ${formatToNonZeroDecimal(totalValue)}
          </div>
          <div class="text-xs text-kong-text-secondary">Total Value</div>
        </div>
      </div>
    </div>
  </div>
</div>
