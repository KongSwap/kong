<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatTokenName } from "$lib/utils/tokenFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    Droplets,
    ArrowLeftRight,
    Copy,
    PlusCircle,
    ChevronDown,
    BadgeCheck,
    BadgeX,
  } from "lucide-svelte";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { goto } from "$app/navigation";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import Dropdown from "$lib/components/common/Dropdown.svelte";

  // Props using $props() for Svelte 5 runes mode
  const {
    token,
    marketCapRank = "-",
    selectedPool = null,
    totalTokenTvl = 0,
  } = $props<{
    token: Kong.Token;
    marketCapRank: string;
    selectedPool?: BE.Pool | null;
    totalTokenTvl?: number;
  }>();

  // State variables
  let previousPrice: number | null = $state(null);
  let priceFlash: "up" | "down" | null = $state(null);
  let priceFlashTimeout: NodeJS.Timeout;
  let isAddressDropdownOpen = $state(false);

  // Live token data (replacing writable store)
  let liveToken: Kong.Token | null = $state(null);

  // Motion values (replacing tweened stores)
  let marketCapValue = $state(0);
  let volume24hValue = $state(0);
  let totalSupplyValue = $state(0);
  let circulatingSupplyValue = $state(0);

  // Create tweened motions
  const marketCapMotion = tweened(0, { duration: 500, easing: cubicOut });
  const volume24hMotion = tweened(0, { duration: 500, easing: cubicOut });
  const totalSupplyMotion = tweened(0, { duration: 500, easing: cubicOut });
  const circulatingSupplyMotion = tweened(0, {
    duration: 500,
    easing: cubicOut,
  });

  // Derived values from motions
  const marketCap = $derived($marketCapMotion);
  const volume24h = $derived($volume24hMotion);
  const totalSupplyTweened = $derived($totalSupplyMotion);
  const circulatingSupplyTweened = $derived($circulatingSupplyMotion);

  // Function to update token data
  async function updateTokenData() {
    try {
      const result = await fetchTokensByCanisterId([token.address]);
      if (result && result[0]) {
        // Update state variable
        liveToken = { ...result[0] };
      }
    } catch (error) {
      console.error("Error fetching token data:", error);
    }
  }

  // Initial fetch
  updateTokenData();

  // Derived active token (replacing reactive statement)
  const activeToken = $derived(liveToken || token);

  // Track price changes with effect
  $effect(() => {
    const currentPrice = Number(activeToken?.metrics?.price || 0);
    if (previousPrice !== null && currentPrice !== previousPrice) {
      if (priceFlashTimeout) {
        clearTimeout(priceFlashTimeout);
      }
      priceFlash = currentPrice > previousPrice ? "up" : "down";
      priceFlashTimeout = setTimeout(() => (priceFlash = null), 1000);
    }
    previousPrice = currentPrice;
  });

  // Update motion values with effect
  $effect(() => {
    if (activeToken?.metrics) {
      marketCapValue = Number(activeToken.metrics.market_cap || 0);
      volume24hValue = Number(activeToken.metrics.volume_24h || 0);
      totalSupplyValue =
        Number(activeToken.metrics.total_supply || 0) /
        10 ** activeToken.decimals;
      circulatingSupplyValue =
        Number(activeToken.metrics.total_supply || 0) /
        10 ** activeToken.decimals;

      // Update motion values
      marketCapMotion.set(marketCapValue);
      volume24hMotion.set(volume24hValue);
      totalSupplyMotion.set(totalSupplyValue);
      circulatingSupplyMotion.set(circulatingSupplyValue);
    }
  });

  // Setup document event listener
  $effect.root(() => {
    const pollInterval = setInterval(async () => {
      try {
        await updateTokenData();
      } catch (error) {
        console.error("Error polling token data:", error);
      }
    }, 1000 * 10); // 10 seconds

    return () => {
      clearInterval(pollInterval);
      if (priceFlashTimeout) {
        clearTimeout(priceFlashTimeout);
      }
      marketCapMotion.set(0);
      volume24hMotion.set(0);
      totalSupplyMotion.set(0);
      circulatingSupplyMotion.set(0);
    };
  });

  // Derived formatted values
  const formattedPrice = $derived(
    formatToNonZeroDecimal(activeToken?.metrics?.price),
  );
  const formattedPriceChange24h = $derived(
    Number(activeToken?.metrics?.price_change_24h) || 0,
  );
  const formattedSelectedPoolTvl = $derived(
    selectedPool ? formatUsdValue(Number(selectedPool.tvl)) : "",
  );
  const formattedTotalTokenTvl = $derived(formatUsdValue(totalTokenTvl));

  let priceElement: HTMLElement;
  let priceFontSize = $state('text-3xl');

  function adjustFontSize(element: HTMLElement, text: string) {
    if (!element) return;
    
    const containerWidth = element.parentElement?.offsetWidth || 0;
    const textLength = text.length;
    
    if (textLength > 12) {
      priceFontSize = 'text-xl';
    } else if (textLength > 8) {
      priceFontSize = 'text-2xl';
    } else {
      priceFontSize = 'text-3xl';
    }
  }

  $effect(() => {
    if (priceElement && formattedPrice) {
      adjustFontSize(priceElement, formattedPrice);
    }
  });
</script>

<Panel variant="solid" className="!bg-kong-bg-secondary">
  <div class="flex flex-col gap-3">
    <!-- Token Header Section -->
    <div class="flex items-center gap-3 min-w-0">
      <!-- Token Logo -->
      <div class="flex-shrink-0">
        <TokenImages
          tokens={token ? [token] : []}
          size={76}
          containerClass="w-[76px] h-[76px] !p-0"
        />
      </div>

      <!-- Token Name and Rank -->
      <div class="flex flex-col min-w-0 flex-1">
        <div class="flex flex-col items-start gap-1.5 min-w-0">
          <h1
            class="text-lg md:text-xl flex gap-x-1 items-center font-bold text-kong-text-primary leading-tight min-w-0 w-full"
          >
            <span class="truncate min-w-0 flex-1">
              {token?.name ? formatTokenName(token.name, 25) : "Loading..."}
            </span>
            <span class="text-base text-kong-text-secondary font-medium flex-shrink-0 whitespace-nowrap">
              ({token?.symbol || "..."})
            </span>
          </h1>
          <div class="flex flex-wrap gap-1.5 items-center">
            {#each token.standards as standard}
              <Badge
                variant={standard.includes("ICRC") ? "icrc" : "solana"}
                size="xs"
              >
                {standard}
              </Badge>
            {/each}
            {#if token?.metrics?.is_verified}
              <Badge variant="green" size="xs"><BadgeCheck size="14" /> Verified</Badge>
            {:else}
              <Badge variant="yellow" size="xs"><BadgeX size="14" /> Unverified</Badge>
            {/if}
          </div>

          {#if marketCapRank !== null}
            <div
              class="text-xs px-2 py-0.5 bg-kong-bg-secondary/40 rounded-full text-kong-text-primary/80 flex-shrink-0 mt-1"
            >
              Rank #{marketCapRank}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Price Section -->
    <div class="flex flex-col gap-y-4">
      <div class="grid grid-cols-2 gap-2">
        <!-- Price and 24h Change -->
        <div class="flex flex-col justify-center">
          <div
            class="text-xs text-kong-text-primary/50 uppercase gap-x-1 flex tracking-wider whitespace-nowrap mb-1"
          >
            Price
            {#if formattedPriceChange24h}
              <span
                class={`text-xs font-bold ${formattedPriceChange24h > 0 ? "text-kong-success" : "text-kong-error"}`}
              >
                {formattedPriceChange24h > 0
                  ? "+"
                  : ""}{formattedPriceChange24h.toFixed(2)}%
              </span>
            {/if}
          </div>

          <div
            class="font-medium text-kong-text-primary leading-none flex flex-wrap gap-x-1.5 responsive-price overflow-hidden"
            class:flash-green-text={priceFlash === "up"}
            class:flash-red-text={priceFlash === "down"}
            class:text-3xl={priceFontSize === 'text-3xl'}
            class:text-2xl={priceFontSize === 'text-2xl'}
            class:text-xl={priceFontSize === 'text-xl'}
            bind:this={priceElement}
          >
            <span class="truncate">${formattedPrice}</span>
          </div>
        </div>

        <!-- 24h Volume -->
        <div class="flex flex-col justify-center">
          <div
            class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1"
          >
            24h Volume
          </div>
          <div
            class="text-3xl font-medium text-kong-text-primary leading-none flex gap-x-1"
          >
            {formatUsdValue(volume24h)}
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      {#if selectedPool}
        <div class="flex items-center gap-x-2 gap-y-2">
          <ButtonV2
            variant="outline"
            theme="accent-blue"
            size="sm"
            className="!w-1/2 text-nowrap flex justify-center items-center"
            onclick={() =>
              goto(
                `/pools/${selectedPool.address_0}_${selectedPool.address_1}/position`,
              )}
          >
            <div class="flex items-center gap-1.5">
              <Droplets class="w-4 h-4" /> Add Liquidity
            </div>
          </ButtonV2>
          <ButtonV2
            variant="outline"
            theme="accent-green"
            size="sm"
            className="!w-1/2 text-nowrap flex justify-center items-center"
            onclick={() =>
              goto(
                `/pro?from=${selectedPool.address_1}&to=${selectedPool.address_0}`,
              )}
          >
            <div class="flex items-center gap-1.5">
              <ArrowLeftRight class="w-4 h-4" /> Swap
            </div>
          </ButtonV2>
        </div>
      {/if}
    </div>

    <!-- Token Address - Full Width Row -->
    <div class="w-full">
      <div
        class="text-xs uppercase text-kong-text-secondary tracking-wider mb-1.5"
      >
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
              className="!border-kong-border w-full bg-kong-bg-primary/70 hover:bg-kong-bg-secondary/30 hover:border-kong-primary/50 {$panelRoundness} transition-all duration-200 !py-3"
            >
              <div class="flex items-center gap-2 justify-between w-full">
                <span class="text-sm font-mono truncate">{token?.address}</span>
                <ChevronDown
                  class={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isAddressDropdownOpen ? "rotate-180" : ""}`}
                />
              </div>
            </ButtonV2>
          </svelte:fragment>

          <svelte:fragment let:getItemClass>
            <button
              class={getItemClass()}
              onclick={() => {
                copyToClipboard(token?.address);
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
                  `https://nns.ic0.app/tokens/?import-ledger-id=${token?.address}`,
                  "_blank",
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
    <div class="flex flex-col gap-y-3">
      <!-- Row 1: Market Cap & Total Token TVL -->
      <div class="grid grid-cols-2 gap-x-6">
        <!-- Market Cap -->
        <div class="flex flex-col">
          <div
            class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5"
          >
            Market Cap
          </div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formatUsdValue(marketCap)}
          </div>
        </div>

        <!-- Total Token TVL (Moved) -->
        <div class="flex flex-col">
          <div
            class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5"
          >
            Total TVL
          </div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formattedTotalTokenTvl}
          </div>
        </div>
      </div>

      <!-- Row 2: Selected Pool TVL & Total Supply -->
      <div class="grid grid-cols-2 gap-x-6">
        <!-- If no pool selected, show Total Supply here instead -->
        <div class="flex flex-col">
          <div
            class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5"
          >
            Total Supply
          </div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formatUsdValue(totalSupplyTweened)}
            {activeToken?.symbol || ""}
          </div>
        </div>

        <!-- Circulating Supply -->
        <div class="flex flex-col">
          <div
            class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5"
          >
            Circulating Supply
          </div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formatUsdValue(circulatingSupplyTweened)}
            {activeToken?.symbol || ""}
          </div>
        </div>
      </div>
    </div>
  </div>
</Panel>

<style scoped>
  .flash-green-text {
    animation: flashGreen 1s ease-out;
  }

  .flash-red-text {
    animation: flashRed 1s ease-out;
  }

  .responsive-price {
    transition: font-size 0.2s ease;
    max-width: 100%;
  }

  /* Ensure price text doesn't overflow */
  .responsive-price span {
    max-width: 100%;
    display: inline-block;
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

  /* Ensure truncation works properly for addresses */
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

  /* Consistent text colors */
  .text-kong-text-secondary {
    color: rgba(136, 144, 164, 1);
  }
</style>
