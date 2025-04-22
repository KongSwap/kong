<script lang="ts">
  import { ArrowUp, ArrowDown, ArrowUpDown, Flame, TrendingUp, Wallet } from "lucide-svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { onMount } from "svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import type { ThemeColors } from "$lib/themes/baseTheme";

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
  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));

  // Reference to the scrollable container
  let scrollContainer: HTMLDivElement;
  let previousPageValue = $state(currentPage); // Track previous page

  // Theme-related properties - use functions to compute values on demand
  function getCurrentTheme() {
    return getThemeById($themeStore);
  }

  function getThemeColors(): ThemeColors {
    return getCurrentTheme().colors as ThemeColors;
  }

  function isTableTransparent(): boolean {
    return getThemeColors().statsTableTransparent === true;
  }

  // Column map for optimized lookups
  let columnMap = $state(new Map());
  
  $effect(() => {
    columnMap.clear();
    columns.forEach(col => columnMap.set(col.key, col));
  });

  function getValue(obj: any, path: string): any {
    if (!obj) return null;
    
    const column = columnMap.get(path);
    if (column?.sortValue) {
      return column.sortValue(obj);
    }
    
    // Use switch for common paths for better performance
    switch (path) {
      case 'marketCapRank': return obj.marketCapRank ?? 0;
      case 'token': return obj.name?.toLowerCase() ?? '';
      case 'price': return Number(obj.metrics?.price ?? 0);
      case 'price_change_24h': return Number(obj.metrics?.price_change_24h ?? 0);
      case 'volume_24h': return Number(obj.metrics?.volume_24h ?? 0);
      case 'market_cap': return Number(obj.metrics?.market_cap ?? 0);
      case 'tvl': return Number(obj.metrics?.tvl ?? 0);
      default: return obj[path] ?? null;
    }
  }

  function isKongToken(row: any): boolean {
    return row.address === KONG_CANISTER_ID || 
           row.address_0 === KONG_CANISTER_ID || 
           row.address_1 === KONG_CANISTER_ID;
  }

  let sortedData = $derived(() => {
    if (!data || !Array.isArray(data)) return [];
    
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

      let aValue = getValue(a, sortColumn) ?? 0;
      let bValue = getValue(b, sortColumn) ?? 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      aValue = Number(aValue || 0);
      bValue = Number(bValue || 0);

      if (isNaN(aValue)) aValue = 0;
      if (isNaN(bValue)) bValue = 0;

      return sortDirection === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    });
  });

  let displayData = $state([]);

  $effect(() => {
    displayData = sortedData();
  });

  $effect(() => {
    // Scroll to top when currentPage changes
    if (scrollContainer && currentPage !== previousPageValue) {
      scrollContainer.scrollTop = 0;
    }
    previousPageValue = currentPage; // Update after check
  });

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
    return value > 0 ? 'text-kong-text-accent-green' : value < 0 ? 'text-kong-accent-red' : '';
  }

  onMount(() => {
    if (defaultSort.column) {
      sortColumn = defaultSort.column;
      sortDirection = defaultSort.direction;
    }
  });
</script>

<div class="flex flex-col h-full">
  <div class="flex-1 overflow-auto" bind:this={scrollContainer}>
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
      <tbody class={isTableTransparent() ? 'transparent-tbody' : 'solid-tbody'}>
        {#each displayData as row, idx (idx)}
          <tr
            class="h-[44px] border-b border-kong-border/50 hover:bg-kong-hover-bg-light transition-colors duration-200 
              {onRowClick ? 'cursor-pointer' : ''} 
              {isKongRow?.(row) ? '!bg-kong-primary/15 hover:bg-kong-primary/30 border-kong-primary/30' : ''}"
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
  <div class="bg-kong-bg-dark sticky bottom-0 z-20 !backdrop-blur-[12px]">
    <div class="border-t border-kong-border bg-kong-bg-dark flex items-center justify-between px-4 py-1">
      <div class="flex items-center text-sm text-kong-text-secondary">
        {#if totalItems > 0}
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
        {:else}
          No items to display
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <button
          class="pagination-button {currentPage === 1 ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
          on:click={previousPage}
          disabled={currentPage === 1 || totalItems === 0}
        >
          Previous
        </button>
        
        {#if totalItems > 0}
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
        {/if}
        
        <button
          class="pagination-button {currentPage === totalPages || totalItems === 0 ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
          on:click={nextPage}
          disabled={currentPage === totalPages || totalItems === 0}
        >
          Next
        </button>
      </div>
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
  
  /* Table background styling based on theme */
  .transparent-tbody tr {
    background-color: transparent;
  }
  
  .solid-tbody tr {
    background-color: var(--kong-bg-dark);
  }
  
  .solid-tbody tr:nth-child(even) {
    background-color: var(--kong-bg-light);
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