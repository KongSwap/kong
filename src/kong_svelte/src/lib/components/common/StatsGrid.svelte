<script lang="ts">
    import { panelRoundness } from "$lib/stores/derivedThemeStore";
    import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-svelte";
    import { app } from "$lib/state/app.state.svelte"

  const {
    data = [],
    columns = [],
    itemsPerPage = 50,
    pageSizeOptions = [25, 50, 100, 200],
    onRowClick = null,
    rowKey = 'id',
    totalItems = 0,
    currentPage = 1,
    onPageChange = null,
    onPageSizeChange = null,
    isLoading = false,
    sortColumn = '',
    sortDirection = 'desc',
    onSortChange = null
  } = $props<{
    data: any[];
    columns: {
      key: string;
      title: string;
      sortable?: boolean;
      align?: 'left' | 'center' | 'right';
      width?: string;
      formatter?: (value: any, index?: number) => string | number;
      component?: any;
      componentProps?: any;
      sortValue?: (row: any) => string | number;
      isHtml?: boolean;
    }[];
    itemsPerPage?: number;
    pageSizeOptions?: number[];
    onRowClick?: ((row: any) => void) | null;
    rowKey?: string;
    totalItems?: number;
    currentPage?: number;
    onPageChange?: ((page: number) => void) | null;
    onPageSizeChange?: ((pageSize: number) => void) | null;
    isLoading?: boolean;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
    onSortChange?: ((column: string, direction: 'asc' | 'desc') => void) | null;
  }>();

  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));
  let hoveredRowIndex = $state<number | null>(null);
  let isMobile = $derived(app.isMobile);

  // Reference to the scrollable container and frozen content
  let scrollContainer: HTMLDivElement;
  let frozenBody: HTMLDivElement;
  let gridScrollContainer: HTMLDivElement;
  let previousPageValue = $state(currentPage); // Track previous page

  // Manual scroll system
  let rootScrollTop = $state(0);
  let maxScrollHeight = $state(0);

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

  // Use the provided data directly (already sorted by parent)
  let displayData = $derived(data);

  // Calculate max scroll height (for desktop)
  $effect(() => {
    if (scrollContainer && frozenBody) {
      const containerHeight = scrollContainer.clientHeight;
      const contentHeight = scrollContainer.scrollHeight;
      maxScrollHeight = Math.max(0, contentHeight - containerHeight);
    }
  });

  // Reset scroll when page changes
  $effect(() => {
    if (currentPage !== previousPageValue) {
      rootScrollTop = 0;
    }
    previousPageValue = currentPage;
  });

  // Manual scroll synchronization
  $effect(() => {
    if (!scrollContainer || !frozenBody) return;

    // Clamp scrollTop to valid range
    const clampedScrollTop = Math.max(0, Math.min(rootScrollTop, maxScrollHeight));
    
    // Update both containers' scroll positions
    scrollContainer.scrollTop = clampedScrollTop;
    frozenBody.scrollTop = clampedScrollTop;
  });



  // Handle wheel events for manual scrolling
  function handleWheel(event: WheelEvent) {
    // Only handle vertical scrolling, allow horizontal scrolling to work normally
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      
      const scrollSpeed = 1.5; // Adjust scroll sensitivity
      const deltaY = event.deltaY * scrollSpeed;
      
      rootScrollTop = Math.max(0, Math.min(rootScrollTop + deltaY, maxScrollHeight));
    }
  }

  // Prevent vertical scroll events from interfering
  function preventVerticalScroll(event: Event) {
    // Only prevent the default if it's a vertical scroll event
    const scrollEvent = event as any;
    if (scrollEvent.target === frozenBody || scrollEvent.target === scrollContainer) {
      // Check if scrollTop changed (vertical scroll) and reset it
      if (scrollEvent.target.scrollTop !== rootScrollTop) {
        event.preventDefault();
        scrollEvent.target.scrollTop = rootScrollTop;
      }
    }
  }

  function toggleSort(column: string) {
    if (!onSortChange) return;
    
    let newDirection: 'asc' | 'desc' = 'desc';
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    onSortChange(column, newDirection);
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

  // Split columns into frozen and scrollable
  let frozenColumns = $derived(columns.slice(0, 2)); // First two columns (# and token)
  let scrollableColumns = $derived(columns.slice(2)); // Rest of the columns
  
  // Generate column templates for frozen columns
  let frozenGridTemplateColumns = $derived(frozenColumns.map(col => {
    if (col.key === '#') return isMobile ? '35px' : '50px';
    if (col.key === 'token') return isMobile ? '70px' : '250px';
    return col.width || '120px';
  }).join(' '));
  
  // Generate column templates for scrollable columns
  let scrollableGridTemplateColumns = $derived(scrollableColumns.map(col => {
    if (col.key === 'price_change_24h') return isMobile ? '100px' : '120px';
    if (col.key === 'price') return isMobile ? '100px' : '120px';
    if (col.key === 'volume_24h') return isMobile ? '100px' : '140px';
    if (col.key === 'market_cap') return isMobile ? '100px' : '140px';
    if (col.key === 'tvl') return isMobile ? '100px' : '140px';
    return col.width || '120px';
  }).join(' '));

</script>

<div class="stats-grid-container">
  <!-- Frozen Columns + Scrollable Container -->
  <div 
    class="grid-scroll-container" 
    bind:this={gridScrollContainer}
    onwheel={handleWheel}
  >
    <div class="grid-content-wrapper">
      <!-- Frozen Columns Section -->
      <div class="frozen-columns-section">
        <div class="frozen-content" bind:this={frozenBody} onscroll={preventVerticalScroll}>
          <!-- Frozen Header -->
          <div class="grid-header frozen-header bg-kong-bg-secondary" style="grid-template-columns: {frozenGridTemplateColumns}">
            {#each frozenColumns as column (column.key)}
              {@const key = column.key}
              {#if !isMobile || key !== '#'}
                <div 
                  class="header-cell {isMobile ? 'center ml-2' : column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'} {column.sortable ? 'sortable' : ''} {column.sortable && sortColumn === column.key ? 'active' : ''}"
                  onclick={() => column.sortable && toggleSort(column.key)}
                >
                  <span>{column.title}</span>
                </div>
              {/if}
            {/each}
          </div>
          
          <!-- Frozen Body -->
          <div class="grid-body frozen-body">
            {#each displayData as row, idx (row[rowKey] || idx)}
              <div
                class="grid-row frozen-row {$panelRoundness} {onRowClick ? 'clickable' : ''} {hoveredRowIndex === idx ? 'hovered' : ''} {isLowTVL(row) ? 'low-tvl' : ''}"
                style="grid-template-columns: {frozenGridTemplateColumns}"
                onclick={() => onRowClick?.(row)}
                onmouseenter={() => onRowMouseEnter(idx)}
                onmouseleave={onRowMouseLeave}
              >
                {#each frozenColumns as column (column.key)}
                  {@const value = getValue(row, column.key)}
                  {@const formattedValue = column.formatter ? column.formatter(row, idx) : value}
                  
                  <div class="{column.key === 'token' ? 'token-cell' : 'grid-cell'} {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'}">
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
          </div>
        </div>
      </div>
      
      <!-- Scrollable Columns Section -->
      <div class="scrollable-columns-section">
        <div class="scrollable-content" bind:this={scrollContainer} onscroll={preventVerticalScroll}>
          <!-- Scrollable Header -->
          <div class="grid-header scrollable-header bg-kong-bg-secondary justify-between gap-2" style="grid-template-columns: {scrollableGridTemplateColumns}">
            {#each scrollableColumns as column (column.key)}
              <div 
                class="header-cell {column.align === 'left' ? 'text-left' : column.align === 'center' ? 'text-center' : 'text-right'} {column.sortable ? 'sortable' : ''} {column.sortable && sortColumn === column.key ? 'active' : ''}"
                onclick={() => column.sortable && toggleSort(column.key)}
              >
                <span>{column.title}</span>
                {#if column.sortable}
                  <div class="sort-icon-container">
                    {#if sortColumn !== column.key}
                      <ArrowUpDown size={12} />
                    {:else if sortDirection === 'asc'}
                      <ArrowUp size={12} />
                    {:else}
                      <ArrowDown size={12} />
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
          
          <!-- Scrollable Body -->
          <div class="grid-body scrollable-body gap-2">
            {#each displayData as row, idx (row[rowKey] || idx)}
              <div
                class="grid-row scrollable-row justify-between {$panelRoundness} {onRowClick ? 'clickable' : ''} {hoveredRowIndex === idx ? 'hovered' : ''} {isLowTVL(row) ? 'low-tvl' : ''}"
                style="grid-template-columns: {scrollableGridTemplateColumns}"
                onclick={() => onRowClick?.(row)}
                onmouseenter={() => onRowMouseEnter(idx)}
                onmouseleave={onRowMouseLeave}
              >
                {#each scrollableColumns as column (column.key)}
                  {@const value = getValue(row, column.key)}
                  {@const formattedValue = column.formatter ? column.formatter(row, idx) : value}
                  
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
          </div>
        </div>
      </div>
    </div>
    
    {#if displayData.length === 0 && !isLoading}
      <div class="empty-state">
        No data available
      </div>
    {/if}
  </div>

  <!-- Fixed Footer/Pagination -->
  <div class="footer-container">
    <div class="pagination-container">
      {#if !isMobile}
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
      {/if}
      <div class="flex gap-2 w-full justify-end">
        <!-- <div class="pagination-info">
          {#if totalItems > 0}
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
          {:else}
            No items to display
          {/if}
        </div> -->
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
  </div>

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
    height: 100%;
    width: 100%;
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
  }
  
  .grid-scroll-container {
    flex: 1; /* Take all remaining space */
    position: relative;
    min-height: 0; /* Critical for flex child to scroll properly */
    overflow: hidden; /* Container doesn't scroll, children handle scrolling */
  }
  
  .grid-content-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    position: relative;
  }
  
  .frozen-columns-section {
    display: flex;
    height: 100%;
    position: relative;
    overflow: hidden;
    border-right: 2px solid var(--kong-border);
    background-color: var(--bg-dark);
    z-index: 15;
  }
  
  .frozen-content {
    height: 100%;
    overflow-x: hidden;
    overflow-y: hidden; /* Disable native vertical scrolling */
    /* Hide scrollbars completely */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* Internet Explorer 10+ */
  }
  
  /* Hide scrollbars for WebKit browsers */
  .frozen-content::-webkit-scrollbar {
    display: none;
    width: 0px;
    height: 0px;
  }
  
    .scrollable-columns-section {
    display: flex;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  
  .scrollable-content {
    height: 100%; /* Match frozen content height */
    width: 100%;
    overflow-x: auto; /* Keep horizontal scrolling for table columns */
    overflow-y: hidden; /* Disable native vertical scrolling */
    /* Hide vertical scrollbars completely */
    scrollbar-width: none; /* Firefox - hide all scrollbars */
    -ms-overflow-style: none; /* Internet Explorer 10+ */
  }
  
  /* Hide all scrollbars for WebKit browsers */
  .scrollable-content::-webkit-scrollbar {
    display: none;
    width: 0px;
    height: 0px;
  }
  
  .footer-container {
    display: flex;
    height: 60px; /* Fixed height for footer - increased to accommodate content */
    position: relative;
    z-index: 20;
    background-color: var(--bg-dark);
    box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.1);
    flex-shrink: 0; /* Prevent footer from shrinking */
  }
  
  .grid-header {
    display: grid;
    min-width: max-content; /* Ensure header doesn't compress */
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    border-bottom: 1px solid var(--kong-border);
  }
  
  .frozen-header {
    border-right: none; /* Remove right border since we have section border */
    position: sticky;
    top: 0;
    z-index: 11; /* Higher than scrollable header */
  }
  
  .scrollable-header {
    border-left: none; /* Remove left border since frozen section has right border */
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .grid-body {
    min-width: max-content; /* Ensure body doesn't compress */
  }
  
  .frozen-body {
    min-width: max-content;
  }
  
  .scrollable-body {
    min-width: max-content;
  }
  
  .frozen-row,
  .scrollable-row {
    height: 48px; /* Ensure consistent row height */
  }
  
  /* Synchronize row hover effects between frozen and scrollable sections */
  .grid-row.frozen-row.hovered ~ .grid-content-wrapper .scrollable-row.hovered,
  .grid-row.scrollable-row.hovered ~ .grid-content-wrapper .frozen-row.hovered {
    background-color: rgba(var(--bg-light) / 0.8);
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
    transition: background-color 0.2s, color 0.2s, transform 0.1s;
    background-color: var(--bg-dark); /* Ensure solid background */
    border-right: 1px solid transparent; /* Match cell border structure */
    gap: 0.25rem;
  }
  
  .grid-row {
    display: grid;
    align-items: center;
    height: 48px;
    border-bottom: 1px solid rgba(var(--border) / 0.1);
    transition: background-color 0.2s;
    background-color: var(--bg-dark); /* Ensure rows have solid background */
  }

  .token-cell {
    padding: 0.75rem 1rem; /* Match header cell padding exactly */
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: nowrap; /* Prevent text wrapping */
    border-right: 1px solid transparent; /* Match header cell border structure */

    @media (max-width: 768px) {
      padding: 0.75rem 0.25rem;
    }
  }
  
  .grid-cell {
    padding: 0.75rem 1rem; /* Match header cell padding exactly */
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: nowrap; /* Prevent text wrapping */
    border-right: 1px solid transparent; /* Match header cell border structure */
  }
  
  /* First column with reduced horizontal padding - apply to both header and body */
  .grid-row > .grid-cell:first-child,
  .grid-header > .header-cell:first-child {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  
  .header-cell.text-right,
  .grid-cell.text-right {
    justify-content: flex-end;
  }
  
  .header-cell.text-center,
  .grid-cell.text-center {
    justify-content: center;
  }
  
  .header-cell.sortable {
    cursor: pointer;
  }
  
  .header-cell.sortable:hover {
    background-color: rgba(255, 255, 255, 0.05);
    transform: translateY(-1px);
  }
  
  .header-cell.sortable:active {
    transform: translateY(0);
  }
  
  .header-cell.sortable.active {
    background-color: rgba(var(--primary) / 0.1);
    color: rgb(var(--primary));
    position: relative;
    box-shadow: 0 0 0 1px rgba(var(--primary) / 0.3);
    animation: sortPulse 0.3s ease-out;
  }
  
  .header-cell.sortable.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgb(var(--primary)), transparent);
    animation: sortSlide 0.4s ease-out;
  }
  
  .sort-icon.active {
    opacity: 1;
  }
  
  .sort-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
    opacity: 0.6;
  }
  
  .header-cell.sortable:hover .sort-icon-container {
    opacity: 1;
    transform: scale(1.1);
  }
  
  .header-cell.sortable.active .sort-icon-container {
    opacity: 1;
    transform: scale(1.15);
    animation: iconBounce 0.3s ease-out;
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
  
  .cell-content {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap; /* Prevent text wrapping */
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
    display: flex;
    height: 100%;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    padding: 0 1rem;
    background-color: var(--bg-dark);
    border-top: 1px solid var(--kong-border);

    @media (max-width: 768px) {
      justify-content: center;
    }
  }

  .pagination-left {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
  
  .pagination-info {
    display: flex;
    align-items: center;
    justify-content: center;
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
    flex-wrap: wrap; /* Allow pagination to wrap on very small screens */
  }

  .page-size-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-size-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    white-space: nowrap;
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
    min-width: 60px; /* Prevent select from being too small */
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
    white-space: nowrap; /* Prevent text wrapping */
    min-width: 0; /* Allow shrinking if needed */
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
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgb(var(--text-secondary));
    background-color: var(--bg-dark); /* Ensure empty state has solid background */
    padding: 2rem;
    border-radius: 0.5rem;
  }

  /* Mobile-specific improvements */
  @media (max-width: 768px) {
    
    .frozen-columns-section {
      min-width: 80px;
    }
    

    
    /* .header-cell {
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem; 
    } */
    
    .grid-cell {
      padding: 0.5rem 0.75rem; 
      font-size: 0.875rem;
    }
    
    /* First column with reduced horizontal padding - apply to both header and body */
    .frozen-row > .grid-cell:first-child,
    .frozen-header > .header-cell:first-child {
      padding-left: 0.25rem;
      padding-right: 0.25rem;
    }
  
    
    .pagination-left {
      justify-content: center;
      order: 3;
    }
    
    .pagination-info {
      order: 1;
      font-size: 0.75rem;
    }
    
    .pagination-controls {
      order: 2;
      justify-content: center;
      gap: 0.25rem;
    }
    
    .pagination-pill {
      padding: 0.2rem 0.5rem;
      font-size: 0.75rem;
    }
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes sortPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 1px rgba(var(--primary) / 0.3);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 3px rgba(var(--primary) / 0.2);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 1px rgba(var(--primary) / 0.3);
    }
  }
  
  @keyframes sortSlide {
    0% {
      opacity: 0;
      transform: scaleX(0);
    }
    50% {
      opacity: 1;
      transform: scaleX(0.8);
    }
    100% {
      opacity: 1;
      transform: scaleX(1);
    }
  }
  
  @keyframes iconBounce {
    0% {
      transform: scale(1.15);
    }
    30% {
      transform: scale(1.3);
    }
    60% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1.15);
    }
  }
</style> 