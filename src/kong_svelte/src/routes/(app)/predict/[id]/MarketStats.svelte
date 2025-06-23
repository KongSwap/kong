<script lang="ts">
  import { TrendingUp, Clock, Users } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import MarketStatCard from "./MarketStatCard.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import type { Market } from "$lib/types/predictionMarket";
  import { userTokens } from "$lib/stores/userTokens";
  import { formatTimeLeft } from "$lib/utils/timeFormatUtils";

  export let totalPool: number;
  export let betCounts: any[];
  export let timeLeft: string;
  export let isMarketResolved: boolean;
  export let marketEndTime: string;
  export let market: Market;

  $: token = $userTokens.tokens.find((t) => t.address === market.token_id);

  $: timeLeftValue = isMarketResolved
    ? "Market Closed"
    : timeLeft || formatTimeLeft(marketEndTime);
  $: totalPredictionsValue = `${betCounts
    .reduce((a, b) => a + b, 0)
    .toLocaleString()} predictions`;
  $: totalPoolValue = `${formatBalance(totalPool, 8)} ${token?.symbol}`;
  $: totalPoolLogoUrl = token?.logo_url;

  $: marketStats = [
      {
      label: "Total Pool",
      value: totalPoolValue,
      icon: null,
      logoUrl: totalPoolLogoUrl,
    },
    {
      label: "Time Left",
      value: timeLeftValue,
      icon: Clock,
      logoUrl: null,
    },
    {
      label: "Total Predictions",
      value: totalPredictionsValue,
      icon: Users,
      logoUrl: null,
    },
  ];
</script>

<Panel
  variant="transparent"
  className="bg-kong-bg-primary/80 backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
>
  <h2 class="text-sm text-kong-text-secondary mb-2">
    Market Data
  </h2>
  <div class="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
    {#each marketStats as stat}
      <div class="{stat.label === 'Total Pool' ? 'col-span-2 lg:col-span-1' : ''}">
        <MarketStatCard
          icon={stat.icon}
          logoUrl={stat.logoUrl}
          label={stat.label}
          value={stat.value}
        />
      </div>
    {/each}
  </div>
</Panel>
