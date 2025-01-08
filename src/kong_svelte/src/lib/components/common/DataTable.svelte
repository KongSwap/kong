<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { ArrowUp, ArrowDown, ArrowUpDown, Flame, TrendingUp, Wallet } from "lucide-svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { onMount, tick } from "svelte";

  export let data: any[] = [];
  export let columns: {
    key: string;
    title: string;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
    formatter?: (value: any) => string | number;
    component?: any;
    sortValue?: (row: any) => string | number;
  }[] = [];
  export let itemsPerPage = 100;
  export let defaultSort = { column: '', direction: 'desc' as 'asc' | 'desc' };
  export let onRowClick: ((row: any) => void) | null = null;
  export let rowKey = 'id';
  export let isKongRow: ((row: any) => boolean) | null = null;

  const currentPage = writable(1);
  const sortColumn = writable(defaultSort.column || '');
  const sortDirection = writable<'asc' | 'desc'>(defaultSort.direction || 'desc');
  const totalPages = writable(1);

  // Memoize top metrics sets to avoid recalculation on every render
  let memoizedTopByVolume: Set<string>;
  let memoizedTopByTVL: Set<string>;
  let memoizedTopByAPY: Set<string>;
  let lastDataLength = 0;

  function updateTopMetrics() {
    if (data.length === lastDataLength) return;
    lastDataLength = data.length;

    memoizedTopByVolume = new Set(
      [...data]
        .sort((a, b) => Number(b.rolling_24h_volume || 0) - Number(a.rolling_24h_volume || 0))
        .slice(0, 5)
        .map(p => p[rowKey])
    );

    memoizedTopByTVL = new Set(
      [...data]
        .sort((a, b) => Number(b.tvl || 0) - Number(a.tvl || 0))
        .slice(0, 5)
        .map(p => p[rowKey])
    );

    memoizedTopByAPY = new Set(
      [...data]
        .sort((a, b) => Number(b.rolling_24h_apy || 0) - Number(a.rolling_24h_apy || 0))
        .slice(0, 5)
        .map(p => p[rowKey])
    );
  }

  // Optimize getValue by using a Map for column lookups
  const columnMap = new Map();
  $: {
    columnMap.clear();
    columns.forEach(col => columnMap.set(col.key, col));
  }

  function getValue(obj: any, path: string): any {
    const column = columnMap.get(path);
    if (column?.sortValue) {
      return column.sortValue(obj);
    }
    
    // Use switch for common paths for better performance
    switch (path) {
      case 'marketCapRank': return obj.marketCapRank;
      case 'token': return obj.name?.toLowerCase() || '';
      case 'price': return Number(obj.metrics?.price || 0);
      case 'price_change_24h': return Number(obj.metrics?.price_change_24h || 0);
      case 'volume_24h': return Number(obj.metrics?.volume_24h || 0);
      case 'market_cap': return Number(obj.metrics?.market_cap || 0);
      case 'tvl': return Number(obj.metrics?.tvl || 0);
      default: return obj[path];
    }
  }

  // Add a helper function to check if a row is a KONG row
  function isKongToken(row: any): boolean {
    // Check for both token and pool cases
    return row.canister_id === KONG_CANISTER_ID || 
           row.address_0 === KONG_CANISTER_ID || 
           row.address_1 === KONG_CANISTER_ID;
  }

  // Make memoizedSortedData reactive to data, sortColumn, and sortDirection changes
  $: memoizedSortedData = (() => {
    if (!$sortColumn) {
      return [...data].sort((a, b) => {
        // Always ensure KONG is at the top even when no sorting is applied
        if (isKongToken(a)) return -1;
        if (isKongToken(b)) return 1;
        return 0;
      });
    }

    return [...data].sort((a, b) => {
      // Always ensure KONG is at the top regardless of sort
      if (isKongToken(a)) return -1;
      if (isKongToken(b)) return 1;

      let aValue = getValue(a, $sortColumn);
      let bValue = getValue(b, $sortColumn);

      if (typeof aValue === 'string') {
        return $sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      aValue = Number(aValue || 0);
      bValue = Number(bValue || 0);

      return $sortDirection === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    });
  })();

  // Make memoizedPaginatedData reactive to memoizedSortedData and currentPage
  $: memoizedPaginatedData = (() => {
    const start = ($currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    totalPages.set(Math.ceil(memoizedSortedData.length / itemsPerPage));
    return memoizedSortedData.slice(start, end);
  })();

  // Optimize price flash animations
  const flashDuration = 2000;
  let flashTimeouts = new Map();

  function updatePriceFlash(row: any) {
    const key = row[rowKey];
    const currentPrice = row.metrics?.price;
    const previousPrice = previousPrices.get(key);
    
    // Clear existing timeout if any
    if (flashTimeouts.has(key)) {
      clearTimeout(flashTimeouts.get(key));
    }

    const flashClass = currentPrice > previousPrice ? 'flash-green' : 'flash-red';
    
    // Set new timeout
    const timeout = setTimeout(() => {
      rowFlashStates.delete(key);
      rowFlashStates = new Map(rowFlashStates); // Create new reference to trigger reactivity
      flashTimeouts.delete(key);
    }, flashDuration);

    flashTimeouts.set(key, timeout);
    rowFlashStates.set(key, { class: flashClass, timeout });
    rowFlashStates = new Map(rowFlashStates); // Create new reference to trigger reactivity
  }

  // Store previous prices for flash animations
  let previousPrices = new Map<string, number>();

  // Track row flash states
  let rowFlashStates = new Map<string, { class: string, timeout: any }>();

  function toggleSort(column: string) {
    if ($sortColumn === column) {
      sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      sortColumn.set(column);
      sortDirection.set('desc');
    }
  }

  function getSortIcon(column: string) {
    if ($sortColumn !== column) return ArrowUpDown;
    return $sortDirection === 'asc' ? ArrowUp : ArrowDown;
  }

  function nextPage() {
    if ($currentPage < $totalPages) {
      currentPage.update(n => n + 1);
    }
  }

  function previousPage() {
    if ($currentPage > 1) {
      currentPage.update(n => n - 1);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= $totalPages) {
      currentPage.set(page);
    }
  }

  // Watch for price changes
  $: {
    for (const row of data) {
      const key = row[rowKey];
      const currentPrice = row.metrics?.price;
      const previousPrice = previousPrices.get(key);
      
      if (previousPrice !== undefined && currentPrice !== previousPrice) {
        updatePriceFlash(row);
      }
      
      previousPrices.set(key, currentPrice);
    }
  }

  // Add helper function to get trend class
  function getTrendClass(value: number): string {
    if (!value) return '';
    return value > 0 ? 'text-kong-accent-green' : value < 0 ? 'text-kong-accent-red' : '';
  }

  // Initialize sorting on mount
  onMount(() => {
    if (defaultSort.column) {
      sortColumn.set(defaultSort.column);
      sortDirection.set(defaultSort.direction);
    }
  });

  onMount(() => {
    // Initialize previous prices
    data.forEach(row => {
      previousPrices.set(row[rowKey], row.metrics?.price);
    });

    return () => {
      // Clear any remaining timeouts
      rowFlashStates.forEach(state => {
        if (state.timeout) clearTimeout(state.timeout);
      });
    };
  });
</script>

<div class="flex flex-col h-full">
  <div class="flex-1 overflow-auto">
    <table class="w-full border-collapse min-w-[800px] md:min-w-0">
      <thead class="bg-kong-bg-dark sticky top-0 z-20 !backdrop-blur-[12px]">
        <tr class="border-b border-kong-border bg-kong-bg-dark">
          {#each columns as column (column.key)}
            <th
              class="py-2 px-4 text-sm font-medium text-kong-text-secondary whitespace-nowrap {column.sortable ? 'cursor-pointer hover:bg-white/5' : ''} transition-colors duration-200 {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'}"
              style={column.width ? `width: ${column.width}` : ''}
              on:click={() => column.sortable && toggleSort(column.key)}
            >
              {column.title}
              {#if column.sortable}
                <svelte:component
                  this={getSortIcon(column.key)}
                  class="inline-block w-3.5 h-3.5 ml-1 align-text-bottom"
                />
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each memoizedPaginatedData as row, i (i)}
          {@const isKong = isKongRow ? isKongRow(row) : false}
          {@const flashState = rowFlashStates.get(row[rowKey])}
          <tr
            class="h-[44px] border-b border-kong-border/50 hover:bg-kong-bg-light/30 transition-colors duration-200 
              {onRowClick ? 'cursor-pointer' : ''} 
              {rowFlashStates.get(row[rowKey])?.class || ''} 
              {(isKongRow ? isKongRow(row) : isKongToken(row)) ? 'bg-kong-primary/5 hover:bg-kong-primary/10 border-kong-primary/20' : ''}"
            on:click={() => onRowClick?.(row)}
          >
            {#each columns as column (column.key)}
              {@const value = getValue(row, column.key)}
              {@const formattedValue = column.formatter ? column.formatter(row) : value}
              <td
                class="py-2 px-4 {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'}"
              >
                {#if column.component}
                  <svelte:component this={column.component} {row} />
                {:else}
                  <div class="inline-block w-full {column.key === 'price_change_24h' ? getTrendClass(value) : ''}">
                    {formattedValue}
                  </div>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  <div class="sticky bottom-0 left-0 right-0 flex items-center justify-between px-4 py-1 border-t border-kong-border backdrop-blur-md">
    <div class="flex items-center text-sm text-kong-text-secondary">
      Showing {($currentPage - 1) * itemsPerPage + 1} to {Math.min($currentPage * itemsPerPage, memoizedSortedData.length)} of {memoizedSortedData.length} items
    </div>
    <div class="flex items-center gap-2">
      <button
        class="pagination-button {$currentPage === 1 ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
        on:click={previousPage}
        disabled={$currentPage === 1}
      >
        Previous
      </button>
      
      {#each Array(Math.min(5, $totalPages)) as _, i (i)}
        {#if i + 1 <= $totalPages}
          <button
            class="pagination-button {$currentPage === i + 1 ? 'bg-kong-primary text-white' : 'text-kong-text-secondary hover:bg-kong-primary/20'}"
            on:click={() => goToPage(i + 1)}
          >
            {i + 1}
          </button>
        {/if}
      {/each}
      
      <button
        class="pagination-button {$currentPage === $totalPages ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
        on:click={nextPage}
        disabled={$currentPage === $totalPages}
      >
        Next
      </button>
    </div>
  </div>
</div>

<style scoped lang="postcss">
  button:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
  
  .pagination-button {
    @apply px-3 py-1 rounded text-sm transition-colors duration-200;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 20;
    background-color: var(--kong-bg-dark);
  }

  thead::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px solid var(--kong-border);
  }

  th {
    position: relative;
    background-color: var(--kong-bg-dark);
  }

  /* Add these flash animation styles */
  .flash-green {
    animation: flashGreen 2s ease-out;
  }

  .flash-red {
    animation: flashRed 2s ease-out;
  }

  @keyframes flashGreen {
    0% {
      background-color: rgba(34, 197, 94, 0.2);
    }
    100% {
      background-color: transparent;
    }
  }

  @keyframes flashRed {
    0% {
      background-color: rgba(239, 68, 68, 0.2);
    }
    100% {
      background-color: transparent;
    }
  }
</style> 