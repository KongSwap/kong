<script lang="ts">
  import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-svelte";
  import { onMount } from "svelte";

  const {
    data = [],
    columns = [],
    itemsPerPage = 50,
    defaultSort = { column: '', direction: 'desc' as 'asc' | 'desc' },
    onRowClick = null,
    rowKey = 'id',
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
    totalItems?: number;
    currentPage?: number;
    onPageChange?: ((page: number) => void) | null;
    isLoading?: boolean;
  }>();

  let sortColumn = $state(defaultSort.column || '');
  let sortDirection = $state<'asc' | 'desc'>(defaultSort.direction || 'desc');
  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));
  let hoveredRowIndex = $state<number | null>(null);

  // Reference to the scrollable container
  let scrollContainer: HTMLDivElement;
  let previousPageValue = $state(currentPage); // Track previous page


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

  let sortedData = $derived(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return [...data].sort((a, b) => {

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

  function onRowMouseEnter(index: number) {
    hoveredRowIndex = index;
  }
  
  function onRowMouseLeave() {
    hoveredRowIndex = null;
  }

  onMount(() => {
    if (defaultSort.column) {
      sortColumn = defaultSort.column;
      sortDirection = defaultSort.direction;
    }
  });
</script>

<div class="flex flex-col px-1">
  <div class="flex-1 overflow-auto bg-kong-bg-dark">
    <table class="w-full md:min-w-0">
      <thead>
        <tr class="uppercase">
          {#each columns as column (column.key)}
            <th
              class="pt-3 pb-2 !border-b border-kong-border px-4 text-sm font-bold text-kong-text-secondary whitespace-nowrap {column.sortable ? 'cursor-pointer hover:bg-white/5' : ''} transition-colors duration-200 {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'} first:rounded-l-lg last:rounded-r-lg"
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
        <tr><td class="h-1"></td></tr>
      </thead>
      <tbody class="min-h-[300px]">
        {#each displayData as row, idx (idx)}
          <tr
            class="h-[48px] border-b border-kong-border/10 transition-colors duration-200 {onRowClick ? 'cursor-pointer' : ''}"
            on:click={() => onRowClick?.(row)}
            on:mouseenter={() => onRowMouseEnter(idx)}
            on:mouseleave={onRowMouseLeave}
          >
            {#each columns as column (column.key)}
              {@const value = getValue(row, column.key)}
              {@const formattedValue = column.formatter ? column.formatter(row) : value}
              <td
                class="py-2 px-4 {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'}"
              >
                {#if column.component}
                  <svelte:component this={column.component} row={row} isHovered={hoveredRowIndex === idx} {...(column.componentProps || {})} />
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
    <div class="absolute inset-0 bg-kong-bg-light/30 backdrop-blur-[2px] flex items-center justify-center z-30 transition-opacity duration-200 rounded-xl">
      <div class="loading-spinner"></div>
    </div>
  {/if}

  <!-- Pagination -->
  <div class="z-20 w-full">
    <div class="flex items-center justify-between px-4 py-2 bg-kong-bg-dark mt-2">
      <div class="flex items-center text-sm text-kong-text-secondary">
        {#if totalItems > 0}
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
        {:else}
          No items to display
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <button
          class="pagination-pill {currentPage === 1 ? 'bg-kong-bg-light text-kong-text-secondary' : 'bg-kong-primary/10 text-kong-primary'}"
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
                class="pagination-pill {currentPage === pageNum ? 'bg-kong-primary text-white' : 'bg-kong-primary/10 text-kong-primary'}"
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
          class="pagination-pill {currentPage === totalPages || totalItems === 0 ? 'bg-kong-bg-light text-kong-text-secondary' : 'bg-kong-primary/10 text-kong-primary'}"
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
  .pagination-pill {
    @apply px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 shadow-none border-none;
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