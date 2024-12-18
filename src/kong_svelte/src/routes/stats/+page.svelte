<script lang="ts">
  import { writable, derived } from "svelte/store";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore, liveTokens } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import debounce from "lodash-es/debounce";
  import {
    Droplets,
    DollarSign,
    BarChart,
    ArrowUp,
    ArrowDown,
    Star,
    ArrowUpDown,
    Flame,
  } from "lucide-svelte";
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
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { createFilteredTokens, getPriceChangeClass } from '$lib/utils/statsUtils';
  import { get } from 'svelte/store';

  const isMobile = writable(false);

  onMount(() => {
    const checkMobile = () => {
      if (browser) {
        isMobile.set(window.innerWidth < 768);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
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
  const previousPrices = writable<Record<string, number>>({});
  const priceChangeClasses = writable<Record<string, string>>({});
  const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';

  onMount(async () => {
    if ($auth.isConnected) {
      await tokenStore.loadFavorites();
    }
  });

  let tokensLoading: boolean;
  $: {
    tokensLoading = $liveTokens === undefined;
  }

  const tokensError = derived<[typeof tokenStore, typeof poolStore], string | null>(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]) => {
      return $tokenStore.error || $poolStore.error || null;
    }
  );

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
    $auth
  );

  function toggleSort(column: string) {
    if ($sortColumnStore === column) {
      sortDirectionStore.update(d => d === "asc" ? "desc" : "asc");
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
    const store = get(tokenStore);
    const flashClass = store.priceChangeClasses[token.canister_id] || '';
    return flashClass;
  }

  function getTrendClass(token: FE.Token): string {
    return token?.metrics?.price_change_24h ? 
      (Number(token.metrics.price_change_24h) > 0 ? 'positive' : 
       Number(token.metrics.price_change_24h) < 0 ? 'negative' : '') : '';
  }

  // Add smooth price animations
  function createPriceStore(initialValue = 0) {
    return tweened(initialValue, {
      duration: 600,
      easing: cubicOut
    });
  }

  // Single source of truth for virtualization
  const scrollY = writable(0);
  const virtualItems = derived(
    [filteredTokens, scrollY],
    ([$filteredTokens, $scrollY]) => {
      if (!$filteredTokens.tokens) return [];
      
      const itemHeight = 80;
      const containerHeight = browser ? window.innerHeight : 800;
      const start = Math.floor($scrollY / itemHeight);
      const end = Math.min(
        start + Math.ceil(containerHeight / itemHeight) + 1, 
        $filteredTokens.tokens.length
      );
      
      return $filteredTokens.tokens.slice(start, end).map((token, i) => ({
        token,
        index: start + i,
        y: (start + i) * itemHeight
      }));
    }
  );

  // Handle scroll event
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (target) {
      scrollY.set(target.scrollTop);
    }
  }

  // Single reactive statement for price changes
  $: if ($tokenStore?.prices) {
    Object.entries($tokenStore.prices).forEach(([tokenId, price]) => {
      const currentPrice = Number(price);
      const previousPrice = $previousPrices[tokenId];

      // Check if we have a valid price change
      if (previousPrice !== undefined && 
          currentPrice !== previousPrice && 
          Math.abs(currentPrice - previousPrice) > 0.000001) {
        
        // Update price change classes
        priceChangeClasses.update(classes => ({
          ...classes,
          [tokenId]: currentPrice > previousPrice ? 'positive' : 'negative'
        }));

        // Clear the price change class after animation
        setTimeout(() => {
          priceChangeClasses.update(classes => {
            const newClasses = { ...classes };
            delete newClasses[tokenId];
            return newClasses;
          });
        }, 1000);
      }

      // Always update the previous price after checking for changes
      previousPrices.update(prices => ({
        ...prices,
        [tokenId]: currentPrice
      }));
    });
  }

  function getFullPrice(price: number | string | undefined): string {
    if (typeof price === 'undefined') return '0';
    return Number(price).toString();
  }

  // Create tweened stores for the totals
  const volume24h = tweened(0, {
    duration: 400,
    easing: cubicOut
  });
  const totalLiquidity = tweened(0, {
    duration: 400,
    easing: cubicOut
  });
  const totalFees = tweened(0, {
    duration: 400,
    easing: cubicOut
  });

  // Previous values to determine animation direction
  let prevVolume = 0;
  let prevLiquidity = 0;
  let prevFees = 0;

  // Animation classes
  let volumeClass = '';
  let liquidityClass = '';
  let feesClass = '';

  // Update function to set animation classes
  function updateWithAnimation(newValue: number, prevValue: number): string {
    if (prevValue === 0) return '';
    return newValue > prevValue ? 'animate-number-up' : 'animate-number-down';
  }

  // Watch for changes in pool store totals
  $: if ($poolStore.totals) {
    // Update volume with animation
    const newVolume = Number($poolStore.totals.rolling_24h_volume || 0);
    volume24h.set(newVolume);
    volumeClass = updateWithAnimation(newVolume, prevVolume);
    prevVolume = newVolume;

    // Update liquidity with animation
    const newLiquidity = Number($poolStore.totals.tvl || 0);
    totalLiquidity.set(newLiquidity);
    liquidityClass = updateWithAnimation(newLiquidity, prevLiquidity);
    prevLiquidity = newLiquidity;

    // Update fees with animation
    const newFees = Number($poolStore.totals?.fees_24h || 0);
    totalFees.set(newFees);
    feesClass = updateWithAnimation(newFees, prevFees);
    prevFees = newFees;
  }
</script>

<section class="flex flex-col w-full h-[100dvh] px-4">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if $isMobile}
      <div class="flex gap-4 sticky top-0 z-30">
        <button 
          class="flex-1 px-4 py-2 rounded-lg transition-colors duration-200 
                 {$activeStatsSection === 'tokens' ? 'bg-kong-primary text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
          on:click={() => activeStatsSection.set('tokens')}
        >
          Tokens
        </button>
        <button 
          class="flex-1 px-4 py-2 rounded-lg transition-colors duration-200
                 {$activeStatsSection === 'marketStats' ? 'bg-kong-primary text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
          on:click={() => activeStatsSection.set('marketStats')}
        >
          Market Stats
        </button>
      </div>
    {/if}

    {#if (!$isMobile) || ($isMobile && $activeStatsSection === 'marketStats')}
      <div class="earn-cards {$isMobile ? 'mobile-stats' : ''}">
        <div class="earn-card">
          <div class="card-content">
            <h3>Total Volume (24h)</h3>
            <div class="apy {volumeClass}">
              ${formatToNonZeroDecimal($volume24h)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <BarChart class="stat-icon" color="#60A5FA" />
          </div>
        </div>

        <div class="earn-card">
          <div class="card-content">
            <h3>Total Liquidity</h3>
            <div class="apy {liquidityClass}">
              ${formatToNonZeroDecimal($totalLiquidity)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <Droplets class="stat-icon" color="#60A5FA" />
          </div>
        </div>

        <div class="earn-card">
          <div class="card-content">
            <h3>Total Fees (24h)</h3>
            <div class="apy {feesClass}">
              ${formatToNonZeroDecimal($totalFees)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <DollarSign class="stat-icon" color="#60A5FA" />
          </div>
        </div>
      </div>
    {/if}

    {#if $activeStatsSection === 'tokens'}
      <Panel variant="green" type="main" className="content-panel flex-1 !p-0" height="100%">
        <div class="flex flex-col h-full">
          <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
            <div class="hidden sm:flex items-center gap-3 pb-1 border-b border-[#2a2d3d] pt-2">
              <div class="flex bg-transparent">
                <button
                  class="px-4 py-2 transition-colors duration-200 {($showFavoritesOnly ? 'text-[#8890a4] hover:text-white' : 'text-white')}"
                  on:click={() => showFavoritesOnly.set(false)}
                >
                  All Tokens
                </button>
                <button
                  class="px-4 py-2 transition-colors duration-200 {($showFavoritesOnly ? 'text-white' : 'text-[#8890a4] hover:text-white')}"
                  on:click={() => showFavoritesOnly.update(v => !v)}
                >
                  My Favorites
                  {#if $auth.isConnected}
                    <span class="ml-1 px-2 py-0.5 text-white/80 bg-blue-400/60 rounded text-xs">
                      {$currentWalletFavorites.length}
                    </span>
                  {/if}
                </button>
              </div>

              <div class="flex-1 px-4 py-2">
                <input
                  type="text"
                  placeholder={$isMobile ? "Search tokens..." : "Search tokens by name, symbol, or canister ID"}
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
              <button
                class="retry-button"
                on:click={() => {
                  tokenStore.loadTokens();
                  poolStore.loadPools();
                }}
              >
                Retry
              </button>
            </div>
          {:else}
            {#if $filteredTokens.showFavoritesPrompt}
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <p class="text-gray-400 mb-4">Connect your wallet to view your favorite tokens</p>
                <button
                  class="px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-primary-blue/90 transition-colors duration-200"
                  on:click={() => {
                    toastStore.info('Connect your wallet to view your favorite tokens', undefined, 'Connect Wallet');
                  }}
                >
                  Connect Wallet
                </button>
              </div>
            {:else if $filteredTokens.noFavorites}
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <p class="text-gray-400 mb-4">You have no favorite tokens yet. Mark some tokens as favorites to view them here.</p>
              </div>
            {:else if $filteredTokens.loading}
              <LoadingIndicator />
            {:else if $filteredTokens.tokens.length === 0}
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <p class="text-gray-400">No tokens found matching your search criteria</p>
              </div>
            {:else}
              <div class="flex-1 overflow-auto custom-scrollbar {$isMobile ? 'h-[calc(99vh-11rem)]' : 'h-[calc(100vh-1rem)]'}">
                {#if !$isMobile}
                  <!-- Desktop table view with fixed header -->
                  <div class="overflow-auto custom-scrollbar h-full">
                    <table class="w-full border-collapse min-w-[800px] md:min-w-0">
                      <thead class="sticky top-0 bg-[#1E1F2A] z-10">
                        <tr class="h-10 border-b border-[#2a2d3d] bg-[#1E1F2A]">
                          <th class="text-center py-2 px-2 text-sm font-medium text-[#8890a4] text-nowrap w-[80px] cursor-pointer" on:click={() => toggleSort("marketCapRank")}>
                            #
                            <svelte:component this={getSortIcon("marketCapRank")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-left py-2 text-sm font-medium text-[#8890a4] w-[280px]">Token</th>
                          <th class="text-right py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[140px]" on:click={() => toggleSort("price")}>
                            Price
                            <svelte:component this={getSortIcon("price")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[100px]" on:click={() => toggleSort("price_change_24h")}>
                            24h
                            <svelte:component this={getSortIcon("price_change_24h")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[140px]" on:click={() => toggleSort("volume_24h")}>
                            Vol
                            <svelte:component this={getSortIcon("volume_24h")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[150px]" on:click={() => toggleSort("marketCap")}>
                            MCap
                            <svelte:component this={getSortIcon("marketCap")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] w-[120px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="!px-4">
                        {#each $filteredTokens.tokens as token (token.canister_id)}
                          <tr
                            class:kong-special-row={token.canister_id === KONG_CANISTER_ID}
                            class="border-b border-white/5 hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                            on:click={() => goto(`/stats/${token.canister_id}`)}
                          >
                            <td class="text-center text-[#8890a4]">#{token.marketCapRank || '-'}</td>
                            <td class="">
                              <div class="flex items-center gap-2 h-full">
                                {#if $auth.isConnected}
                                  <button
                                    class="favorite-button {$currentWalletFavorites.includes(token.canister_id) ? 'active' : ''}"
                                    on:click={(e) => favoriteStore.toggleFavorite(token.canister_id)}
                                  >
                                    {#if $currentWalletFavorites.includes(token.canister_id)}
                                      <Star
                                        class="star-icon filled"
                                        size={16}
                                        color="yellow"
                                        fill="yellow"
                                      />
                                    {:else}
                                      <Star class="star-icon" size={16} />
                                    {/if}
                                  </button>
                                {/if}
                                <TokenImages
                                  tokens={[token]}
                                  containerClass="self-center"
                                  size={24}
                                />
                                <span class="token-name">{token.name}</span>
                                <span class="token-symbol">{token.symbol}</span>
                                {#if token.isHot}
                                  <div class="hot-badge-small" title="#{token.volumeRank} 24h volume">
                                    <Flame size={14} class="hot-icon" />
                                  </div>
                                {/if}
                              </div>
                            </td>
                            <td class="price-cell text-right">
                              <span class={$tokenStore.priceChangeClasses[token.canister_id] || ''}>
                                ${formatToNonZeroDecimal(token?.metrics?.price || 0)}
                              </span>
                            </td>
                            <td class="change-cell text-right {getTrendClass(token)}">
                              {#if token?.metrics?.price_change_24h === null || token?.metrics?.price_change_24h === "n/a"}
                                <span class="text-slate-400">0.00%</span>
                              {:else if Number(token?.metrics?.price_change_24h) === 0}
                                <span class="text-slate-400">0.00%</span>
                              {:else}
                                <span>
                                  {Number(token?.metrics?.price_change_24h) > 0 ? '+' : ''}{formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
                                </span>
                              {/if}
                            </td>
                            <td class="text-right px-4">
                              <span>{formatUsdValue(token?.metrics?.volume_24h)}</span>
                            </td>
                            <td class="text-right">
                              <span>{formatUsdValue(token?.metrics?.market_cap)}</span>
                            </td>
                            <td class="actions-cell">
                              <button
                                class="action-button"
                                on:click|stopPropagation={() => goto(`/stats/${token.canister_id}`)}
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {:else}
                  <!-- Mobile view with virtualization -->
                  <div 
                    class="h-[calc(100vh-10rem)] overflow-auto" 
                    on:scroll={handleScroll}
                  >
                    {#if $isMobile}
                      <!-- Mobile sorting options -->
                      <div class="flex items-center gap-2 mb-2 sticky top-0 bg-[#1a1b23] p-4 z-10 border-b border-[#2a2d3d]">
                        <button 
                          class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'marketCap' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                          on:click={() => toggleSort("marketCap")}
                        >
                          MCap
                          <svelte:component this={getSortIcon("marketCap")} class="inline w-3.5 h-3.5 ml-1" />
                        </button>
                        <button 
                          class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'volume_24h' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                          on:click={() => toggleSort("volume_24h")}
                        >
                          Vol
                          <svelte:component this={getSortIcon("volume_24h")} class="inline w-3.5 h-3.5 ml-1" />
                        </button>
                        <button 
                          class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'price_change_24h' ? 'bg-primary-blue text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                          on:click={() => toggleSort("price_change_24h")}
                        >
                          24h
                          <svelte:component this={getSortIcon("price_change_24h")} class="inline w-3.5 h-3.5 ml-1" />
                        </button>
                      </div>
                    {/if}
                    <div class="relative" style="height: {$filteredTokens.tokens.length * 80}px">
                      {#each $virtualItems as { token, y } (token.canister_id)}
                        <div
                          class="absolute w-full"
                          style="transform: translateY({y}px)"
                        >
                          <div class="token-card {token.canister_id === KONG_CANISTER_ID ? 'kong-special-card' : ''} mx-4">
                            <span class="token-rank">#{token.marketCapRank}</span>
                            <div class="token-card-main">
                              <div class="token-card-left">
                                {#if $auth.isConnected}
                                  <button
                                    class="favorite-button-mobile"
                                    on:click={(e) => favoriteStore.toggleFavorite(token.canister_id)}
                                  >
                                    {#if $currentWalletFavorites.includes(token.canister_id)}
                                      <Star class="star-icon filled" size={14} color="yellow" fill="yellow" />
                                    {:else}
                                      <Star class="star-icon" size={14} />
                                    {/if}
                                  </button>
                                {/if}
                                <TokenImages tokens={[token]} size={24} />
                                <div class="token-info-mobile">
                                  <div class="flex items-center gap-1">
                                    <span class="token-symbol-mobile">{token.symbol}</span>
                                    {#if token.isHot}
                                      <div class="hot-badge-small" title="#{token.volumeRank} 24h volume">
                                        <Flame size={14} class="hot-icon" />
                                      </div>
                                    {/if}
                                  </div>
                                  <div class="token-metrics-row">
                                    <span>MCap: {formatUsdValue(token?.metrics?.market_cap)}</span>
                                    <span class="separator">|</span>
                                    <span>Vol: {formatUsdValue(token?.metrics?.volume_24h)}</span>
                                  </div>
                                </div>
                              </div>
                              <div class="token-card-right">
                                <span 
                                  class="token-price ${getPriceClass(token)} ${$priceChangeClasses[token.canister_id] || ''} mobile-price"
                                  title="$${getFullPrice(token?.metrics?.price || 0)}"
                                >
                                  ${formatToNonZeroDecimal(token?.metrics?.price || 0)}
                                </span>
                                <span class="token-change {getTrendClass(token)}">
                                  {Number(token?.metrics?.price_change_24h) > 0 ? '+' : ''}
                                  {formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      </Panel>
    {/if}
  </div>
</section>

<style scoped lang="postcss">
  .earn-cards {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
  }

  .earn-card {
    @apply relative flex items-center justify-between p-6 rounded-xl transition-all duration-200
           bg-gradient-to-br from-[#1E1F2A] to-[#1E1F2A]/95 
           border border-[#2a2d3d]/50 text-left
           hover:bg-gradient-to-br hover:from-[#1E1F2A]/95 hover:to-[#1E1F2A]
           hover:border-primary-blue/30 
           hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]
           backdrop-blur-sm;
           max-height: 110px;

    /* Add hover effect for icon */
    &:hover .stat-icon-wrapper {
      @apply bg-gradient-to-br from-[#2a2d3d]/80 to-[#2a2d3d]/50;
    }

    &:hover .stat-icon {
      @apply text-primary-blue;
    }
  }

  .card-content {
    @apply flex flex-col gap-1.5;
    min-height: 4rem; /* Adjust based on your needs */
  }

  .card-content h3 {
    @apply text-[#8890a4] text-sm font-medium tracking-wide uppercase;
  }

  .apy {
    @apply text-white font-medium text-2xl;
    text-shadow: 0 2px 10px rgba(255,255,255,0.1);
  }

  .stat-icon-wrapper {
    @apply p-3.5 rounded-xl bg-gradient-to-br from-[#2a2d3d]/70 to-[#2a2d3d]/40
           ring-1 ring-white/5 transition-all duration-200;
  }

  .stat-icon {
    @apply w-5 h-5 text-white/70 transition-colors duration-200;
  }

  /* Mobile specific styles */
  .mobile-stats {
    @apply grid-cols-1 gap-3 px-4;
    
    .earn-card {
      @apply p-4 flex items-center;
      
      .card-content {
        @apply gap-1;
      }

      .card-content h3 {
        @apply text-xs;
      }
      
      .apy {
        @apply text-xl;
      }
      
      .stat-icon-wrapper {
        @apply p-2.5;
      }

      .stat-icon {
        @apply w-4 h-4;
      }
    }
  }

  .data-table {
    @apply w-full border-collapse min-w-[800px] md:min-w-0;
  }

  .data-table tbody tr {
    @apply border-b border-white/5 hover:bg-white/5
           transition-colors duration-200 cursor-pointer;
  }

  .data-table td {
    @apply px-3 md:px-4 py-2 text-sm text-white/80;
  }

  .token-cell {
    @apply flex items-center min-w-[180px];
  }

  .token-info {
    @apply flex items-center gap-2;
  }

  .token-name {
    @apply text-white font-medium truncate max-w-[120px] md:max-w-none;
  }

  .token-symbol {
    @apply text-xs md:text-sm text-white/60 hidden sm:inline;
  }

  .price-arrow.up {
    @apply text-kong-accent-green;
  }

  .price-arrow.down {
    @apply text-red-400;
  }

  .favorite-button {
    @apply flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/10 transition-none;
  }

  .favorite-button-mobile {
    @apply flex items-center justify-center w-6 h-6 rounded-lg 
           hover:bg-white/5 active:bg-white/10 transition-colors duration-150;
  }

  .change-cell.positive {
    @apply text-kong-accent-green;
  }

  .change-cell.negative {
    @apply text-red-400;
  }

  .retry-button {
    @apply px-4 py-2 bg-[#2a2d3d] text-white rounded-lg hover:bg-[#2a2d3d]/90 transition-colors duration-200;
  }

  .action-button {
    @apply px-4 py-1.5 text-sm rounded
           bg-white/5 text-white/60 hover:bg-white/10 hover:text-white
           focus:outline-none focus:ring-2 focus:ring-white/20
           min-w-[80px] float-right my-1 mr-2;
  }

  .token-card {
    @apply flex items-center justify-between p-3 rounded-lg relative;
    background: #1a1b23;
    border: 1px solid #2a2d3d;

    &.kong-special-card {
      background: rgba(0, 255, 128, 0.02);
      border-left: 2px solid #00ff8033;
      
      .token-symbol-mobile {
        font-weight: 500;
      }
    }
  }

  .token-rank {
    @apply absolute top-1 left-2 text-xs text-[#8890a4]/70;
  }

  .token-card-main {
    @apply flex items-center justify-between w-full mt-2;
  }

  .token-card-left {
    @apply flex items-center gap-2 flex-1 min-w-0;
  }

  .token-info-mobile {
    @apply flex flex-col justify-center min-w-0;
  }

  .token-symbol-mobile {
    @apply text-sm text-white font-medium;
  }

  .token-metrics-row {
    @apply flex items-center gap-2 text-[10px] text-[#8890a4] mt-0.5;
  }

  .separator {
    @apply text-[#8890a4]/50 mx-0.5;
  }

  .token-card-right {
    @apply flex flex-col items-end justify-center ml-2;
  }

  .token-price, .price-cell span {
    @apply text-white transition-colors duration-200 cursor-help;
  }

  .token-change {
    @apply text-xs font-medium mt-0.5;
  }

  .token-change.positive {
    @apply text-kong-accent-green;
  }

  .token-change.negative {
    @apply text-red-400;
  }

  .token-change.new {
    @apply text-purple-400;
  }

  .token-change.neutral {
    @apply text-[#8890a4];
  }

  .kong-special-row {
    background: rgba(0, 255, 128, 0.02);
    border-left: 2px solid #00ff8033;
    
    &:hover {
      background: rgba(0, 255, 128, 0.04);
    }

    td {
      font-weight: 500;
    }
  }

  .token-name, .token-symbol {
    @apply leading-none;
  }

  section {
    height: calc(100vh - 6rem);
  }

  .content-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .h-full {
    height: 100%;
  }

  /* Base price styles */
  .token-price, .price-cell span {
    @apply text-white transition-colors duration-200 cursor-help;
  }

  /* Price flash animations */
  .flash-green {
    animation: flash-green 1s ease-out forwards !important;
  }

  .flash-red {
    animation: flash-red 1s ease-out forwards !important;
  }

  @keyframes flash-green {
    0% { color: #fff; }
    30% { color: #00d3a5; }
    100% { color: #fff; }
  }

  @keyframes flash-red {
    0% { color: #fff; }
    30% { color: #FF4B4B; }
    100% { color: #fff; }
  }

  /* 24h trend colors */
  .positive {
    @apply text-kong-accent-green;
  }

  .negative {
    @apply text-kong-accent-red;
  }

  /* Ensure price cell transitions are smooth */
  .price-cell span {
    display: inline-block;
    transition: color 0.2s ease-out;
    will-change: color;
  }

  /* Custom Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1a1b23;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #60a5fa;
    border-radius: 4px;
    border: 2px solid #1a1b23;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #3b82f6;
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #60a5fa #1a1b23;
  }

  /* Table padding adjustments */
  .pools-table {
    th, td {
      padding: 0.5rem 0.5rem;
      
      &:first-child {
        padding-left: 1rem;
      }
      
      &:last-child {
        padding-right: 1rem;
      }
    }
  }
</style>
