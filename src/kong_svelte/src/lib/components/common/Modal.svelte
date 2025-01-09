<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import Panel from "./Panel.svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import Portal from "svelte-portal";
  import Toast from "./Toast.svelte";
  import { createEventDispatcher } from 'svelte';
  import { tick } from 'svelte';
  import { X } from "lucide-svelte";
  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let title: string | HTMLElement = '';
  export let variant: "solid" | "transparent" = "solid";
  export let width = "600px";
  export let height = "auto";
  export let minHeight = "auto";
  export let onClose: () => void = () => {};
  export let loading = false;
  export let closeOnEscape = true;
  export let closeOnClickOutside = true;
  export let className: string = "";

  let isMobile = false;
  let modalWidth = width;
  let modalHeight = height;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let modalElement: HTMLDivElement;
  let titleElement: HTMLElement;
  const SLIDE_THRESHOLD = 100; // pixels to trigger close

  onMount(() => {
    if (browser) {
      const updateDimensions = () => {
        isMobile = window.innerWidth <= 768;
        modalWidth = isMobile ? "100%" : width;
        modalHeight = isMobile ? "auto" : height;
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  });

  function handleDragStart(event: MouseEvent | TouchEvent) {
    // Only enable dragging on mobile
    if (!isMobile) return;

    isDragging = true;
    startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    currentX = 0;
    modalElement.style.transition = 'none';
  }

  function handleDragMove(event: MouseEvent | TouchEvent) {
    // Only enable dragging on mobile
    if (!isMobile || !isDragging) return;
    
    const x = 'touches' in event ? event.touches[0].clientX : event.clientX;
    currentX = x - startX;
    
    // Apply transform with some resistance
    const resistance = 0.5;
    modalElement.style.transform = `translateX(${currentX * resistance}px)`;
  }

  function handleDragEnd() {
    // Only enable dragging on mobile
    if (!isMobile || !isDragging) return;
    
    isDragging = false;
    modalElement.style.transition = 'transform 0.3s ease-out';
    
    if (Math.abs(currentX) > SLIDE_THRESHOLD) {
      // Slide out completely before closing
      modalElement.style.transform = `translateX(${Math.sign(currentX) * window.innerWidth}px)`;
      setTimeout(handleClose, 300);
    } else {
      // Spring back to original position
      modalElement.style.transform = 'translateX(0)';
    }
  }

  function handleClose() {
    onClose();
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && closeOnClickOutside) {
      handleClose();
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && closeOnEscape) {
      handleClose();
    }
  }

  function handleTransitionEnd(event: CustomEvent) {
    if (isOpen) {
      dispatch('introend');
    }
  }

  $: if (isOpen && title && typeof title === 'string' && title.includes('<')) {
    tick().then(() => {
      if (titleElement) {
        titleElement.innerHTML = title;
      }
    });
  }
</script>

<svelte:window on:keydown={handleEscape} />
<Portal target="#portal-target">
  <Toast />
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] grid place-items-center will-change-opacity"
      on:click={handleBackdropClick}
      transition:fade={{ duration: 200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      on:introend={handleTransitionEnd}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={modalElement}
        class="relative will-change-transform max-w-full px-1 max-h-[calc(100vh-40px)] flex flex-col overflow-hidden"
        style="width: {modalWidth};"
        on:mousedown={handleDragStart}
        on:mousemove={handleDragMove}
        on:mouseup={handleDragEnd}
        on:mouseleave={handleDragEnd}
        on:touchstart={handleDragStart}
        on:touchmove={handleDragMove}
        on:touchend={handleDragEnd}
        transition:scale={{
          duration: 200,
          start: 0.95,
          opacity: 0,
          easing: cubicOut,
        }}
      >
        <Panel
          variant={variant}
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
            
            <div class="drag-handle touch-pan-x">
            </div>

            <header class="flex justify-between items-center flex-shrink-0 pt-3 pb-4 px-2">
              <slot name="title">
                {#if typeof title === 'string'}
                  <h2 class="text-lg font-semibold">{title}</h2>
                {:else}
                  <div class="text-lg font-semibold" bind:this={titleElement}></div>
                {/if}
              </slot>
              <button
                class="action-button !flex !justify-end hover:text-kong-accent-red !border-0 !shadow-none group relative"
                on:click={handleClose}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

            <div class="flex-1 overflow-y-auto scrollbar-custom min-h-0 pb-6 px-2">
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
    flex-shrink: 0;
  }

  :global(.modal-content) {
    max-height: inherit;
    height: 100%;
  }
</style>
