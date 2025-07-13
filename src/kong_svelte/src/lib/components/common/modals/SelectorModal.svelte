<script lang="ts">
  import { modalManager, type SelectorModalProps } from '$lib/stores/modalManager';
  import Modal from '../Modal.svelte';
  import { Search, ChevronRight } from 'lucide-svelte';

  let {
    id,
    items,
    searchable = true,
    searchPlaceholder = 'Search...',
    displayKey,
    onSelect,
    renderItem,
    ...modalProps
  }: SelectorModalProps & { id: string } = $props();

  let isOpen = $state(true);
  let searchTerm = $state('');
  let selectedIndex = $state(-1);
  let listElement: HTMLDivElement;

  // Filter items based on search term
  const filteredItems = $derived(() => {
    if (!searchable || !searchTerm.trim()) {
      return items;
    }

    const term = searchTerm.toLowerCase();
    return items.filter(item => {
      const displayValue = getDisplayValue(item).toLowerCase();
      return displayValue.includes(term);
    });
  });

  function getDisplayValue(item: any): string {
    if (displayKey) {
      if (typeof displayKey === 'function') {
        return displayKey(item);
      }
      return item[displayKey] || '';
    }
    
    // Default fallback - try common properties
    return item.name || item.label || item.title || item.symbol || String(item);
  }

  function handleSelect(item: any) {
    if (onSelect) {
      onSelect(item);
    }
    modalManager.close(id, item);
  }

  function handleCancel() {
    modalManager.close(id, null);
  }

  function handleKeydown(event: KeyboardEvent) {
    const items = filteredItems();
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          handleSelect(items[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        handleCancel();
        break;
    }
  }

  function scrollToSelected() {
    if (selectedIndex >= 0 && listElement) {
      const selectedElement = listElement.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // Reset selected index when search changes
  $effect(() => {
    selectedIndex = -1;
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<Modal
  bind:isOpen
  onClose={handleCancel}
  width="520px"
  height="600px"
  className="selector-modal"
  {...modalProps}
>
  <div class="flex flex-col h-full">
    <!-- Search Bar -->
    {#if searchable}
      <div class="p-4 border-b border-kong-border-primary">
        <div class="relative">
          <Search size={18} class="absolute left-3 top-1/2 transform -translate-y-1/2 text-kong-text-tertiary" />
          <input
            type="text"
            bind:value={searchTerm}
            placeholder={searchPlaceholder}
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-kong-border-primary bg-kong-bg-secondary text-kong-text-primary placeholder-kong-text-tertiary focus:outline-none focus:ring-2 focus:ring-kong-accent-primary focus:border-transparent"
            autofocus
          />
        </div>
      </div>
    {/if}

    <!-- Items List -->
    <div class="flex-1 overflow-y-auto">
      {#if filteredItems().length === 0}
        <div class="flex items-center justify-center h-full text-kong-text-tertiary">
          <div class="text-center">
            <div class="text-lg mb-2">No items found</div>
            {#if searchTerm}
              <div class="text-sm">Try adjusting your search</div>
            {/if}
          </div>
        </div>
      {:else}
        <div bind:this={listElement} class="divide-y divide-kong-border-primary">
          {#each filteredItems() as item, index (item)}
            <button
              type="button"
              onclick={() => handleSelect(item)}
              onmouseenter={() => selectedIndex = index}
              class="w-full px-4 py-3 text-left hover:bg-kong-bg-tertiary transition-colors duration-200 flex items-center justify-between group
                {selectedIndex === index ? 'bg-kong-bg-tertiary' : ''}"
            >
              <div class="flex-1 min-w-0">
                {#if renderItem}
                  {@render renderItem(item)}
                {:else}
                  <div class="text-kong-text-primary font-medium truncate">
                    {getDisplayValue(item)}
                  </div>
                  
                  <!-- Show additional info if item has more properties -->
                  {#if item.description}
                    <div class="text-sm text-kong-text-tertiary mt-1 truncate">
                      {item.description}
                    </div>
                  {/if}
                  
                  {#if item.subtitle || item.address}
                    <div class="text-xs text-kong-text-tertiary mt-1 truncate font-mono">
                      {item.subtitle || item.address}
                    </div>
                  {/if}
                {/if}
              </div>
              
              <ChevronRight 
                size={16} 
                class="text-kong-text-tertiary group-hover:text-kong-text-secondary transition-colors ml-2 flex-shrink-0" 
              />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer Info -->
    {#if filteredItems().length > 0}
      <div class="p-3 border-t border-kong-border-primary bg-kong-bg-secondary text-xs text-kong-text-tertiary">
        {filteredItems().length} item{filteredItems().length !== 1 ? 's' : ''} 
        {searchTerm ? 'found' : 'available'}
        • Use ↑↓ to navigate, Enter to select
      </div>
    {/if}
  </div>
</Modal>

<style>
  :global(.selector-modal .modal-content) {
    border-radius: 12px;
    overflow: hidden;
  }
</style>