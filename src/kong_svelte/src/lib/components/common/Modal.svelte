<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Panel from "./Panel.svelte";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import Portal from "svelte-portal";
  import Toast from "./Toast.svelte";
  import { createEventDispatcher } from "svelte";
  import { tick } from "svelte";
  import { X } from "lucide-svelte";
  import { writable } from "svelte/store";
  import { modalStack } from "$lib/stores/modalStore";

  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let modalKey = Math.random().toString(36).substr(2, 9);
  export let title: string | HTMLElement = "";
  export let variant: "solid" | "transparent" = "solid";
  export let width = "600px";
  export let height = "auto";
  export let minHeight = "auto";
  export let onClose: () => void = () => {};
  export let loading = false;
  export let closeOnEscape = true;
  export let closeOnClickOutside = true;
  export let className: string = "";
  export let isPadded = false;
  export let target: string = "#portal-target";
  let isMobile = false;
  let modalWidth = width;
  let modalHeight = height;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let modalElement: HTMLDivElement;
  let titleElement: HTMLElement;
  const SLIDE_THRESHOLD = 100; // pixels to trigger close
  let zIndex = 99999;

  // Watch isOpen changes to handle transitions
  $: {
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
  }

  // Subscribe to modalStack to update zIndex
  const unsubscribe = modalStack.subscribe((stack) => {
    const modalEntries = Object.entries(stack);
    if (modalEntries.length === 0) return;

    // Sort modals by timestamp in descending order (newest first)
    modalEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // Find position of current modal
    const currentIndex = modalEntries.findIndex(([key]) => key === modalKey);
    if (currentIndex !== -1) {
      // Base z-index is 99999, each modal adds 10 to ensure proper stacking
      zIndex = 99999 + (currentIndex * 10);
    }
  });

  onMount(() => {
    if (browser) {
      const updateDimensions = () => {
        isMobile = window.innerWidth <= 768;
        modalWidth = isMobile ? "100%" : width;
        modalHeight = isMobile ? "auto" : height;
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => {
        window.removeEventListener("resize", updateDimensions);
        // Clean up any remaining transforms/transitions
        if (modalElement) {
          modalElement.style.transform = "";
          modalElement.style.transition = "";
        }
      };
    }
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
    dispatch("close");
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

  $: if (isOpen && title && typeof title === "string" && title.includes("<")) {
    tick().then(() => {
      if (titleElement) {
        titleElement.innerHTML = title;
      }
    });
  }

  // Improve cleanup in onDestroy
  onDestroy(() => {
    // Clean up modal stack
    modalStack.update((stack) => {
      const { [modalKey]: _, ...rest } = stack;
      return rest;
    });

    // Clean up subscription
    unsubscribe();

    // Reset state variables
    isDragging = false;
    currentX = 0;
  });
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
      transition:fade={{ duration: 150, easing: cubicOut }}
    >
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-md"
        on:click={handleBackdropClick}
      />

      <div
        bind:this={modalElement}
        class="relative will-change-transform max-w-full px-1 max-h-[calc(100vh-40px)] flex flex-col overflow-hidden"
        style="width: {modalWidth}; z-index: {zIndex + 1};"
        on:mousedown={handleDragStart}
        on:mousemove={handleDragMove}
        on:mouseup={handleDragEnd}
        on:mouseleave={handleDragEnd}
        on:touchstart={handleDragStart}
        on:touchmove={handleDragMove}
        on:touchend={handleDragEnd}
        on:click|stopPropagation
      >
        <Panel
          {variant}
          width="100%"
          height="100%"
          className="!py-0 flex flex-col overflow-hidden {className}"
        >
          <div
            class="modal-content flex flex-col overflow-hidden"
            style="min-height: {minHeight};"
          >
            {#if loading}
              <div class="loading-overlay">
                <div class="spinner"></div>
              </div>
            {/if}

            <div class="drag-handle touch-pan-x"></div>

            <header
              class="flex justify-between items-center flex-shrink-0 px-3 pb-4 pt-3"
            >
              <slot name="title">
                {#if typeof title === "string"}
                  <h2 class="text-lg font-semibold">{title}</h2>
                {:else}
                  <div
                    class="text-lg font-semibold"
                    bind:this={titleElement}
                  ></div>
                {/if}
              </slot>
              <button
                class="pt-2 pb-1 !flex !items-center !justify-end hover:text-kong-accent-red !border-0 !shadow-none group relative"
                on:click={(e) => handleClose(e)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

        
            <div
              class="flex-1 overflow-y-auto scrollbar-custom min-h-0 {className}"
            >
              <slot />
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

  :global(.modal-content) {
    max-height: inherit;
    height: 100%;
  }

  :global(#portal-target) {
    position: relative;
    isolation: isolate;
  }
</style>
