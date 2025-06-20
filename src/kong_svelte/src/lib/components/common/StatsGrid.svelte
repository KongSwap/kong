<script lang="ts">
    import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-svelte";
  import { onMount } from "svelte";

  const {
    data = [],
    columns = [],
    itemsPerPage = 50,
    pageSizeOptions = [25, 50, 100, 200],
    defaultSort = { column: '', direction: 'desc' as 'asc' | 'desc' },
    onRowClick = null,
    rowKey = 'id',
    totalItems = 0,
    currentPage = 1,
    onPageChange = null,
    onPageSizeChange = null,
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
      isHtml?: boolean;
    }[];
    itemsPerPage?: number;
    pageSizeOptions?: number[];
    defaultSort?: { column: string; direction: 'asc' | 'desc' };
    onRowClick?: ((row: any) => void) | null;
    rowKey?: string;
    totalItems?: number;
    currentPage?: number;
    onPageChange?: ((page: number) => void) | null;
    onPageSizeChange?: ((pageSize: number) => void) | null;
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

  function isLowTVL(row: any): boolean {
    // Check if TVL is less than 100
    return Number(row.metrics?.tvl || 0) < 1000;
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
    return value > 0 ? 'text-kong-success' : value < 0 ? 'text-kong-error' : '';
  }

  function onRowMouseEnter(index: number) {
    hoveredRowIndex = index;
  }
  
  function onRowMouseLeave() {
    hoveredRowIndex = null;
  }

  function handlePageSizeChange(e: Event) {
    const newPageSize = parseInt((e.target as HTMLSelectElement).value);
    // Reset to page 1 when changing page size
    onPageChange?.(1);
    onPageSizeChange?.(newPageSize);
  }

  onMount(() => {
    if (defaultSort.column) {
      sortColumn = defaultSort.column;
      sortDirection = defaultSort.direction;
    }
  });

  // Generate column templates for grid based on provided width or auto-sizing
  let gridTemplateColumns = $derived(columns.map(col => {
    if (col.key === '#') return 'minmax(50px, 0.5fr)';
    if (col.key === 'token') return 'minmax(200px, 2fr)';
    if (col.key === 'price_change_24h') return 'minmax(80px, 1fr)';
    return col.width || 'minmax(100px, 1fr)';
  }).join(' '));
</script>

<div class="stats-grid-container">
  <!-- Fixed Header -->
  <div class="grid-header-container">
    <div class="grid-header" style="grid-template-columns: {gridTemplateColumns}">
      {#each columns as column (column.key)}
        <div 
          class="header-cell {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'} {column.sortable ? 'sortable' : ''}"
          onclick={() => column.sortable && toggleSort(column.key)}
        >
          <span>{column.title}</span>
          {#if column.sortable}
            <svelte:component
              this={getSortIcon(column.key)}
              class="sort-icon {sortColumn === column.key ? 'active' : ''}"
            />
          {/if}
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Scrollable Content Area -->
  <div class="grid-body-container" bind:this={scrollContainer}>
    <div class="grid-body">
      {#each displayData as row, idx (row[rowKey] || idx)}
        <div
          class="grid-row {$panelRoundness} {onRowClick ? 'clickable' : ''} {hoveredRowIndex === idx ? 'hovered' : ''} {isLowTVL(row) ? 'low-tvl' : ''}"
          style="grid-template-columns: {gridTemplateColumns}"
          onclick={() => onRowClick?.(row)}
          onmouseenter={() => onRowMouseEnter(idx)}
          onmouseleave={onRowMouseLeave}
        >
          {#each columns as column (column.key)}
            {@const value = getValue(row, column.key)}
            {@const formattedValue = column.formatter ? column.formatter(row) : value}
            
            <div class="grid-cell {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'}">
              {#if column.component}
                <svelte:component 
                  this={column.component} 
                  row={row} 
                  isHovered={hoveredRowIndex === idx} 
                  {...(column.componentProps || {})} 
                />
              {:else if column.isHtml}
                <div class="cell-content {column.key === 'price_change_24h' ? getTrendClass(value) : ''}">
                  {@html formattedValue}
                </div>
              {:else}
                <div class="cell-content {column.key === 'price_change_24h' ? getTrendClass(value) : ''}">
                  {formattedValue}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
      
      {#if displayData.length === 0 && !isLoading}
        <div class="empty-state">
          No data available
        </div>
      {/if}
    </div>
  </div>

  <!-- Fixed Footer/Pagination -->
  <div class="grid-footer-container">
    <div class="pagination-container">
      <div class="pagination-left">
        {#if onPageSizeChange}
          <div class="page-size-selector">
            <label for="page-size" class="page-size-label">Show:</label>
            <select
              id="page-size"
              class="page-size-select"
              value={itemsPerPage}
              onchange={handlePageSizeChange}
            >
              {#each pageSizeOptions as size}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>
      <div class="pagination-info">
        {#if totalItems > 0}
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
        {:else}
          No items to display
        {/if}
      </div>
      <div class="pagination-controls">
        <button
          class="pagination-pill {currentPage === 1 ? 'disabled' : 'active'}"
          onclick={previousPage}
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
                class="pagination-pill {currentPage === pageNum ? 'current' : 'active'}"
                onclick={() => goToPage(pageNum)}
              >
                {pageNum}
              </button>
            {:else if pageNum === currentPage - 2 || pageNum === currentPage + 2}
              <span class="pagination-ellipsis">...</span>
            {/if}
          {/each}
        {/if}
        <button
          class="pagination-pill {currentPage === totalPages || totalItems === 0 ? 'disabled' : 'active'}"
          onclick={nextPage}
          disabled={currentPage === totalPages || totalItems === 0}
        >
          Next
        </button>
      </div>
    </div>
  </div>

  <!-- Loading Overlay -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .stats-grid-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 100px); /* Adjust height to fit within viewport with some spacing */
    max-height: calc(100vh - 180px); /* Prevent overflow */
    width: 100%;
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
  }
  
  .grid-header-container {
    position: sticky;
    top: 0;
    z-index: 20;
    background-color: var(--bg-dark);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    flex-shrink: 0; /* Prevent header from shrinking */
  }
  
  .grid-body-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    min-height: 0; /* Critical for flex child to scroll properly */
  }
  
  .grid-footer-container {
    position: sticky;
    bottom: 0;
    z-index: 20;
    background-color: var(--bg-dark);
    box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.1);
    flex-shrink: 0; /* Prevent footer from shrinking */
  }
  
  .grid-header {
    display: grid;
    border-bottom: 1px solid var(--kong-border);
    background-color: var(--bg-dark);
  }
  
  .header-cell {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
    white-space: nowrap;
    display: flex;
    align-items: center;
    transition: background-color 0.2s;
  }
  
  /* First column with reduced horizontal padding */
  .grid-row > .grid-cell:first-child,
  .grid-header > .header-cell:first-child {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  
  .header-cell.text-right {
    justify-content: flex-end;
  }
  
  .header-cell.text-center {
    justify-content: center;
  }
  
  .header-cell.sortable {
    cursor: pointer;
  }
  
  .header-cell.sortable:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .sort-icon {
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
    opacity: 0.5;
  }
  
  .sort-icon.active {
    opacity: 1;
  }
  
  .grid-body {
    width: 100%;
  }
  
  .grid-row {
    display: grid;
    align-items: center;
    min-height: 48px;
    border-bottom: 1px solid rgba(var(--border) / 0.1);
    transition: background-color 0.2s;
  }
  
  .grid-row.clickable {
    cursor: pointer;
  }
  
  .grid-row.clickable:hover,
  .grid-row.hovered {
    background-color: rgba(var(--bg-light) / 0.8);
  }
  
  .grid-row.low-tvl {
    opacity: 0.3;
  }

  .grid-row.low-tvl:hover {
    opacity: 0.7;
  }
  
  .grid-cell {
    padding: 0.3rem 1rem;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  
  .grid-cell.text-right {
    justify-content: flex-end;
  }
  
  .grid-cell.text-center {
    justify-content: center;
  }
  
  .cell-content {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .loading-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(var(--bg-light) / 0.3);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    transition: opacity 0.2s;
    border-radius: 0.75rem;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--kong-primary);
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  
  .pagination-container {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: var(--bg-dark);
    border-top: 1px solid var(--kong-border);
  }

  .pagination-left {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
  
  .pagination-info {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-align: center;
    white-space: nowrap;
  }
  
  .pagination-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .page-size-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-size-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .page-size-select {
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--kong-border);
    background-color: var(--bg-light);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .page-size-select:hover {
    border-color: rgb(var(--primary) / 0.5);
  }

  .page-size-select:focus {
    outline: none;
    border-color: rgb(var(--primary));
    box-shadow: 0 0 0 2px rgba(var(--primary) / 0.2);
  }
  
  .pagination-pill {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background-color 0.2s, color 0.2s;
    border: none;
    outline: none;
    cursor: pointer;
  }
  
  .pagination-pill.active {
    background-color: rgba(var(--primary) / 0.1);
    color: rgb(var(--primary));
  }
  
  .pagination-pill.current {
    background-color: rgb(var(--primary));
    color: white;
  }
  
  .pagination-pill.disabled {
    background-color: rgb(var(--bg-light));
    color: rgb(var(--text-secondary));
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  .pagination-ellipsis {
    padding: 0 0.25rem;
    color: rgb(var(--text-secondary));
  }
  
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: rgb(var(--text-secondary));
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 