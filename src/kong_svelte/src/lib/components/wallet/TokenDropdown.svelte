<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { 
    ArrowUp, 
    ArrowDown, 
    Repeat, 
    Info, 
    ExternalLink,
    ChevronRight,
    X
  } from 'lucide-svelte';
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  
  // Define props
  type TokenDetail = {
    symbol: string;
    name: string;
    balance: string | number;
    usdValue: number;
    icon: string;
    change24h: number;
    token: FE.Token;
  };
  
  export let token: TokenDetail;
  export let position: { top: number; left: number; width: number };
  export let visible = false;
  export let onClose: () => void = () => {};
  export let onAction: ((action: 'send' | 'receive' | 'swap' | 'info', token: TokenDetail) => void) | undefined = undefined;
  
  let dropdownElement: HTMLElement;
  let adjustedPosition = { top: 0, left: 0, width: 240 };
  
  // Handle positioning
  function updatePosition() {
    if (!position || !dropdownElement) return;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default width and position
    let top = position.top;
    let left = position.left;
    let width = Math.min(position.width, 320); // Cap width at 320px
    
    // Measure actual dropdown height
    const dropdownHeight = dropdownElement.offsetHeight;
    
    // If on a small mobile device, use a fixed width
    if (viewportWidth < 480) {
      width = Math.min(viewportWidth - 40, 320); // 20px padding on each side
      left = Math.max(20, (viewportWidth - width) / 2); // Center horizontally
    } else {
      // On larger screens, align with the clicked item
      // Make sure dropdown doesn't go off screen to the right
      if (left + width > viewportWidth - 20) {
        left = Math.max(10, viewportWidth - width - 20);
      }
    }
    
    // Check if there's more space above or below the clicked position
    const spaceBelow = viewportHeight - position.top;
    const spaceAbove = position.top;
    
    // Determine whether to place dropdown above or below
    if (spaceBelow < dropdownHeight + 20 && spaceAbove > spaceBelow) {
      // Place above if there's not enough space below but more space above
      top = Math.max(10, position.top - dropdownHeight - 10);
    } else if (spaceBelow < dropdownHeight + 20) {
      // Not enough space below and not enough space above either
      // Center in available space and let it scroll
      top = Math.max(10, viewportHeight - dropdownHeight - 10);
    }
    
    // Final safety check to ensure the dropdown is visible
    if (top + dropdownHeight > viewportHeight - 10) {
      top = Math.max(10, viewportHeight - dropdownHeight - 10);
    }
    
    // Update position
    adjustedPosition = { top, left, width };
  }
  
  // Update position after render
  afterUpdate(() => {
    if (visible && dropdownElement) {
      updatePosition();
    }
  });
  
  // Handle action click
  function handleAction(action: 'send' | 'receive' | 'swap' | 'info') {
    console.log(`Action clicked: ${action}`);
    
    if (onAction) {
      console.log('onAction callback exists, calling it');
      onAction(action, token);
    } else {
      console.log('onAction callback is missing');
      alert(`Token action clicked: ${action} - but no handler is provided`);
    }
    
    onClose();
  }
  
  // Handle click outside to close dropdown
  function handleClickOutside(event: MouseEvent) {
    if (visible && dropdownElement && !dropdownElement.contains(event.target as Node)) {
      onClose();
    }
  }
  
  // Set up event listener for clicks outside the dropdown
  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
    // Initial position update
    if (visible && dropdownElement) {
      updatePosition();
    }
    
    // Handle window resize
    const handleResize = () => {
      if (visible && dropdownElement) {
        updatePosition();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

{#if visible}
  <div 
    bind:this={dropdownElement}
    class="absolute z-30 bg-kong-bg-dark rounded-md border border-kong-border shadow-lg"
    style="top: {adjustedPosition.top}px; left: {adjustedPosition.left}px; width: {adjustedPosition.width}px; max-width: 320px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2);"
    in:slide={{ duration: 200, easing: quintOut }}
    out:slide={{ duration: 150, easing: quintOut }}
    on:click|stopPropagation
  >
    <!-- Header with close button -->
    <div class="flex items-center justify-between p-3 border-b border-kong-border">
      <div class="flex items-center gap-2">
        <TokenImages
          tokens={[token.token]}
          size={24}
          showSymbolFallback={true}
        />
        <div class="font-medium text-kong-text-primary">{token.name}</div>
      </div>
      <button 
        class="w-6 h-6 flex items-center justify-center rounded-md text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/5 hover:bg-kong-text-primary/10 transition-colors" 
        on:click={onClose}
      >
        <X size={14} />
      </button>
    </div>
    
    <!-- Token details -->
    <div class="p-3 border-b border-kong-border">
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div class="text-xs text-kong-text-secondary mb-1">Balance</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {token.balance} {token.symbol}
          </div>
        </div>
        <div>
          <div class="text-xs text-kong-text-secondary mb-1">Value</div>
          <div class="text-sm font-medium text-kong-text-primary">
            ${token.usdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
      <div>
        <div class="text-xs text-kong-text-secondary mb-1">24h Change</div>
        <div class="text-sm font-medium {token.change24h >= 0 ? 'text-kong-accent-green' : 'text-kong-accent-red'}">
          {Number(formatToNonZeroDecimal(token.change24h)) >= 0 ? "+" : ""}{formatToNonZeroDecimal(token.change24h)}%
        </div>
      </div>
    </div>
    
    <!-- Action buttons -->
    <div class="p-2">
      <button 
        class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-light/10 transition-colors text-kong-text-primary"
        on:click={() => handleAction('send')}
      >
        <ArrowUp size={16} class="text-kong-text-secondary" />
        <span>Send {token.symbol}</span>
        <ChevronRight size={16} class="text-kong-text-secondary ml-auto" />
      </button>
      
      <button 
        class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-light/10 transition-colors text-kong-text-primary"
        on:click={() => handleAction('receive')}
      >
        <ArrowDown size={16} class="text-kong-text-secondary" />
        <span>Receive {token.symbol}</span>
        <ChevronRight size={16} class="text-kong-text-secondary ml-auto" />
      </button>
      
      <button 
        class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-light/10 transition-colors text-kong-text-primary"
        on:click={() => handleAction('swap')}
      >
        <Repeat size={16} class="text-kong-text-secondary" />
        <span>Swap {token.symbol}</span>
        <ChevronRight size={16} class="text-kong-text-secondary ml-auto" />
      </button>
      
      <button 
        class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-light/10 transition-colors text-kong-text-primary"
        on:click={() => handleAction('info')}
      >
        <Info size={16} class="text-kong-text-secondary" />
        <span>{token.symbol} Info</span>
        <ExternalLink size={14} class="text-kong-text-secondary ml-auto" />
      </button>
    </div>
  </div>
{/if} 