<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { writable, derived } from "svelte/store";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore, liveTokens } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import debounce from "lodash-es/debounce";
  import { ArrowUp, ArrowDown, Star, ArrowUpDown, Flame } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import {
    favoriteStore,
    currentWalletFavorites,
  } from "$lib/services/tokens/favoriteStore";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { browser } from "$app/environment";
  import { createFilteredTokens } from "$lib/utils/statsUtils";
  import StatsCards from "$lib/components/stats/StatsCards.svelte";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";
    import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import StatsTableRow from "$lib/components/stats/StatsTableRow.svelte";

  const isMobile = writable(false);

  onMount(() => {
    const checkMobile = () => {
      if (browser) {
        isMobile.set(window.innerWidth < 768);
      }
    };
    checkMobile();

    const loadFavorites = async () => {
      if ($auth.isConnected) {
        await tokenStore.loadFavorites();
      }
    };
    const loadPools = async () => {
      await poolStore.loadPools(true);
    };
    loadFavorites();
    loadPools();

    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  $: if (browser) {
    isMobile.set(window.innerWidth < 768);
  }

  // Store for toggling between all tokens and favorites only
  const showFavoritesOnly = writable(false);
  const activeStatsSection = writable<"tokens" | "marketStats">("tokens");
  const DEBOUNCE_DELAY = 300;
  const searchQuery = writable<string>("");
  const sortColumnStore = writable<string>("marketCap");
  const sortDirectionStore = writable<"asc" | "desc">("desc");
  const KONG_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";

  let tokensLoading: boolean;
  $: {
    tokensLoading = $liveTokens === undefined;
  }

  const tokensError = derived<
    [typeof tokenStore, typeof poolStore],
    string | null
  >([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
    return $tokenStore.error || $poolStore.error || null;
  });

  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, DEBOUNCE_DELAY);

  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    debouncedSearch(target.value);
  }

  const filteredTokens = createFilteredTokens(
    liveTokens,
    searchQuery,
    sortColumnStore,
    sortDirectionStore,
    showFavoritesOnly,
    currentWalletFavorites,
    $auth,
  );

  function toggleSort(column: string) {
    if ($sortColumnStore === column) {
      sortDirectionStore.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      sortColumnStore.set(column);
      sortDirectionStore.set("desc");
    }
  }

  function getSortIcon(column: string) {
    if ($sortColumnStore !== column) return ArrowUpDown;
    return $sortDirectionStore === "asc" ? ArrowUp : ArrowDown;
  }

  // Price change class functions
  function getPriceClass(token: FE.Token): string {
    const flashClass = $tokenStore.priceChangeClasses[token.canister_id] || "";
    return flashClass;
  }

  function getTrendClass(token: FE.Token): string {
    return token?.metrics?.price_change_24h
      ? Number(token.metrics.price_change_24h) > 0
        ? "positive"
        : Number(token.metrics.price_change_24h) < 0
          ? "negative"
          : ""
      : "";
  }

  // Single source of truth for virtualization
  const scrollY = writable(0);
  const virtualItems = derived(
    [filteredTokens, scrollY],
    ([$filteredTokens, $scrollY]) => {
      if (!$filteredTokens.tokens) return [];

      const itemHeight = 80;
      const containerHeight = browser ? window.innerHeight : 800;
      const bufferSize = 5;
      const start = Math.max(0, Math.floor($scrollY / itemHeight) - bufferSize);
      const visibleItems = Math.ceil(containerHeight / itemHeight) + bufferSize * 2;
      const end = Math.min(
        start + visibleItems,
        $filteredTokens.tokens.length
      );

      return $filteredTokens.tokens.slice(start, end).map((token, i) => ({
        token,
        index: start + i,
        y: (start + i) * itemHeight,
      }));
    },
  );

  // Handle scroll event
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (target) {
      scrollY.set(target.scrollTop);
    }
  }
</script>

<section class="flex flex-col w-full h-[100dvh] px-4">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if $isMobile}
      <div class="flex gap-4 sticky top-0 z-30">
        <button
          class="flex-1 px-4 py-2 rounded-lg transition-colors duration-200
                 {$activeStatsSection === 'tokens'
            ? 'bg-kong-primary text-white'
            : 'bg-[#2a2d3d] text-[#8890a4]'}"
          on:click={() => activeStatsSection.set("tokens")}
        >
          Tokens
        </button>
        <button
          class="flex-1 px-4 py-2 rounded-lg transition-colors duration-200
                 {$activeStatsSection === 'marketStats'
            ? 'bg-kong-primary text-white'
            : 'bg-[#2a2d3d] text-[#8890a4]'}"
          on:click={() => activeStatsSection.set("marketStats")}
        >
          Market Stats
        </button>
      </div>
    {/if}

    {#if !$isMobile || ($isMobile && $activeStatsSection === "marketStats")}
      <StatsCards
        volume24h={$poolStore.totals?.rolling_24h_volume || 0}
        totalLiquidity={$poolStore.totals?.tvl || 0}
        totalFees={$poolStore.totals?.fees_24h || 0}
        isMobile={$isMobile}
      />
    {/if}

    {#if $activeStatsSection === "tokens"}
      <Panel
        variant="green"
        type="main"
        className="content-panel flex-1 !p-0 mt-2"
        height="100%"
      >
        <div class="flex flex-col h-full">
          <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
            <div
              class="hidden sm:flex items-center gap-3 pb-1 border-b border-[#2a2d3d] pt-2"
            >
              <div class="flex bg-transparent">
                <button
                  class="px-4 py-2 transition-colors duration-200 {$showFavoritesOnly
                    ? 'text-[#8890a4] hover:text-white'
                    : 'text-white'}"
                  on:click={() => showFavoritesOnly.set(false)}
                >
                  All Tokens
                </button>
                <button
                  class="px-4 py-2 transition-colors duration-200 {$showFavoritesOnly
                    ? 'text-white'
                    : 'text-[#8890a4] hover:text-white'}"
                  on:click={() => showFavoritesOnly.update((v) => !v)}
                >
                  My Favorites
                  {#if $auth.isConnected}
                    <span
                      class="ml-1 px-2 py-0.5 text-white/80 bg-blue-400/60 rounded text-xs"
                    >
                      {$currentWalletFavorites.length}
                    </span>
                  {/if}
                </button>
              </div>

              <div class="flex-1 px-4 py-2">
                <input
                  type="text"
                  placeholder={$isMobile
                    ? "Search tokens..."
                    : "Search tokens by name, symbol, or canister ID"}
                  class="w-full bg-transparent text-white placeholder-[#8890a4] focus:outline-none"
                  on:input={handleSearch}
                  disabled={$showFavoritesOnly}
                />
              </div>
            </div>
          </div>

          {#if tokensLoading}
            <LoadingIndicator />
          {:else if $tokensError}
            <div class="error-message">
              <p>Error loading tokens: {$tokensError}</p>
              <ButtonV2 
                label="Retry"
                theme="primary"
                variant="solid"
                size="lg"
                isDisabled={$auth.isConnected}
                onClick={() => {
                  tokenStore.loadTokens();
                  poolStore.loadPools();
                }}
              />
            </div>
          {:else if $filteredTokens.showFavoritesPrompt}
            <div
              class="flex flex-col items-center justify-center h-64 text-center"
            >
              <p class="text-gray-400 mb-4">
                Connect your wallet to view your favorite tokens
              </p>
              <ButtonV2
                label="Connect Wallet"
                theme="primary"
                variant="solid"
                size="lg"
                isDisabled={false}
                onClick={() => {
                  sidebarStore.toggleExpand();
                }}
              />
            </div>
          {:else if $filteredTokens.noFavorites}
            <div
              class="flex flex-col items-center justify-center h-64 text-center"
            >
              <p class="text-gray-400 mb-4">
                You have no favorite tokens yet. Mark some tokens as favorites
                to view them here.
              </p>
            </div>
          {:else if $filteredTokens.loading}
            <LoadingIndicator />
          {:else if $filteredTokens.tokens.length === 0}
            <div
              class="flex flex-col items-center justify-center h-64 text-center"
            >
              <p class="text-gray-400">
                No tokens found matching your search criteria
              </p>
            </div>
          {:else}
            <div
              class="flex-1 custom-scrollbar {$isMobile
                ? 'h-[calc(99vh-11rem)]'
                : 'h-[calc(100vh-1rem)]'}"
            >
              {#if !$isMobile}
                <!-- Desktop table view -->
                <div class="flex flex-col h-full">
                  <!-- Header outside scroll area -->
                  <table class="w-full border-collapse min-w-[800px] md:min-w-0">
                    <thead class="bg-[#1E1F2A]">
                      <tr class="h-10 border-b border-[#2a2d3d]">
                        <th
                          class="text-center py-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap w-[50px] cursor-pointer"
                          on:click={() => toggleSort("marketCapRank")}
                        >
                          #
                          <svelte:component
                            this={getSortIcon("marketCapRank")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="text-left py-2 pl-2 text-no-wrap text-sm font-medium text-[#8890a4] w-[300px] cursor-pointer"
                          on:click={() => toggleSort("token_name")}
                        >
                          Token
                          <svelte:component
                            this={getSortIcon("token_name")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="text-right pr-10 py-2 text-no-wrap text-sm font-medium text-[#8890a4] cursor-pointer w-[180px]"
                          on:click={() => toggleSort("price")}
                        >
                          Price
                          <svelte:component
                            this={getSortIcon("price")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="text-right pr-8 py-2 text-no-wrap text-sm font-medium text-[#8890a4] cursor-pointer w-[80px]"
                          on:click={() => toggleSort("price_change_24h")}
                        >
                          24h
                          <svelte:component
                            this={getSortIcon("price_change_24h")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="text-right pr-8 py-2 text-no-wrap text-sm font-medium text-[#8890a4] cursor-pointer w-[100px]"
                          on:click={() => toggleSort("volume_24h")}
                        >
                          Vol
                          <svelte:component
                            this={getSortIcon("volume_24h")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="text-right pr-8 py-2 text-no-wrap text-sm font-medium text-[#8890a4] cursor-pointer w-[100px]"
                          on:click={() => toggleSort("marketCap")}
                        >
                          MCap
                          <svelte:component
                            this={getSortIcon("marketCap")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="text-right pr-4 py-2 text-no-wrap text-sm font-medium text-[#8890a4] cursor-pointer w-[120px]"
                          on:click={() => toggleSort("tvl")}
                        >
                          TVL
                          <svelte:component
                            this={getSortIcon("tvl")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                      </tr>
                    </thead>
                  </table>
                  
                  <!-- Scrollable body -->
                  <div class="overflow-auto flex-1">
                    <table class="w-full border-collapse min-w-[800px] md:min-w-0">
                      <tbody class="!px-4 ">
                        {#each $filteredTokens.tokens as token (token.canister_id)}
                          <StatsTableRow
                            {token}
                            isConnected={$auth.isConnected}
                            isFavorite={$currentWalletFavorites.includes(token.canister_id)}
                            priceClass={getPriceClass(token)}
                            trendClass={getTrendClass(token)}
                            kongCanisterId={KONG_CANISTER_ID}
                          />
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {:else}
                <!-- Mobile view with virtualization -->
                <div class="mobile-container">
                  {#if $isMobile}
                    <!-- Mobile sorting options -->
                    <div class="flex items-center gap-2 mb-2 bg-[#1a1b23] p-4 z-10 border-b border-[#2a2d3d]">
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'marketCap' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("marketCap")}
                      >
                        MCap
                        <svelte:component
                          this={getSortIcon("marketCap")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'volume_24h' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("volume_24h")}
                      >
                        Vol
                        <svelte:component
                          this={getSortIcon("volume_24h")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'tvl' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("tvl")}
                      >
                        TVL
                        <svelte:component
                          this={getSortIcon("tvl")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'price_change_24h' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("price_change_24h")}
                      >
                        24h
                        <svelte:component
                          this={getSortIcon("price_change_24h")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                    </div>
                  {/if}
                  <div 
                    class="mobile-scroll-container"
                    on:scroll={handleScroll}
                  >
                    <div
                      class="relative"
                      style="height: {$filteredTokens.tokens.length * 80}px"
                    >
                      {#each $virtualItems as { token, y } (token.canister_id)}
                        <div
                          class="absolute w-full"
                          style="transform: translateY({y}px)"
                          on:click={() => goto(`/stats/${token.canister_id}`)}
                        >
                          <div class="mx-4">
                            <TokenCardMobile
                              {token}
                              isConnected={$auth.isConnected}
                              isFavorite={$currentWalletFavorites.includes(token.canister_id)}
                              priceClass={getPriceClass(token)}
                              trendClass={getTrendClass(token)}
                            />
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </Panel>
    {/if}
  </div>
</section>

<style scoped lang="postcss">
  section {
    height: calc(100vh - 6rem);
  }

  .h-full {
    height: 100%;
  }

  .custom-scrollbar {
    height: 100%;
    overflow: auto;
  }

  .mobile-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .mobile-scroll-container {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
</style>
