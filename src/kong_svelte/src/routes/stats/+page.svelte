<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { t } from "$lib/services/translations";
  import Panel from "$lib/components/common/Panel.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { filterTokens, sortTableData } from "$lib/utils/statsUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { flip } from "svelte/animate";
  import debounce from "lodash-es/debounce";
  import { ArrowUpDown, TrendingUp, Droplets, DollarSign } from 'lucide-svelte';
  import { tokensTableHeaders } from "$lib/constants/statsConstants";

  // State management
  const searchQuery = writable("");
  const activeView = writable("tokens"); // tokens, pools
  const sortColumnStore = writable("formattedUsdValue");
  const sortDirectionStore = writable("desc");
  const copyStates = writable({});

  // Loading state
  const tokensLoading = derived(
    [tokenStore, poolStore, formattedTokens],
    ([$tokenStore, $poolStore, $formattedTokens]) => 
      $tokenStore.isLoading || 
      $poolStore.isLoading || 
      !$formattedTokens?.length
  );

  // Error state with null check
  const tokensError = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]) => $tokenStore.error || $poolStore.error
  );

  // Derived stores for filtered/sorted data
  const filteredSortedTokens = derived(
    [formattedTokens, searchQuery, sortColumnStore, sortDirectionStore],
    ([$formattedTokens, $searchQuery, $sortColumn, $sortDirection]) => {
      if (!$formattedTokens) return [];
      const filtered = filterTokens($formattedTokens, $searchQuery);
      return sortTableData(filtered, $sortColumn, $sortDirection);
    }
  );

  // Market stats
  const marketStats = derived([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
    const totalVolume = $poolStore.pools.reduce((acc, pool) => {
      const volume = Number(pool.rolling_24h_volume || 0n) / 1e8;
      return acc + volume;
    }, 0);
    
    const totalLiquidity = $poolStore.pools.reduce((acc, pool) => {
      const tvl = Number(pool.tvl || 0n) / 1e8;
      return acc + tvl;
    }, 0);
    
    const totalFees = $poolStore.pools.reduce((acc, pool) => {
      const fees = Number(pool.rolling_24h_lp_fee || 0n) / 1e8;
      return acc + fees;
    }, 0);
    
    return {
      totalVolume: formatToNonZeroDecimal(totalVolume),
      totalLiquidity: formatToNonZeroDecimal(totalLiquidity),
      totalFees: formatToNonZeroDecimal(totalFees)
    };
  });

  // Function to copy text to clipboard
  function copyToClipboard(tokenId: string) {
    navigator.clipboard.writeText(tokenId).then(
      () => {
        updateCopyState(tokenId, "Copied!");
      },
      (err) => {
        updateCopyState(tokenId, "Copy Failed!");
      }
    );
  }

  // Update the copy state for a specific token
  function updateCopyState(tokenId: string, text: string) {
    copyStates.update(states => {
      return { ...states, [tokenId]: text };
    });
    setTimeout(() => {
      copyStates.update(states => {
        return { ...states, [tokenId]: "Copy" };
      });
    }, 1000);
  }

  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, 300);

  let sortedAndFilteredPools = derived(poolStore, ($poolStore) => {
    return [...$poolStore.pools].sort((a, b) => {
      const tvlA = Number(a.tvl || 0n);
      const tvlB = Number(b.tvl || 0n);
      return tvlB - tvlA; // Sort by TVL in descending order
    });
  });

  const poolsLoading = derived(poolStore, $store => $store.isLoading);
  const poolsError = derived(poolStore, $store => $store.error);
</script>

<Clouds />

<div class="stats-container">
  <Panel variant="green" type="main" className="market-stats-panel">
    <div class="market-stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <DollarSign class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Volume (24h)</h3>
          <p>${$marketStats.totalVolume}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <Droplets class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Liquidity</h3>
          <p>${$marketStats.totalLiquidity}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <DollarSign class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Fees (24h)</h3>
          <p>${$marketStats.totalFees}</p>
        </div>
      </div>
    </div>
  </Panel>

  <div class="panels-grid">
    <Panel variant="green" type="main" className="content-panel">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-white/80 font-medium">Tokens</h3>
        <div class="search-container">
          <input
            type="text"
            placeholder="Search tokens..."
            class="search-input"
            on:input={(e) => debouncedSearch(e.target.value)}
          />
        </div>
      </div>

      {#if $tokensLoading}
        <LoadingIndicator />
      {:else if $tokensError}
        <div class="error-message">
          {$tokensError}
        </div>
      {:else}
        <div class="table-container">
          <table class="data-table">
            <TableHeader {tokensTableHeaders} bind:sortColumn={$sortColumnStore} bind:sortDirection={$sortDirectionStore} />
            <tbody>
              {#each $filteredSortedTokens as token (token.canister_id)}
                <tr animate:flip={{ duration: 300 }}>
                  <td class="token-cell">
                    <TokenImages tokens={[token]} containerClass="token-image" />
                    <div class="token-info">
                      <span class="token-name">{token.name}</span>
                      <span class="token-symbol">{token.symbol}</span>
                    </div>
                    <button 
                      class="copy-button" 
                      on:click={() => copyToClipboard(token.canister_id)}
                    >
                      {$copyStates[token.canister_id] || "Copy"}
                    </button>
                  </td>
                  <td class="price-cell">
                    ${formatToNonZeroDecimal(token.price)}
                  </td>
                  <td class="volume-cell">
                    ${formatToNonZeroDecimal(token.volume24h)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Panel>
  </div>
</div>

<style lang="postcss">
  .stats-container {
    @apply flex flex-col gap-6 p-4 relative z-10;
  }

  .market-stats-grid {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
  }

  .stat-card {
    @apply flex items-center gap-4 p-4 rounded-lg bg-white/5;
  }

  .stat-icon-wrapper {
    @apply p-3 rounded-lg bg-white/10;
  }

  .stat-icon {
    @apply w-6 h-6 text-white;
  }

  .stat-content {
    @apply flex flex-col;
  }

  .stat-content h3 {
    @apply text-sm text-white/60;
  }

  .stat-content p {
    @apply text-xl font-medium text-white;
  }

  .panels-grid {
    @apply grid gap-6;
  }

  .content-panel {
    @apply p-6;
  }

  .search-container {
    @apply relative;
  }

  .search-input {
    @apply w-64 px-4 py-2 rounded-lg bg-white/5 text-white placeholder-white/40
           border border-white/10 focus:border-white/20 focus:outline-none;
  }

  .table-container {
    @apply overflow-x-auto;
  }

  .data-table {
    @apply w-full;
  }

  .token-cell {
    @apply flex items-center gap-3;
  }

  .token-image {
    @apply w-8 h-8;
  }

  .token-info {
    @apply flex flex-col;
  }

  .token-name {
    @apply text-white font-medium;
  }

  .token-symbol {
    @apply text-sm text-white/60;
  }

  .copy-button {
    @apply ml-auto px-2 py-1 text-xs rounded bg-white/5 text-white/60
           hover:bg-white/10 hover:text-white transition-all duration-200;
  }

  .price-cell, .volume-cell {
    @apply text-right text-white font-medium;
  }

  .error-message {
    @apply text-red-400 text-center p-4;
  }
</style>
