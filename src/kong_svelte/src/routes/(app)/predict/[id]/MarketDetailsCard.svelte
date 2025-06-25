<script lang="ts">
  import {
    TrendingUp,
    Clock,
    Users,
    Shield,
    User,
    Activity,
  } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import type { Market } from "$lib/types/predictionMarket";
  import { userTokens } from "$lib/stores/userTokens";
  import { formatTimeLeft } from "$lib/utils/timeFormatUtils";
  import { isAdmin } from "$lib/api/predictionMarket";
  import { goto } from "$app/navigation";
  import { truncateAddress } from "$lib/utils/principalUtils";
  import Icon from "@iconify/svelte";
  import {
    shareToTwitter,
    shareToFacebook,
    shareToReddit,
    shareToTikTok,
    shareToTelegram,
    copyLinkToClipboard,
  } from "$lib/utils/socialShareUtils";

  let {
    totalPool,
    betCounts,
    timeLeft,
    isMarketResolved,
    marketEndTime,
    market,
    isPendingResolution,
    isMarketVoided,
    loading = false,
  } = $props<{
    totalPool: number;
    betCounts: any[];
    timeLeft: string;
    isMarketResolved: boolean;
    marketEndTime: string;
    market: Market;
    isPendingResolution: boolean;
    isMarketVoided: boolean;
    loading?: boolean;
  }>();

  let isCreatorAdmin = $state(false);
  let checkingAdmin = $state(true);

  // Check if the market creator is an admin
  $effect(() => {
    if (market?.creator) {
      checkingAdmin = true;
      isAdmin(market.creator.toText())
        .then((result) => {
          isCreatorAdmin = result;
        })
        .catch((error) => {
          console.error("Error checking admin status:", error);
          isCreatorAdmin = false;
        })
        .finally(() => {
          checkingAdmin = false;
        });
    }
  });

  const token = $derived(
    $userTokens.tokens.find((t) => t.address === market.token_id),
  );

  const timeLeftValue = $derived(
    isMarketResolved
      ? "Market Closed"
      : timeLeft || formatTimeLeft(marketEndTime),
  );

  const totalPredictionsValue = $derived(
    `${betCounts.reduce((a, b) => a + b, 0).toLocaleString()} predictions`,
  );

  const totalPoolValue = $derived(
    `${formatBalance(totalPool, 8)} ${token?.symbol}`,
  );
  const totalPoolLogoUrl = $derived(token?.logo_url);

  const marketStats = $derived([
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
  ]);

  // Build market URL
  const marketUrl = $derived(() => {
    if (typeof window !== "undefined" && market) {
      return `${window.location.origin}/predict/${market.id}`;
    }
    return "";
  });

  // Social share handlers
  function handleShareToTwitter() {
    shareToTwitter(marketUrl(), market.question);
  }
  function handleShareToFacebook() {
    shareToFacebook(marketUrl());
  }
  function handleShareToReddit() {
    shareToReddit(marketUrl(), market.question);
  }
  function handleShareToTikTok() {
    shareToTikTok(marketUrl());
  }
  function handleShareToTelegram() {
    shareToTelegram(marketUrl(), market.question);
  }
</script>

<Panel
  variant="transparent"
  className="bg-kong-bg-primary/80 backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
>
  <h2 class="text-sm font-medium text-kong-text-secondary mb-4">
    Market Details
  </h2>

  {#if loading}
    <!-- Loading State -->
    <div class="space-y-2">
      {#each Array(5) as _, i}
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center gap-2">
            <div
              class="w-4 h-4 bg-kong-bg-secondary/30 rounded animate-pulse"
            ></div>
            <div
              class="h-4 w-20 bg-kong-bg-secondary/30 rounded animate-pulse"
            ></div>
          </div>
          <div
            class="h-4 w-24 bg-kong-bg-secondary/30 rounded animate-pulse"
          ></div>
        </div>
      {/each}

      <!-- Loading Creator Section -->
      <div class="pt-3 border-t border-kong-border/20">
        <div class="flex items-center justify-between">
          <div
            class="h-4 w-16 bg-kong-bg-secondary/30 rounded animate-pulse"
          ></div>
          <div
            class="h-4 w-32 bg-kong-bg-secondary/30 rounded animate-pulse"
          ></div>
        </div>
      </div>

      <!-- Loading Share Section -->
      <div class="flex items-center justify-between py-2">
        <div
          class="h-4 w-12 bg-kong-bg-secondary/30 rounded animate-pulse"
        ></div>
        <div class="flex items-center gap-1">
          {#each Array(6) as _}
            <div
              class="w-7 h-7 bg-kong-bg-secondary/30 rounded animate-pulse"
            ></div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- Actual Content -->
    <div class="space-y-2">
      <!-- Market Status -->
      <div class="flex items-center justify-between py-2">
        <div class="flex items-center gap-2 text-kong-text-secondary">
          <Activity class="w-4 h-4" />
          <span class="text-sm">Status</span>
        </div>
        <div class="flex items-center gap-2">
          {#if isMarketResolved}
            <span
              class="px-2 py-0.5 bg-kong-success/20 text-kong-success text-xs rounded-full font-medium"
            >
              Resolved
            </span>
          {:else if isMarketVoided}
            <span
              class="px-2 py-0.5 bg-kong-error/20 text-kong-error text-xs rounded-full font-medium"
            >
              Voided
            </span>
          {:else if isPendingResolution}
            <span
              class="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full font-medium"
            >
              Pending Resolution
            </span>
          {:else}
            <span
              class="px-2 py-0.5 bg-kong-accent-blue/20 text-kong-accent-blue text-xs rounded-full font-medium"
            >
              Active
            </span>
          {/if}
        </div>
      </div>

      {#each marketStats as stat}
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center gap-2 text-kong-text-secondary">
            {#if stat.icon}
              {@const Icon = stat.icon}
              <Icon class="w-4 h-4" />
            {:else if stat.logoUrl}
              <img src={stat.logoUrl} alt="" class="w-4 h-4 rounded-full" />
            {/if}
            <span class="text-sm">{stat.label}</span>
          </div>
          <span class="text-sm font-medium text-kong-text-primary">
            {stat.value}
          </span>
        </div>
      {/each}

      <!-- Creator Information -->
      <div class="flex items-center justify-between py-2">
        <div class="flex items-center gap-2 text-kong-text-secondary">
          <span class="text-sm">Creator</span>
        </div>
        <button
          class="text-sm font-medium text-kong-text-primary hover:text-kong-primary transition-colors"
          onclick={() => goto(`/wallets/${market.creator.toText()}`)}
        >
          {truncateAddress(market.creator.toText())}
        </button>
      </div>

      <!-- Social Share -->
      <div class="flex items-center justify-center py-2">
        <div class="flex items-center gap-1">
          <button
            onclick={handleShareToTwitter}
            class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary hover:text-kong-text-primary transition-colors"
            aria-label="Share on X"
          >
            <Icon icon="ri:twitter-x-fill" class="w-4 h-4" />
          </button>
          <button
            onclick={handleShareToTelegram}
            class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary hover:text-kong-text-primary transition-colors"
            aria-label="Share on Telegram"
          >
            <Icon icon="ri:telegram-fill" class="w-4 h-4" />
          </button>
          <button
            onclick={handleShareToTikTok}
            class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary hover:text-kong-text-primary transition-colors"
            aria-label="Share on TikTok"
          >
            <Icon icon="ri:tiktok-fill" class="w-4 h-4" />
          </button>
          <button
            onclick={handleShareToFacebook}
            class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary hover:text-kong-text-primary transition-colors"
            aria-label="Share on Facebook"
          >
            <Icon icon="ri:facebook-fill" class="w-4 h-4" />
          </button>
          <button
            onclick={handleShareToReddit}
            class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary hover:text-kong-text-primary transition-colors"
            aria-label="Share on Reddit"
          >
            <Icon icon="ri:reddit-fill" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  {/if}
</Panel>
