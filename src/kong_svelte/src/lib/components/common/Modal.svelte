<script lang="ts">
  import { browser } from "$app/environment";
  import Card from "./Card.svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut, quartOut } from "svelte/easing";
  import Portal from "svelte-portal";
  import Toast from "./Toast.svelte";
  import { tick } from "svelte";
  import { X } from "lucide-svelte";
  import { modalStack } from "$lib/stores/modalStore";
  import { app } from "$lib/state/app.state.svelte";

  // Enhanced Props with better defaults and types
  let {
    children,
    titleSlot,
    isOpen = $bindable(),
    modalKey = Math.random().toString(36).substring(2, 9),
    title = "",
    width = "600px",
    height = "auto",
    minHeight = "auto",
    maxWidth = "90vw",
    maxHeight = "90vh",
    onClose = () => {},
    onOpen = () => {},
    loading = false,
    closeOnEscape = true,
    closeOnClickOutside = true,
    className = "",
    isPadded = false,
    target = "#portal-target",
    zIndexOverride,
    blurStrength = "md",
    animationDuration = 200,
    showCloseButton = true,
    preventScrollLock = false
  } = $props<{
    children?: () => any;
    titleSlot?: () => any;
    isOpen?: boolean;
    modalKey?: string;
    title?: string | HTMLElement;
    width?: string;
    height?: string;
    minHeight?: string;
    maxWidth?: string;
    maxHeight?: string;
    onClose?: () => void;
    onOpen?: () => void;
    loading?: boolean;
    closeOnEscape?: boolean;
    closeOnClickOutside?: boolean;
    className?: string;
    isPadded?: boolean;
    target?: string;
    zIndexOverride?: number;
    blurStrength?: 'sm' | 'md' | 'lg' | 'xl';
    animationDuration?: number;
    showCloseButton?: boolean;
    preventScrollLock?: boolean;
  }>();

  // Enhanced State Management
  let isMobile = $derived(app.isMobile);
  let modalWidth = $state(width);
  let modalHeight = $state(height);
  let startX = $state(0);
  let currentX = $state(0);
  let isDragging = $state(false);
  let modalElement: HTMLDivElement = $state(null);
  let zIndex = $state(zIndexOverride || 100010);
  let wasOpen = $state(false);
  
  const SLIDE_THRESHOLD = 100; // pixels to trigger close
  
  // Computed values for better performance
  const backdropClass = $derived(`backdrop-blur-${blurStrength}`);
  const responsiveWidth = $derived(isMobile ? "100%" : width);
  const responsiveHeight = $derived(height);
  const computedZIndex = $derived(zIndexOverride || zIndex);

  // Enhanced modal lifecycle management
  $effect(() => {
    if (isOpen && !wasOpen) {
      // Modal opening
      wasOpen = true;
      onOpen();
      
      modalStack.update((stack) => ({
        ...stack,
        [modalKey]: { active: true, timestamp: Date.now() }
      }));

      // Scroll lock management
      if (browser && !preventScrollLock) {
        document.body.style.overflow = 'hidden';
      }
    } else if (!isOpen && wasOpen) {
      // Modal closing
      wasOpen = false;
      
      modalStack.update((stack) => {
        const { [modalKey]: _, ...rest } = stack;
        return rest;
      });

      // Release scroll lock if no other modals are open
      if (browser && !preventScrollLock) {
        setTimeout(() => {
          const remainingModals = Object.keys($modalStack).length;
          if (remainingModals === 0) {
            document.body.style.overflow = '';
          }
        }, animationDuration);
      }
    }
  });

  // Subscribe to modalStack to update zIndex
  $effect(() => {
    const unsubscribe = modalStack.subscribe((stack) => {
      const modalEntries = Object.entries(stack);
      if (modalEntries.length === 0) return;

      // Sort modals by timestamp in descending order (newest first)
      modalEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      // Find position of current modal
      const currentIndex = modalEntries.findIndex(([key]) => key === modalKey);
      if (currentIndex !== -1) {
        // Base z-index is 100010, each modal adds 10 to ensure proper stacking
        zIndex = 100010 + (currentIndex * 10);
      }
    });

    return unsubscribe;
  });

  // Enhanced responsive design
  $effect(() => {
    if (browser) {
      modalWidth = responsiveWidth;
      modalHeight = responsiveHeight;
    }
  });

  // Handle HTML title when title is HTML string
  $effect(() => {
    if (isOpen && title && typeof title === "string" && title.includes("<")) {
      tick().then(() => {
        const titleElements = document.querySelectorAll('.modal-title');
        titleElements.forEach(element => {
          if (element) {
            element.innerHTML = title;
          }
        });
      });
    }
  });

  // Cleanup when component is destroyed
  $effect(() => {
    return () => {
      // Clean up modal stack
      modalStack.update((stack) => {
        const { [modalKey]: _, ...rest } = stack;
        return rest;
      });

      // Reset state variables
      isDragging = false;
      currentX = 0;
    };
  });

  function handleDragStart(event: MouseEvent | TouchEvent) {
    // Only enable dragging on mobile
    if (!isMobile) return;

    isDragging = true;
    startX = "touches" in event ? event.touches[0].clientX : event.clientX;
    currentX = 0;
    modalElement.style.transition = "none";
  }

  function handleDragMove(event: MouseEvent | TouchEvent) {
    // Only enable dragging on mobile
    if (!isMobile || !isDragging) return;

    const x = "touches" in event ? event.touches[0].clientX : event.clientX;
    currentX = x - startX;

    // Apply transform with some resistance
    const resistance = 0.5;
    modalElement.style.transform = `translateX(${currentX * resistance}px)`;
  }

  function handleDragEnd() {
    // Only enable dragging on mobile
    if (!isMobile || !isDragging) return;

    isDragging = false;
    modalElement.style.transition = "transform 0.3s ease-out";

    if (Math.abs(currentX) > SLIDE_THRESHOLD) {
      // Slide out completely before closing
      modalElement.style.transform = `translateX(${Math.sign(currentX) * window.innerWidth}px)`;
      setTimeout(handleClose, 300);
    } else {
      // Spring back to original position
      modalElement.style.transform = "translateX(0)";
    }
  }

  function handleClose(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    modalStack.update((stack) => {
      const { [modalKey]: _, ...rest } = stack;
      return rest;
    });
    isOpen = false;
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    event.stopPropagation();
    if (event.target === event.currentTarget && closeOnClickOutside) {
      handleClose();
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && closeOnEscape) {
      // Get all modals and sort by timestamp
      const modalEntries = Object.entries($modalStack);
      if (modalEntries.length === 0) return;
      
      // Sort modals by timestamp in descending order (newest first)
      modalEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      // Only close if this is the topmost modal
      if (modalEntries[0][0] === modalKey) {
        handleClose();
      }
    }
  }
</script>

<svelte:window on:keydown={handleEscape} />
<Portal target={target}>
  <Toast />
  {#if isOpen}
    <div
      class="fixed inset-0 grid place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style="z-index: {zIndex};"
    >
      <div
        class="fixed inset-0 bg-black/60 {backdropClass}"
        onclick={handleBackdropClick}
        style="z-index: {computedZIndex};"
        transition:fade={{ duration: animationDuration, easing: cubicOut }}
      ></div>

      <div
        bind:this={modalElement}
        class="relative px-4 will-change-transform flex flex-col overflow-hidden"
        style="width: {modalWidth}; max-width: {maxWidth}; max-height: {maxHeight}; z-index: {computedZIndex + 1};"
        onmousedown={handleDragStart}
        onmousemove={handleDragMove}
        onmouseup={handleDragEnd}
        onmouseleave={handleDragEnd}
        ontouchstart={handleDragStart}
        ontouchmove={handleDragMove}
        ontouchend={handleDragEnd}
        onclick={(e) => e.stopPropagation()}
        transition:scale={{ 
          duration: animationDuration, 
          delay: 50, 
          easing: quartOut,
          start: 0.9
        }}
      >
        <Card
          className="flex flex-col overflow-hidden {className} {isPadded ? 'p-4' : ''} bg-kong-bg-primary"
          hasHeader={false}
        >
          <div
            class="modal-content flex flex-col overflow-hidden"
            style="min-height: {minHeight}; max-height: {modalHeight !== 'auto' ? modalHeight : 'none'};"
          >
            {#if loading}
              <div class="loading-overlay">
                <div class="spinner"></div>
              </div>
            {/if}

            <div class="drag-handle touch-pan-x"></div>

            <header
              class="flex justify-between items-center flex-shrink-0 pb-2"
            >
              <!-- Title can be provided via snippet or prop -->
              <div class="flex-grow">
                {#if titleSlot}
                  {@render titleSlot()}
                {:else}
                  <h2 class="text-lg font-semibold modal-title">
                    {#if typeof title === "string" && !title.includes("<")}
                      {title}
                    {/if}
                  </h2>
                {/if}
              </div>
              {#if showCloseButton}
                <button
                  class="!flex !items-center hover:text-kong-error !border-0 !shadow-none group relative transition-colors duration-200"
                  onclick={(e) => handleClose(e)}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              {/if}
            </header>

        
            <div
              class="flex-1 overflow-y-auto scrollbar-custom min-h-0 {className}"
            >
              {@render children?.()}
            </div>
          </div>
        </Card>
      </div>
    </div>
  {/if}
</Portal>

<style scoped>
  .action-button {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    width: 40px;
  }
</style>
