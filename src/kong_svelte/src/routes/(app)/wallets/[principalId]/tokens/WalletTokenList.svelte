<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import {
    formatBalance,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { flip } from "svelte/animate";
  import { walletDataStore } from "$lib/services/wallet";
  import { ArrowUp, ArrowDown, Coins } from "lucide-svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import { tooltip } from "$lib/actions/tooltip";

  let {
    tokens = [],
    showHeader = true,
    showOnlyWithBalance = true,
    isLoading = false,
  } = $props<{
    tokens: Kong.Token[];
    showHeader: boolean;
    showOnlyWithBalance: boolean;
    isLoading: boolean;
  }>();

  // Get wallet data from the store
  let walletData = $derived($walletDataStore);

  // Determine if we're still loading balances
  let isLoadingBalances = $derived(
    isLoading ||
      walletData.isLoading ||
      (tokens.length > 0 && Object.keys(walletData.balances).length === 0),
  );

  // Whale threshold - percentage of total supply that makes a holder a "whale"
  const WHALE_THRESHOLD = 1; // 1% of total supply

  // Calculate formatted values reactively based on wallet balances and filter out zero balances
  let formattedTokens = $derived(
    tokens
      .map((token) => {
        const balance = walletData.balances[token.address];
        const balanceAmount = balance?.in_tokens || BigInt(0);
        const totalSupply = token.metrics?.total_supply || "0";

        // Calculate percentage of total supply - convert bigint to string first
        const percentOfSupply =
          Number(totalSupply) > 0
            ? (Number(balanceAmount.toString()) / Number(totalSupply)) * 100
            : 0;

        // Determine if this is a whale position
        const isWhale = percentOfSupply >= WHALE_THRESHOLD;

        return {
          ...token,
          balanceAmount,
          formattedUsdValue: balance?.in_usd || "0",
          priceChange24h: token.metrics?.price_change_24h || "0",
          price: token.metrics?.price || "0",
          percentOfSupply,
          isWhale,
        };
      })
      .filter((token) => {
        // If showOnlyWithBalance is true, filter out tokens with zero balance
        // Otherwise, show all tokens
        return !showOnlyWithBalance || token.balanceAmount > BigInt(0);
      })
      .sort((a, b) => {
        // If we have balances, sort by USD value
        if (Object.keys(walletData.balances).length > 0) {
          return Number(b.formattedUsdValue) - Number(a.formattedUsdValue);
        }
        // Otherwise, sort alphabetically by symbol
        return a.symbol.localeCompare(b.symbol);
      }),
  );

  function formatPriceChange(change: string) {
    const num = Number(change);
    return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
  }

  function getPriceChangeColor(change: string) {
    const num = Number(change);
    if (num > 0) return "text-kong-success";
    if (num < 0) return "text-kong-error";
    return "text-kong-text-secondary";
  }

  // Format percentage of total supply
  function formatSupplyPercentage(percent: number): string {
    return percent.toFixed(2) + "%";
  }

  // Tooltip text for whale indicator
  const whaleTooltipText = `This wallet holds at least ${WHALE_THRESHOLD}% of the token's total supply, making it a significant holder ("whale").`;
</script>

<div>
  {#if showHeader}
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">
        Token Balances
      </h3>
      <div class="p-2 rounded-lg bg-kong-primary/10">
        <Coins class="w-3 h-3 text-kong-primary" />
      </div>
    </div>
  {/if}

  <!-- Grid Headers - Hidden on mobile, visible on tablet and above -->
  {#if !isLoadingBalances && formattedTokens.length > 0}
    <div
      class="hidden sm:grid sm:grid-cols-[2fr,1.5fr,1fr,1fr,1fr] gap-4 px-4 py-2 text-sm text-kong-text-secondary font-medium border-b border-kong-border"
    >
      <div>Token</div>
      <div class="text-right">Balance</div>
      <div class="text-right">Price</div>
      <div class="text-right">24h Change</div>
      <div class="text-right">Value</div>
    </div>
  {/if}

  <div class="max-h-[600px] overflow-y-auto">
    {#if isLoadingBalances}
      <div class="text-center py-8">
        <LoadingIndicator message="Loading token balances..." />
      </div>
    {:else if formattedTokens.length === 0}
      <div class="text-center py-8 text-kong-text-secondary">
        {#if showOnlyWithBalance}
          No tokens with balance found in this wallet
        {:else}
          No tokens found
        {/if}
      </div>
    {:else}
      <!-- Grid Body -->
      <div class="divide-y divide-kong-border">
        {#each formattedTokens as token (token.address)}
          <div
            animate:flip={{ duration: 300 }}
            class="sm:grid sm:grid-cols-[2fr,1.5fr,1fr,1fr,1fr] sm:gap-4 sm:items-center p-4 hover:bg-kong-bg-primary/30 transition-colors cursor-pointer"
          >
            <!-- Mobile View - Card-like layout -->
            <div class="flex flex-col gap-3 sm:hidden">
              <!-- Token and Value in a row -->
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <TokenImages tokens={[token]} size={28} />
                  <div class="flex flex-col">
                    <div class="flex items-center gap-1">
                      <span class="font-semibold text-kong-text-primary"
                        >{token.symbol}</span
                      >
                      {#if token.isWhale}
                        <Badge 
                          variant="blue" 
                          icon="🐋" 
                          size="xs" 
                          tooltip={whaleTooltipText}
                        >
                          {formatSupplyPercentage(token.percentOfSupply)}
                        </Badge>
                      {/if}
                    </div>
                    <span class="text-xs text-kong-text-secondary"
                      >{token.name}</span
                    >
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-medium text-kong-text-primary">
                    ${formatToNonZeroDecimal(token.formattedUsdValue)}
                  </div>
                </div>
              </div>

              <!-- Balance, Price and 24h Change in a row -->
              <div class="flex justify-between items-center text-sm">
                <div>
                  <span class="text-kong-text-secondary">Balance: </span>
                  <span class="font-medium">
                    {Number(token.balanceAmount) < 0.00001
                    ? "&lt;0.001"
                    : formatBalance(token.balanceAmount.toString(), token.decimals)}
                  </span>
                </div>
                <div>
                  <span class="text-kong-text-secondary">Price: </span>
                  <span class="font-medium"
                    >${formatToNonZeroDecimal(token.price)}</span
                  >
                </div>
                <div class={getPriceChangeColor(token.priceChange24h)}>
                  {formatPriceChange(token.priceChange24h)}
                  {#if Number(token.priceChange24h) > 0}
                    <ArrowUp class="inline h-3 w-3" />
                  {:else if Number(token.priceChange24h) < 0}
                    <ArrowDown class="inline h-3 w-3" />
                  {/if}
                </div>
              </div>
            </div>

            <!-- Desktop View - Grid layout -->
            <!-- Token -->
            <div class="hidden sm:flex items-center gap-3">
              <TokenImages tokens={[token]} size={32} />
              <div class="flex flex-col">
                <div class="flex items-center gap-1">
                  <span class="font-semibold text-kong-text-primary"
                    >{token.symbol}</span
                  >
                  {#if token.isWhale}
                    <Badge 
                      variant="blue" 
                      icon="🐋" 
                      size="xs" 
                      tooltip={whaleTooltipText}
                    >
                      {formatSupplyPercentage(token.percentOfSupply)}
                    </Badge>
                  {/if}
                </div>
                <span class="text-xs text-kong-text-secondary"
                  >{token.name}</span
                >
              </div>
            </div>

            <!-- Balance -->
            <div class="hidden sm:block text-right">
              <div class="font-medium text-kong-text-primary">
                {#if token.balanceAmount === BigInt(0) && Number(token.formattedUsdValue) > 0}
                  &lt;0.001 {token.symbol}
                {:else}
                  {
                  Number(formatBalance(token.balanceAmount.toString(), token.decimals)) < 0.00001
                  ? "<0.00001"
                  : formatBalance(token.balanceAmount.toString(), token.decimals)}
                  {token.symbol}
                {/if}
              </div>
            </div>

            <!-- Price -->
            <div class="hidden sm:block text-right">
              <div class="font-medium text-kong-text-primary">
                {Number(token.price) < 0.00001
                  ? "<$0.00001"
                  : "$" + formatToNonZeroDecimal(token.price)}
              </div>
            </div>

            <!-- 24h Change -->
            <div class="hidden sm:block text-right">
              <div class={getPriceChangeColor(token.priceChange24h)}>
                {formatPriceChange(token.priceChange24h)}
                {#if Number(token.priceChange24h) > 0}
                  <ArrowUp class="inline h-4 w-4" />
                {:else if Number(token.priceChange24h) < 0}
                  <ArrowDown class="inline h-4 w-4" />
                {/if}
              </div>
            </div>

            <!-- Value -->
            <div class="hidden sm:block text-right">
              <div class="font-medium text-kong-text-primary">
                {Number(token.formattedUsdValue) < 0.01
                  ? "<$0.01"
                  : "$" + formatToNonZeroDecimal(token.formattedUsdValue)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
