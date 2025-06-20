<script lang="ts">
  import { browser } from "$app/environment";
  import Panel from "./Panel.svelte";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import Portal from "svelte-portal";
  import Toast from "./Toast.svelte";
  import { tick } from "svelte";
  import { X } from "lucide-svelte";
  import { modalStack } from "$lib/stores/modalStore";
  import { transparentPanel, panelRoundness } from "$lib/stores/derivedThemeStore";
  import { app } from "$lib/state/app.state.svelte";

  // Props
  let {
    isOpen = $bindable(),
    modalKey = Math.random().toString(36).substr(2, 9),
    title = "",
    variant = transparentPanel ? "transparent" : "solid",
    width = "600px",
    height = "auto",
    minHeight = "auto",
    onClose = () => {},
    loading = false,
    closeOnEscape = true,
    closeOnClickOutside = true,
    className = "",
    isPadded = false,
    target = "#portal-target"
  } = $props<{
    isOpen?: boolean;
    modalKey?: string;
    title?: string | HTMLElement;
    variant?: "solid" | "transparent";
    width?: string;
    height?: string;
    minHeight?: string;
    onClose?: () => void;
    loading?: boolean;
    closeOnEscape?: boolean;
    closeOnClickOutside?: boolean;
    className?: string;
    isPadded?: boolean;
    target?: string;
  }>();

  // State
  let isMobile = $derived(app.isMobile);
  let modalWidth = $state(width);
  let modalHeight = $state(height);
  let startX = $state(0);
  let currentX = $state(0);
  let isDragging = $state(false);
  let modalElement: HTMLDivElement = $state(null);
  let zIndex = $state(100010);
  
  const SLIDE_THRESHOLD = 100; // pixels to trigger close

  // Update modal stack when isOpen changes
  $effect(() => {
    if (isOpen) {
      modalStack.update((stack) => ({
        ...stack,
        [modalKey]: { active: true, timestamp: Date.now() }
      }));
    } else {
      modalStack.update((stack) => {
        const { [modalKey]: _, ...rest } = stack;
        return rest;
      });
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

  // Setup mobile responsiveness
  $effect(() => {
    if (browser) {
        modalWidth = isMobile ? "100%" : width;
        modalHeight = height;
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
        class="fixed inset-0 bg-black/60 backdrop-blur-md"
        onclick={handleBackdropClick}
        style="z-index: {zIndex};"
        transition:fade={{ duration: 120, easing: cubicOut }}
      ></div>

      <div
        bind:this={modalElement}
        class="relative px-4 will-change-transform max-w-full max-h-screen md:max-h-[calc(100vh-40px)] flex flex-col overflow-hidden"
        style="width: {modalWidth}; z-index: {zIndex + 1};"
        onmousedown={handleDragStart}
        onmousemove={handleDragMove}
        onmouseup={handleDragEnd}
        onmouseleave={handleDragEnd}
        ontouchstart={handleDragStart}
        ontouchmove={handleDragMove}
        ontouchend={handleDragEnd}
        onclick={(e) => e.stopPropagation()}
        transition:fade={{ duration: 150, delay: 100, easing: cubicOut }}
      >
        <Panel
          width="100%"
          height={modalHeight}
          className="flex flex-col overflow-hidden !{$panelRoundness} {className} {isPadded ? 'px-4' : ''}"
          zIndex={undefined}
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
              <!-- Title can be provided via slot or prop -->
              <div class="flex-grow">
                <slot name="title">
                  <h2 class="text-lg font-semibold modal-title">
                    {#if typeof title === "string" && !title.includes("<")}
                      {title}
                    {/if}
                  </h2>
                </slot>
              </div>
              <button
                class="!flex !items-center hover:text-kong-error !border-0 !shadow-none group relative"
                onclick={(e) => handleClose(e)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

        
            <div
              class="flex-1 overflow-y-auto scrollbar-custom min-h-0 {className}"
            >
              <slot></slot>
            </div>
          </div>
        </Panel>
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
