<script lang="ts">
  import { ArrowUp, ArrowDown, ArrowUpDown, Flame, TrendingUp, Wallet } from "lucide-svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { onMount } from "svelte";

  const {
    data = [],
    columns = [],
    itemsPerPage = 100,
    defaultSort = { column: '', direction: 'desc' as 'asc' | 'desc' },
    onRowClick = null,
    rowKey = 'id',
    isKongRow = null,
    totalItems = 0,
    currentPage = 1,
    onPageChange = null,
    isLoading = false
  } = $props<{
    data: any[];
    columns: {
      key: string;
      title: string;
      sortable?: boolean;
      align?: 'left' | 'center' | 'right';
      width?: string;
      formatter?: (value: any) => string | number;
      component?: any;
      componentProps?: any;
      sortValue?: (row: any) => string | number;
    }[];
    itemsPerPage?: number;
    defaultSort?: { column: string; direction: 'asc' | 'desc' };
    onRowClick?: ((row: any) => void) | null;
    rowKey?: string;
    isKongRow?: ((row: any) => boolean) | null;
    totalItems?: number;
    currentPage?: number;
    onPageChange?: ((page: number) => void) | null;
    isLoading?: boolean;
  }>();

  let sortColumn = $state(defaultSort.column || '');
  let sortDirection = $state<'asc' | 'desc'>(defaultSort.direction || 'desc');
  let totalPages = $derived(Math.ceil(totalItems / itemsPerPage));

  // Column map for optimized lookups
  let columnMap = $state(new Map());
  
  $effect(() => {
    columnMap.clear();
    columns.forEach(col => columnMap.set(col.key, col));
  });

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

  function isKongToken(row: any): boolean {
    return row.canister_id === KONG_CANISTER_ID || 
           row.address_0 === KONG_CANISTER_ID || 
           row.address_1 === KONG_CANISTER_ID;
  }

  let sortedData = $derived(() => {
    if (!sortColumn) {
      return [...data].sort((a, b) => {
        if (isKongToken(a)) return -1;
        if (isKongToken(b)) return 1;
        return 0;
      });
    }

    return [...data].sort((a, b) => {
      if (isKongToken(a)) return -1;
      if (isKongToken(b)) return 1;

      let aValue = getValue(a, sortColumn);
      let bValue = getValue(b, sortColumn);

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      aValue = Number(aValue || 0);
      bValue = Number(bValue || 0);

      return sortDirection === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    });
  });

  let displayData = $state([]);

  $effect(() => {
    displayData = sortedData();
  });

  const flashDuration = 2000;
  let flashTimeouts = $state(new Map());
  let rowFlashStates = $state(new Map<string, { class: string, timeout: any }>());
  let previousPrices = $state(new Map<string, number>());

  $effect(() => {
    data.forEach(row => {
      const key = row[rowKey];
      const currentPrice = Number(row.metrics?.price || 0);
      const lastPrice = previousPrices.get(key);

      if (lastPrice !== undefined && currentPrice !== lastPrice) {
        updatePriceFlash(row, lastPrice);
      }
      
      previousPrices.set(key, currentPrice);
    });
  });

  function updatePriceFlash(row: any, previousPrice: number) {
    const key = row[rowKey];
    const currentPrice = Number(row.metrics?.price || 0);
    
    if (flashTimeouts.has(key)) {
      clearTimeout(flashTimeouts.get(key));
    }

    const flashClass = currentPrice > previousPrice ? 'flash-green' : 'flash-red';
    
    const timeout = setTimeout(() => {
      rowFlashStates.delete(key);
      flashTimeouts.delete(key);
    }, flashDuration);

    flashTimeouts.set(key, timeout);
    rowFlashStates.set(key, { class: flashClass, timeout });
  }

  function toggleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'desc';
    }
  }

  function getSortIcon(column: string) {
    if (sortColumn !== column) return ArrowUpDown;
    return sortDirection === 'asc' ? ArrowUp : ArrowDown;
  }

  function nextPage() {
    if (currentPage < totalPages) {
      onPageChange?.(currentPage + 1);
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      onPageChange?.(page);
    }
  }

  function getTrendClass(value: number): string {
    if (!value) return '';
    return value > 0 ? 'text-kong-accent-green' : value < 0 ? 'text-kong-accent-red' : '';
  }

  onMount(() => {
    if (defaultSort.column) {
      sortColumn = defaultSort.column;
      sortDirection = defaultSort.direction;
    }

    return () => {
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
        {#each displayData as row (row[rowKey])}
          <tr
            class="h-[44px] border-b border-kong-border/50 hover:bg-kong-bg-light/30 transition-colors duration-200 
              {onRowClick ? 'cursor-pointer' : ''} 
              {rowFlashStates.get(row[rowKey])?.class || ''} 
              {isKongRow?.(row) ? 'bg-kong-primary/5 hover:bg-kong-primary/10 border-kong-primary/20' : ''}"
            on:click={() => onRowClick?.(row)}
          >
            {#each columns as column (column.key)}
              {@const value = getValue(row, column.key)}
              {@const formattedValue = column.formatter ? column.formatter(row) : value}
              <td
                class="py-2 px-4 {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'}"
              >
                {#if column.component}
                  <svelte:component this={column.component} row={row} {...(column.componentProps || {})} />
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

  <!-- Loading Overlay -->
  {#if isLoading}
    <div class="absolute inset-0 bg-kong-bg-dark/30 backdrop-blur-[2px] flex items-center justify-center z-30 transition-opacity duration-200">
      <div class="loading-spinner"></div>
    </div>
  {/if}

  <!-- Pagination -->
  <div class="sticky bottom-0 left-0 right-0 flex items-center justify-between px-4 py-1 border-t border-kong-border backdrop-blur-md">
    <div class="flex items-center text-sm text-kong-text-secondary">
      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
    </div>
    <div class="flex items-center gap-2">
      <button
        class="pagination-button {currentPage === 1 ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
        on:click={previousPage}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      
      {#each Array(totalPages) as _, i}
        {@const pageNum = i + 1}
        {@const showPage = 
          pageNum === 1 || 
          pageNum === totalPages || 
          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)}
        
        {#if showPage}
          <button
            class="pagination-button {currentPage === pageNum ? 'bg-kong-primary text-white' : 'text-kong-text-secondary hover:bg-kong-primary/20'}"
            on:click={() => goToPage(pageNum)}
          >
            {pageNum}
          </button>
        {:else if pageNum === currentPage - 2 || pageNum === currentPage + 2}
          <span class="px-1 text-kong-text-secondary">...</span>
        {/if}
      {/each}
      
      <button
        class="pagination-button {currentPage === totalPages ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
        on:click={nextPage}
        disabled={currentPage === totalPages}
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

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--kong-primary);
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 