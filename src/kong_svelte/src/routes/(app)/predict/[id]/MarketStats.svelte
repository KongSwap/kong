<script lang="ts">
  import { TrendingUp, Clock, Users } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import MarketStatCard from "./MarketStatCard.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";

  export let totalPool: number;
  export let betCounts: any[];
  export let timeLeft: string;
  export let isMarketResolved: boolean;
  export let marketEndTime: string;

  function formatTimeLeft(endTime: string | undefined): string {
    if (!endTime) return "Unknown";
    const end = Number(endTime) / 1_000_000; // Convert from nanoseconds to milliseconds
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }
</script>

<Panel
  variant="transparent"
  className="bg-kong-bg-dark/80 backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
>
  <h2 class="text-sm sm:text-sm uppercase font-medium mb-2">
    Market Statistics
  </h2>
  <div
    class="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 lg:gap-6"
  >
    <MarketStatCard
      icon={Clock}
      label="Time Left"
      value={isMarketResolved
        ? "Market Closed"
        : timeLeft || formatTimeLeft(marketEndTime)}
    />

    <MarketStatCard
      icon={Users}
      label="Total Predictions"
      value={`${betCounts.reduce((a, b) => a + b, 0).toLocaleString()} predictions`}
    />

    <div class="col-span-2 lg:col-span-1">
      <MarketStatCard
        icon={TrendingUp}
        label="Total Pool"
        value={`${formatBalance(totalPool, 8)} KONG`}
      />
    </div>
  </div>
</Panel> 