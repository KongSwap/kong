<script lang="ts">
  import { tick } from 'svelte';

  // Props
  let {
    position = 'bottom-right',
    open = $bindable(false),
    triggerClass = '',
    contentClass = '',
    width = 'w-full',
    itemClass = '',
    // Add overflow-y-auto back to default style
    contentStyle = 'bg-kong-bg-primary rounded-b-lg shadow-xl border border-white/10 border-t-0 overflow-y-auto',
    itemStyle = 'px-4 py-3 text-left hover:bg-kong-bg-secondary/20 hover:text-kong-primary group flex items-center gap-2 transition-colors'
  } = $props<{
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    open?: boolean;
    triggerClass?: string;
    contentClass?: string;
    width?: string;
    itemClass?: string;
    contentStyle?: string;
    itemStyle?: string;
  }>();

  // State
  let triggerRef: HTMLElement | null = $state(null);
  let contentRef: HTMLElement | null = $state(null);
  let internalOpen = $state(false);

  // Use $derived to sync internalOpen with the bindable open prop if provided
  const isOpen = $derived(open !== undefined ? open : internalOpen);

  // Event handlers
  function toggleDropdown() {
    const newState = !isOpen;
    if (open !== undefined) {
      open = newState; // Update bound prop if provided
    } else {
      internalOpen = newState; // Update internal state otherwise
    }
  }

  function closeDropdown() {
    if (isOpen) {
      if (open !== undefined) {
        open = false;
      } else {
        internalOpen = false;
      }
    }
  }

  async function handleClickOutside(event: MouseEvent) {
    await tick(); // Ensure refs are updated
    if (!isOpen || !triggerRef || !contentRef) return;
    const target = event.target as Node;
    if (!triggerRef.contains(target) && !contentRef.contains(target)) {
      closeDropdown();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      closeDropdown();
    }
  }

  // Derive position classes based on the position prop
  const positionClasses = $derived(() => {
    switch (position) {
      case 'bottom-left':
        return 'left-0 top-full mt-1';
      case 'bottom-right':
        return 'right-0 top-full mt-1';
      case 'top-left':
        return 'left-0 bottom-full mb-1';
      case 'top-right':
        return 'right-0 bottom-full mb-1';
      default:
        return 'right-0 top-full mt-1';
    }
  });

  // Effects
  $effect.root(() => {
    // Only add listeners when the dropdown *might* be open
    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleClickOutside, true); // Use capture phase
      document.addEventListener('keydown', handleKeydown);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', handleClickOutside, true);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
  });

  $effect(() => {
    // If externally controlled `open` becomes false, ensure internal state matches
    if (open === false) {
      internalOpen = false;
    }
  });
  
  // Export item styling for ease of use in parent components
  function getItemClass() {
    return itemStyle + ' ' + itemClass;
  }
</script>

<div class="relative inline-block {width}">
  <!-- Trigger element -->
  <div
    bind:this={triggerRef}
    onclick={toggleDropdown}
    class={`cursor-pointer ${triggerClass}`}
    role="button"
    aria-haspopup="true"
    aria-expanded={isOpen}
  >
    <slot name="trigger" />
  </div>

  <!-- Dropdown content -->
  {#if isOpen}
    <div
      bind:this={contentRef}
      class={`absolute z-50 h-fit ${positionClasses} ${width} ${contentStyle} ${contentClass}`}
      role="menu"
      tabindex="-1"
    >
      <slot {getItemClass} />
    </div>
  {/if}
</div> 