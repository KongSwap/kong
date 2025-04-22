<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    InfoIcon,
    Droplets,
    ArrowLeftRight,
    Copy,
    PlusCircle,
    ChevronDown,
  } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { goto } from "$app/navigation";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  // Props using $props() for Svelte 5 runes mode
  const {
    token,
    marketCapRank = null,
    selectedPool = null,
    totalTokenTvl = 0,
  } = $props<{
    token: Kong.Token;
    marketCapRank: number | null;
    selectedPool?: BE.Pool | null;
    totalTokenTvl?: number;
  }>();

  // State variables
  let previousPrice: number | null = $state(null);
  let priceFlash: "up" | "down" | null = $state(null);
  let priceFlashTimeout: NodeJS.Timeout;
  let showDropdown = $state(false);
  let dropdownButtonRef = $state<HTMLButtonElement | null>(null);
  let dropdownRef = $state<HTMLElement | null>(null);

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

  // Toggle dropdown
  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  // Handle click outside dropdown
  function handleClickOutside(event: MouseEvent) {
    if (!showDropdown) return;
    const target = event.target as Node;
    if (
      !(dropdownButtonRef?.contains(target) || dropdownRef?.contains(target))
    ) {
      showDropdown = false;
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

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("touchend", handleClickOutside);

    return () => {
      clearInterval(pollInterval);
      if (priceFlashTimeout) {
        clearTimeout(priceFlashTimeout);
      }
      marketCapMotion.set(0);
      volume24hMotion.set(0);
      totalSupplyMotion.set(0);
      circulatingSupplyMotion.set(0);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchend", handleClickOutside);
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
</script>

<Panel variant="solid" type="main">
  <div class="flex flex-col gap-4">
    <!-- Token Header Section -->
    <div class="flex items-center gap-4">
      <!-- Token Logo -->
      <div class="flex-shrink-0">
        <TokenImages
          tokens={token ? [token] : []}
          size={82}
          containerClass="w-[82px] h-[82px] !p-0"
        />
      </div>

      <!-- Token Name and Rank -->
      <div class="flex flex-col">
        <div class="flex flex-col items-start gap-1.5">
          <h1
            class="text-lg md:text-xl flex gap-x-1 items-center font-bold text-kong-text-primary leading-tight"
          >
            {token?.name || "Loading..."}
            <div class="text-base text-kong-text-secondary font-medium">
              ({token?.symbol || "..."})
            </div>
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
                class={`text-xs font-bold ${formattedPriceChange24h > 0 ? "text-kong-accent-green" : "text-kong-accent-red"}`}
              >
                {formattedPriceChange24h > 0
                  ? "+"
                  : ""}{formattedPriceChange24h.toFixed(2)}%
              </span>
            {/if}
          </div>

          <div
            class="text-3xl font-medium text-kong-text-primary leading-none flex gap-x-1.5"
            class:flash-green-text={priceFlash === "up"}
            class:flash-red-text={priceFlash === "down"}
          >
            ${formattedPrice}
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
            on:click={() =>
              goto(
                `/pools/add?token0=${selectedPool.address_0}&token1=${selectedPool.address_1}`,
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
            on:click={() =>
              goto(
                `/swap?from=${selectedPool.address_1}&to=${selectedPool.address_0}`,
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
        <ButtonV2
          bind:element={dropdownButtonRef}
          variant="outline"
          size="sm"
          className="!border-kong-border w-full bg-kong-bg-dark/70 hover:bg-kong-bg-secondary/30 hover:border-kong-primary/50 {$panelRoundness} transition-all duration-200 !py-3"
          on:click={toggleDropdown}
        >
          <div class="flex items-center gap-2 justify-between w-full">
            <span class="text-sm font-mono truncate">{token?.address}</span>
            <ChevronDown class="w-4 h-4 flex-shrink-0" />
          </div>
        </ButtonV2>

        <!-- Dropdown menu -->
        {#if showDropdown}
          <div
            bind:this={dropdownRef}
            class="absolute right-0 top-full mt-1.5 w-full bg-kong-bg-dark rounded-lg shadow-xl z-[999] border border-white/10 overflow-hidden"
          >
            <button
              class="w-full px-4 py-3 text-left hover:bg-kong-bg-secondary/20 flex items-center gap-2 transition-colors"
              on:click={() => {
                copyToClipboard(token?.address);
                toastStore.info("Token address copied to clipboard");
                showDropdown = false;
              }}
            >
              <Copy class="w-4 h-4" />
              <span>Copy Address</span>
            </button>
            <div class="h-px w-full bg-white/5"></div>
            <button
              class="w-full px-4 py-3 text-left hover:bg-kong-bg-secondary/20 flex items-center gap-2 transition-colors"
              on:click={() => {
                window.open(
                  `https://nns.ic0.app/tokens/?import-ledger-id=${token?.address}`,
                  "_blank",
                );
                showDropdown = false;
              }}
            >
              <PlusCircle class="w-4 h-4" />
              <span>Import to NNS</span>
            </button>
          </div>
        {/if}
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
        <!-- Selected Pool TVL -->
        {#if selectedPool}
          <div class="flex flex-col">
            <div
              class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-0.5"
            >
              Current Pool TVL
            </div>
            <div class="text-sm font-medium text-kong-text-primary">
              {formattedSelectedPoolTvl}
            </div>
          </div>
        {:else}
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
        {/if}

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

      <!-- Row 3: If Pool Selected, show Total Supply here -->
      {#if selectedPool}
        <div class="grid grid-cols-2 gap-x-6">
          <!-- Total Supply -->
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
          <!-- Placeholder -->
          <div></div>
        </div>
      {/if}
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
