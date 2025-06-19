<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Copy, ChevronDown, PlusCircle } from "lucide-svelte";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { onMount } from "svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import Dropdown from "$lib/components/common/Dropdown.svelte";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  let { fromToken = null, toToken = null, activeToken = $bindable() } = $props<{ 
    fromToken: Kong.Token | null;
    toToken: Kong.Token | null;
    activeToken?: Kong.Token | null;
  }>();

  // State for both tokens
  let liveFromToken = $state<Kong.Token | null>(null);
  let liveToToken = $state<Kong.Token | null>(null);
  let previousFromPrice = $state<number | null>(null);
  let previousToPrice = $state<number | null>(null);
  let fromPriceFlash = $state<"up" | "down" | null>(null);
  let toPriceFlash = $state<"up" | "down" | null>(null);
  let fromPriceFlashTimeout: NodeJS.Timeout;
  let toPriceFlashTimeout: NodeJS.Timeout;
  let activeTab = $state<"from" | "to">("to");
  let isAddressDropdownOpen = $state(false);

  // Tweened values for both tokens
  const fromMarketCapMotion = tweened(0, { duration: 500, easing: cubicOut });
  const fromVolume24hMotion = tweened(0, { duration: 500, easing: cubicOut });
  const fromTotalSupplyMotion = tweened(0, { duration: 500, easing: cubicOut });
  const fromCirculatingSupplyMotion = tweened(0, { duration: 500, easing: cubicOut });
  
  const toMarketCapMotion = tweened(0, { duration: 500, easing: cubicOut });
  const toVolume24hMotion = tweened(0, { duration: 500, easing: cubicOut });
  const toTotalSupplyMotion = tweened(0, { duration: 500, easing: cubicOut });
  const toCirculatingSupplyMotion = tweened(0, { duration: 500, easing: cubicOut });

  // Derived values
  const activeFromToken = $derived(liveFromToken || fromToken);
  const activeToToken = $derived(liveToToken || toToken);
  
  // Update bindable activeToken
  $effect(() => {
    activeToken = activeTab === "from" ? activeFromToken : activeToToken;
  });
  
  // Motion values for current tab
  const marketCap = $derived(activeTab === "from" ? $fromMarketCapMotion : $toMarketCapMotion);
  const volume24h = $derived(activeTab === "from" ? $fromVolume24hMotion : $toVolume24hMotion);
  const totalSupply = $derived(activeTab === "from" ? $fromTotalSupplyMotion : $toTotalSupplyMotion);
  const circulatingSupply = $derived(activeTab === "from" ? $fromCirculatingSupplyMotion : $toCirculatingSupplyMotion);

  // Update token data for both tokens
  async function updateTokenData() {
    const promises = [];
    
    if (fromToken?.address) {
      promises.push(
        fetchTokensByCanisterId([fromToken.address])
          .then(result => {
            if (result && result[0]) {
              liveFromToken = result[0];
            }
          })
          .catch(error => console.error("Error fetching from token:", error))
      );
    }
    
    if (toToken?.address) {
      promises.push(
        fetchTokensByCanisterId([toToken.address])
          .then(result => {
            if (result && result[0]) {
              liveToToken = result[0];
            }
          })
          .catch(error => console.error("Error fetching to token:", error))
      );
    }
    
    await Promise.all(promises);
  }

  // Track price changes for both tokens
  $effect(() => {
    const currentFromPrice = Number(activeFromToken?.metrics?.price || 0);
    if (previousFromPrice !== null && currentFromPrice !== previousFromPrice) {
      if (fromPriceFlashTimeout) clearTimeout(fromPriceFlashTimeout);
      fromPriceFlash = currentFromPrice > previousFromPrice ? "up" : "down";
      fromPriceFlashTimeout = setTimeout(() => (fromPriceFlash = null), 1000);
    }
    previousFromPrice = currentFromPrice;

    const currentToPrice = Number(activeToToken?.metrics?.price || 0);
    if (previousToPrice !== null && currentToPrice !== previousToPrice) {
      if (toPriceFlashTimeout) clearTimeout(toPriceFlashTimeout);
      toPriceFlash = currentToPrice > previousToPrice ? "up" : "down";
      toPriceFlashTimeout = setTimeout(() => (toPriceFlash = null), 1000);
    }
    previousToPrice = currentToPrice;
  });

  // Update motion values for both tokens
  $effect(() => {
    if (activeFromToken?.metrics) {
      fromMarketCapMotion.set(Number(activeFromToken.metrics.market_cap || 0));
      fromVolume24hMotion.set(Number(activeFromToken.metrics.volume_24h || 0));
      fromTotalSupplyMotion.set(
        Number(activeFromToken.metrics.total_supply || 0) / 10 ** activeFromToken.decimals
      );
      fromCirculatingSupplyMotion.set(
        Number(activeFromToken.metrics.total_supply || 0) / 10 ** activeFromToken.decimals
      );
    }
    
    if (activeToToken?.metrics) {
      toMarketCapMotion.set(Number(activeToToken.metrics.market_cap || 0));
      toVolume24hMotion.set(Number(activeToToken.metrics.volume_24h || 0));
      toTotalSupplyMotion.set(
        Number(activeToToken.metrics.total_supply || 0) / 10 ** activeToToken.decimals
      );
      toCirculatingSupplyMotion.set(
        Number(activeToToken.metrics.total_supply || 0) / 10 ** activeToToken.decimals
      );
    }
  });

  // Poll for updates
  onMount(() => {
    updateTokenData();
    const interval = setInterval(updateTokenData, 10000);
    
    return () => {
      clearInterval(interval);
      if (fromPriceFlashTimeout) clearTimeout(fromPriceFlashTimeout);
      if (toPriceFlashTimeout) clearTimeout(toPriceFlashTimeout);
    };
  });

  // Derived formatted values
  const formattedPrice = $derived(
    formatToNonZeroDecimal(activeToken?.metrics?.price)
  );
  const formattedPriceChange24h = $derived(
    Number(activeToken?.metrics?.price_change_24h) || 0
  );
  const formattedTvl = $derived(
    formatUsdValue(Number(activeToken?.metrics?.tvl || 0))
  );
  const priceFlash = $derived(activeTab === "from" ? fromPriceFlash : toPriceFlash);
</script>

<div class="relative text-kong-text-primary flex flex-col min-h-0 p-4 border border-kong-border/50 rounded-lg bg-kong-bg-secondary">
  {#if activeFromToken || activeToToken}
    <!-- Token Tabs -->
    <div class="flex gap-1 mb-3 bg-kong-bg-primary/50 p-1 rounded-lg">
      <button
        class="flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2"
        class:bg-kong-primary={activeTab === "from"}
        class:text-kong-text-primary={activeTab === "from"}
        class:text-kong-text-secondary={activeTab !== "from"}
        onclick={() => activeTab = "from"}
        disabled={!activeFromToken}
      >
        {#if activeFromToken}
          <TokenImages tokens={[activeFromToken]} size={16} />
        {/if}
        <span>{activeFromToken?.symbol || "From"}</span>
      </button>
      <button
        class="flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2"
        class:bg-kong-primary={activeTab === "to"}
        class:text-kong-text-primary={activeTab === "to"}
        class:text-kong-text-secondary={activeTab !== "to"}
        onclick={() => activeTab = "to"}
        disabled={!activeToToken}
      >
        {#if activeToToken}
          <TokenImages tokens={[activeToToken]} size={16} />
        {/if}
        <span>{activeToToken?.symbol || "To"}</span>
      </button>
    </div>

    {#if activeToken}
    <div class="flex flex-col gap-3">
      <!-- Token Header Section -->
      <div class="flex items-center gap-3 min-w-0">
        <!-- Token Name and Badges -->
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex flex-col items-start gap-1 min-w-0">
            <h1 class="text-base font-bold text-kong-text-primary leading-tight min-w-0 w-full flex gap-x-1 items-center">
              <span class="truncate min-w-0 flex-1">
                {activeToken.name || "Loading..."}
              </span>
              <span class="text-sm text-kong-text-secondary font-medium flex-shrink-0 whitespace-nowrap">
                ({activeToken.symbol || "..."})
              </span>
            </h1>
            <!-- <div class="flex flex-wrap gap-1 items-center">
              {#each activeToken.standards as standard}
                <Badge
                  variant={standard.includes("ICRC") ? "icrc" : "solana"}
                  size="xs"
                >
                  {standard}
                </Badge>
              {/each}
            </div> -->
          </div>
        </div>
      </div>

      <!-- Price Section -->
      <div class="flex flex-col gap-y-3">
        <div class="grid grid-cols-2 gap-2">
          <!-- Price and 24h Change -->
          <div class="flex flex-col justify-center">
            <div class="text-xs text-kong-text-primary/50 uppercase gap-x-1 flex tracking-wider whitespace-nowrap mb-0.5">
              Price
              {#if formattedPriceChange24h}
                <span
                  class={`text-xs font-bold ${formattedPriceChange24h > 0 ? "text-kong-success" : "text-kong-error"}`}
                >
                  {formattedPriceChange24h > 0 ? "+" : ""}{formattedPriceChange24h.toFixed(2)}%
                </span>
              {/if}
            </div>
            <div
              class="text-xl font-medium text-kong-text-primary leading-none"
              class:flash-green-text={priceFlash === "up"}
              class:flash-red-text={priceFlash === "down"}
            >
              ${formattedPrice}
            </div>
          </div>

          <!-- 24h Volume -->
          <div class="flex flex-col justify-center">
            <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5">
              24h Volume
            </div>
            <div class="text-xl font-medium text-kong-text-primary leading-none">
              {formatUsdValue(volume24h)}
            </div>
          </div>
        </div>
      </div>

      <!-- Token Address -->
      <div class="w-full">
        <div class="text-xs uppercase text-kong-text-secondary tracking-wider mb-1">
          Canister ID
        </div>
        <div class="relative w-full">
          <Dropdown
            bind:open={isAddressDropdownOpen}
            position="bottom-right"
            width="w-full"
            triggerClass="w-full p-0"
          >
            <svelte:fragment slot="trigger">
              <ButtonV2
                variant="outline"
                size="sm"
                className="!border-kong-border w-full bg-kong-bg-primary/70 hover:bg-kong-bg-secondary/30 hover:border-kong-primary/50 {$panelRoundness} transition-all duration-200 !py-2.5"
              >
                <div class="flex items-center gap-2 justify-between w-full">
                  <span class="text-xs font-mono truncate">{activeToken.address}</span>
                  <ChevronDown
                    class={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isAddressDropdownOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </ButtonV2>
            </svelte:fragment>

            <svelte:fragment let:getItemClass>
              <button
                class={getItemClass()}
                onclick={() => {
                  copyToClipboard(activeToken.address);
                  isAddressDropdownOpen = false;
                }}
                role="menuitem"
              >
                <Copy class="w-4 h-4 group-hover:text-kong-primary" />
                <span class="group-hover:text-kong-primary">Copy Address</span>
              </button>
              <div class="h-px w-full bg-white/5"></div>
              <button
                class={getItemClass()}
                onclick={() => {
                  window.open(
                    `https://nns.ic0.app/tokens/?import-ledger-id=${activeToken.address}`,
                    "_blank"
                  );
                  isAddressDropdownOpen = false;
                }}
                role="menuitem"
              >
                <PlusCircle class="w-4 h-4 group-hover:text-kong-primary" />
                <span class="group-hover:text-kong-primary">Import to NNS</span>
              </button>
            </svelte:fragment>
          </Dropdown>
        </div>
      </div>

      <!-- Market Stats -->
      <div class="flex flex-col gap-y-2.5">
        <!-- Row 1: Market Cap & TVL -->
        <div class="grid grid-cols-2 gap-x-4">
          <div class="flex flex-col">
            <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5">
              Market Cap
            </div>
            <div class="text-sm font-medium text-kong-text-primary">
              {formatUsdValue(marketCap)}
            </div>
          </div>

          <div class="flex flex-col">
            <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5">
              TVL
            </div>
            <div class="text-sm font-medium text-kong-text-primary">
              {formattedTvl}
            </div>
          </div>
        </div>

        <!-- Row 2: Total Supply & Circulating Supply -->
        <div class="grid grid-cols-2 gap-x-4">
          <div class="flex flex-col">
            <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5">
              Total Supply
            </div>
            <div class="text-sm font-medium text-kong-text-primary">
              {formatUsdValue(totalSupply)}
              {activeToken.symbol || ""}
            </div>
          </div>

          <div class="flex flex-col">
            <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5">
              Circulating Supply
            </div>
            <div class="text-sm font-medium text-kong-text-primary">
              {formatUsdValue(circulatingSupply)}
              {activeToken.symbol || ""}
            </div>
          </div>
        </div>
      </div>
    </div>
    {/if}
  {:else}
    <div class="flex flex-col items-center justify-center py-8 text-kong-text-secondary">
      <p class="text-sm font-medium">Select tokens to view detailed information</p>
    </div>
  {/if}
  </div>

<style scoped>
  .flash-green-text {
    animation: flashGreen 1s ease-out;
  }

  .flash-red-text {
    animation: flashRed 1s ease-out;
  }

  @keyframes flashGreen {
    0% {
      color: rgb(34, 197, 94);
    }
    100% {
      color: inherit;
    }
  }

  @keyframes flashRed {
    0% {
      color: rgb(239, 68, 68);
    }
    100% {
      color: inherit;
    }
  }

  /* Ensure truncation works properly */
  .truncate {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Font styling for crypto addresses */
  .font-mono {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
  }
</style>