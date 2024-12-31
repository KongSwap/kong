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
  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let title: string | HTMLElement = '';
  export let variant: "solid" | "transparent" = "solid";
  export let width = "600px";
  export let height = "80vh";
  export let minHeight: string = "auto";
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
        modalHeight = isMobile ? "90vh" : height;
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
  {#if isOpen}
    <div
      class="modal-overlay"
      on:click={handleBackdropClick}
      transition:fade={{ duration: 200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      on:introend={handleTransitionEnd}
    >
      <div
        bind:this={modalElement}
        class="modal-container"
        style="width: {modalWidth}; height: {modalHeight};"
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
          className="!py-0 {className}"
        >
          <div class="modal-content" style="height: {height}; min-height: {minHeight};">
            {#if loading}
              <div class="loading-overlay">
                <div class="spinner"></div>
              </div>
            {/if}
            <div 
              class="drag-handle" 
              style="touch-action: pan-x;" 
              on:mousedown={handleDragStart}
              on:mousemove={handleDragMove}
              on:mouseup={handleDragEnd}
              on:mouseleave={handleDragEnd}
              on:touchstart={handleDragStart}
              on:touchmove={handleDragMove}
              on:touchend={handleDragEnd}
            >
              <!-- Place your "pull-down" bar or similar here -->
            </div>

            <header class="flex justify-between items-center px-4">
              <slot name="title">
                {#if typeof title === 'string'}
                  <h2 class="text-lg font-semibold py-4">{title}</h2>
                {:else}
                  <div bind:this={titleElement}></div>
                {/if}
              </slot>
              <button
                class="action-button !flex !justify-end hover:text-kong-accent-red !border-0 !shadow-none group relative"
                on:click={handleClose}
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="#ff4444"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </header>

            <div class="modal-body flex flex-col">
              <slot />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  {/if}
</Portal>

<style scoped>
  .modal-overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 99999;
    display: grid;
    place-items: center;
    will-change: opacity;
  }

  .modal-container {
    position: relative;
    will-change: transform;
    max-width: 100%;
    max-height: 100%;
    touch-action: pan-x;
  }

  .modal-content {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    min-height: var(--min-height, auto);
  }

  .modal-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: var(--kong-primary) transparent;
    margin: 0rem;
    padding: 0rem;
    min-height: 100%;
  }

  .action-button {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .modal-overlay {
      padding: 0.4rem;
    }


    .modal-container {
      cursor: grab;
      user-select: none;
    }

    .modal-container:active {
      cursor: grabbing;
    }
  }
</style>
