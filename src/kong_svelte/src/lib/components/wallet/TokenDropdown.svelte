<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    ArrowUp, 
    ArrowDown, 
    Repeat, 
    Info, 
    ExternalLink,
    ChevronRight,
    X,
    Copy,
    Droplets
  } from 'lucide-svelte';
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { toastStore } from '$lib/stores/toastStore';
  
  // Define props using the $props syntax
  type TokenDetail = {
    symbol: string;
    name: string;
    balance: string | number;
    usdValue: number;
    icon: string;
    change24h: number;
    token: Kong.Token;
  };
  
  type TokenDropdownProps = {
    token: TokenDetail;
    position?: { top: number; left: number; width: number };
    visible?: boolean;
    expanded?: boolean;
    onClose?: (e?: MouseEvent) => void;
    onAction?: (action: 'send' | 'receive' | 'swap' | 'info' | 'copy' | 'add_lp', token: TokenDetail) => void;
  };
  
  const { 
    token,
    position = { top: 0, left: 0, width: 0 },
    visible = false,
    expanded = false,
    onClose = () => {},
    onAction
  } = $props();
  
  let dropdownElement: HTMLElement;
  let adjustedPosition = $state({ top: 0, left: 0, width: 240 });
  let copySuccess = $state(false);
  let lastPositionCheck = $state({ top: 0, left: 0, width: 0, viewportWidth: 0, viewportHeight: 0 });
  
  // Debounced resize handler
  function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
  
  // Check if position update is needed
  function shouldUpdatePosition() {
    if (expanded || !position || !dropdownElement) return false;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Only update if something significant has changed
    if (
      Math.abs(position.top - lastPositionCheck.top) > 5 ||
      Math.abs(position.left - lastPositionCheck.left) > 5 ||
      Math.abs(position.width - lastPositionCheck.width) > 5 ||
      Math.abs(viewportWidth - lastPositionCheck.viewportWidth) > 5 ||
      Math.abs(viewportHeight - lastPositionCheck.viewportHeight) > 5
    ) {
      lastPositionCheck = {
        top: position.top,
        left: position.left,
        width: position.width,
        viewportWidth,
        viewportHeight
      };
      return true;
    }
    
    return false;
  }
  
  // Handle positioning - only used when not expanded and visible
  function updatePosition() {
    if (expanded || !position || !dropdownElement || !shouldUpdatePosition()) return;
    
    // Use requestAnimationFrame to ensure dimensions are calculated after render
    window.requestAnimationFrame(() => {
      if (!dropdownElement) return; // Check again inside rAF
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Measure actual dropdown height
      const dropdownHeight = dropdownElement.offsetHeight;
      
      // Default width and position
      let top = position.top;
      let left = position.left;
      let width = Math.min(position.width, 320); // Cap width at 320px
      
      // Adjust width and horizontal position based on viewport
      if (viewportWidth < 480) {
        width = Math.min(viewportWidth - 40, 320); // 20px padding
        left = Math.max(20, (viewportWidth - width) / 2); // Center
      } else {
        // Ensure dropdown doesn't go off-screen right
        if (left + width > viewportWidth - 20) {
          left = Math.max(10, viewportWidth - width - 20);
        }
      }
      
      // Determine vertical placement
      const spaceBelow = viewportHeight - position.top;
      const spaceAbove = position.top;
      
      if (spaceBelow < dropdownHeight + 20 && spaceAbove > dropdownHeight + 20) {
        // Place above if not enough space below, but enough above
        top = Math.max(10, position.top - dropdownHeight - 10);
      } else if (top + dropdownHeight > viewportHeight - 10) {
        // Default placement (below) goes off-screen, adjust to fit
        top = Math.max(10, viewportHeight - dropdownHeight - 10);
      } // Otherwise, default placement below the item is fine
      
      // Update position state only if it changed significantly
      if (
        Math.abs(adjustedPosition.top - top) > 2 ||
        Math.abs(adjustedPosition.left - left) > 2 ||
        Math.abs(adjustedPosition.width - width) > 2
      ) {
        adjustedPosition = { top, left, width };
      }
    });
  }
  
  // Update position effect - replaces afterUpdate
  $effect(() => {
    if (!expanded && visible && dropdownElement) {
      // Call updatePosition directly; it now handles rAF internally
      updatePosition();
    }
  });
  
  // Handle action click - optimize by using switch instead of multiple if/else
  function handleAction(action: 'send' | 'receive' | 'swap' | 'info' | 'copy' | 'add_lp') {    
    switch(action) {
      case 'copy':
        if (token.token?.address) {
          navigator.clipboard.writeText(token.token.address)
            .then(() => {
              copySuccess = true;
              
              // Show toast notification
              toastStore.info(
                `${token.symbol} canister ID copied to clipboard`, 
                { 
                  title: 'Copied!',
                  duration: 3000 
                }
              );
              
              setTimeout(() => {
                copySuccess = false;
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy canister ID:', err);
              toastStore.error('Failed to copy canister ID to clipboard');
            });
        }
        break;
      case 'receive':
      case 'send':
      case 'add_lp':
        // Don't close dropdown for send, receive, and add_lp
        if (onAction) {
          onAction(action, token);
        }
        break;
      default:
        if (onAction) {
          onAction(action, token);
        }
        onClose();
        break;
    }
  }
  
  // Handle click outside to close dropdown - only for floating version
  function handleClickOutside(event: MouseEvent) {
    if (!expanded && visible && dropdownElement && !dropdownElement.contains(event.target as Node)) {
      onClose();
    }
  }
  
  // Set up event listener for clicks outside the dropdown - only for floating version
  onMount(() => {
    if (!expanded) {
      document.addEventListener('mousedown', handleClickOutside, { passive: true });
      
      // Initial position update
      if (visible && dropdownElement) {
        updatePosition();
      }
      
      // Debounced resize handler
      const debouncedResize = debounce(() => {
        if (visible && dropdownElement) {
          updatePosition();
        }
      }, 100); // 100ms debounce
      
      window.addEventListener('resize', debouncedResize, { passive: true });
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('resize', debouncedResize);
      };
    }
  });
</script>

{#if visible}
  {#if expanded}
    <!-- Expanded row version -->
    <div 
      bind:this={dropdownElement}
      onclick={(e) => e.stopPropagation()}
      class="relative"
    >
      <!-- Action buttons in a row -->
      <div class="flex flex-wrap gap-2 justify-center">
        <button 
          class="flex-1 min-w-[80px] md:min-w-[100px] p-3 flex flex-col group items-center justify-center gap-1.5 bg-kong-bg-primary rounded-md hover:bg-kong-primary hover:text-kong-text-on-primary transition-all text-kong-text-primary hover:shadow-sm hover:transform hover:scale-105"
          onclick={() => handleAction('send')}
        >
          <ArrowUp size={16} class="text-kong-text-secondary group-hover:text-kong-text-on-primary transition-colors" />
          <span class="text-xs">Send</span>
        </button>
        
        <button 
          class="flex-1 min-w-[80px] md:min-w-[100px] p-3 flex flex-col group items-center justify-center gap-1.5 bg-kong-bg-primary rounded-md hover:bg-kong-primary hover:text-kong-text-on-primary transition-all text-kong-text-primary hover:shadow-sm hover:transform hover:scale-105"
          onclick={() => handleAction('receive')}
        >
          <ArrowDown size={16} class="text-kong-text-secondary group-hover:text-kong-text-on-primary transition-colors" />
          <span class="text-xs">Receive</span>
        </button>
        
        <button 
          class="flex-1 min-w-[80px] md:min-w-[100px] p-3 flex flex-col group items-center justify-center gap-1.5 bg-kong-bg-primary rounded-md hover:bg-kong-primary hover:text-kong-text-on-primary transition-all text-kong-text-primary hover:shadow-sm hover:transform hover:scale-105"
          onclick={() => handleAction('swap')}
        >
          <Repeat size={16} class="text-kong-text-secondary group-hover:text-kong-text-on-primary transition-colors" />
          <span class="text-xs">Swap</span>
        </button>
        
        <button 
          class="flex-1 min-w-[80px] md:min-w-[100px] p-3 flex flex-col group items-center justify-center gap-1.5 bg-kong-bg-primary rounded-md hover:bg-kong-primary hover:text-kong-text-on-primary transition-all text-kong-text-primary hover:shadow-sm hover:transform hover:scale-105"
          onclick={() => handleAction('add_lp')}
        >
          <Droplets size={16} class="text-kong-text-secondary group-hover:text-kong-text-on-primary transition-colors" />
          <span class="text-xs">Add LP</span>
        </button>
        
        <button 
          class="flex-1 min-w-[80px] md:min-w-[100px] p-3 flex flex-col group items-center justify-center gap-1.5 bg-kong-bg-primary rounded-md hover:bg-kong-primary hover:text-kong-text-on-primary transition-all text-kong-text-primary hover:shadow-sm hover:transform hover:scale-105"
          onclick={() => handleAction('info')}
        >
          <Info size={16} class="text-kong-text-secondary group-hover:text-kong-text-on-primary transition-colors" />
          <span class="text-xs">Info</span>
        </button>
        
        <button 
          class="flex-1 min-w-[80px] md:min-w-[100px] p-3 flex flex-col group items-center justify-center gap-1.5 bg-kong-bg-primary rounded-md hover:bg-kong-primary hover:text-kong-text-on-primary transition-all text-kong-text-primary hover:shadow-sm hover:transform hover:scale-105 relative"
          onclick={() => handleAction('copy')}
        >
          <Copy size={16} class={copySuccess ? "text-kong-success" : "text-kong-text-secondary group-hover:text-kong-text-on-primary transition-colors"} />
          <span class="text-xs">{copySuccess ? "Copied!" : "Copy ID"}</span>
          {#if copySuccess}
            <div class="absolute -top-2 left-0 right-0 mx-auto w-3 h-3 bg-kong-success/20 rounded-full animate-ping"></div>
          {/if}
        </button>
      </div>
    </div>
  {:else}
    <!-- Original floating dropdown -->
    <div 
      bind:this={dropdownElement}
      class="absolute z-30 bg-kong-bg-primary rounded-md border border-kong-border shadow-lg"
      style="top: {adjustedPosition.top}px; left: {adjustedPosition.left}px; width: {adjustedPosition.width}px; max-width: 320px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2);"
      in:slide={{ duration: 200, easing: quintOut }}
      out:slide={{ duration: 150, easing: quintOut }}
      onclick={(e) => e.stopPropagation()}
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
          onclick={(e) => onClose(e)}
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
          <div class="text-sm font-medium {token.change24h >= 0 ? 'text-kong-success' : 'text-kong-error'}">
            {Number(formatToNonZeroDecimal(token.change24h)) >= 0 ? "+" : ""}{formatToNonZeroDecimal(token.change24h)}%
          </div>
        </div>
        
        {#if token.token?.address}
          <div class="mt-3 pt-3 border-t border-kong-border/30">
            <div class="text-xs text-kong-text-secondary mb-1">Canister ID</div>
            <div class="flex items-center justify-between">
              <div class="text-xs text-kong-text-primary font-mono truncate max-w-[160px]">
                {token.token.address}
              </div>
              <button
                class="text-xs py-1 px-2 flex items-center gap-1 rounded-md bg-kong-primary/10 hover:bg-kong-primary hover:text-kong-text-on-primary text-kong-text-secondary transition-all"
                onclick={() => handleAction('copy')}
              >
                <Copy size={12} class={copySuccess ? "text-kong-success" : ""} />
                <span>{copySuccess ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Action buttons -->
      <div class="p-2">
        <button 
          class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-secondary/10 hover:text-kong-text-on-primary transition-all text-kong-text-primary"
          onclick={() => handleAction('send')}
        >
          <ArrowUp size={16} class="text-kong-text-secondary" />
          <span>Send {token.symbol}</span>
          <ChevronRight size={16} class="text-kong-text-secondary ml-auto" />
        </button>
        
        <button 
          class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-secondary/10 hover:text-kong-text-on-primary transition-all text-kong-text-primary"
          onclick={() => handleAction('receive')}
        >
          <ArrowDown size={16} class="text-kong-text-secondary" />
          <span>Receive {token.symbol}</span>
          <ChevronRight size={16} class="text-kong-text-secondary ml-auto" />
        </button>
        
        <button 
          class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-secondary/10 hover:text-kong-text-on-primary transition-all text-kong-text-primary"
          onclick={() => handleAction('swap')}
        >
          <Repeat size={16} class="text-kong-text-secondary" />
          <span>Swap {token.symbol}</span>
          <ChevronRight size={16} class="text-kong-text-secondary ml-auto" />
        </button>
        
        <button 
          class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-secondary/10 hover:text-kong-text-on-primary transition-all text-kong-text-primary"
          onclick={() => handleAction('add_lp')}
        >
          <Droplets size={16} class="text-kong-text-secondary" />
          <span>Add LP</span>
        </button>
        
        <button 
          class="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-md hover:bg-kong-bg-secondary/10 hover:text-kong-text-on-primary transition-all text-kong-text-primary"
          onclick={() => handleAction('info')}
        >
          <Info size={16} class="text-kong-text-secondary" />
          <span>{token.symbol} Info</span>
          <ExternalLink size={14} class="text-kong-text-secondary ml-auto" />
        </button>
      </div>
    </div>
  {/if}
{/if} 