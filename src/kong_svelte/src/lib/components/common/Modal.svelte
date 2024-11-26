<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import Portal from "svelte-portal";

  export let isOpen = false;
  export let title: string;
  export let onClose: () => void;
  export let width = "min(800px, 95vw)";
  export let height = "min(85vh, 95vh)";
  export let showCloseButton = true;
  export let blurBackground = false;
  export let mobileFullscreen = true;

  let modalElement: HTMLElement;
  let prevWidth = width;
  let prevHeight = height;
  let touchStart = 0;
  let touchStartX = 0;
  let initialTranslate = 0;
  let currentTranslate = 0;
  let isDragging = false;

  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      event.stopPropagation();
      onClose();
    }
  }

  function handleTouchStart(e: TouchEvent) {
    touchStart = e.touches[0].clientX;
    touchStartX = e.touches[0].clientX;
    isDragging = true;
    initialTranslate = currentTranslate;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart;
    
    // Only allow right swipe
    if (diff < 0) return;
    
    currentTranslate = initialTranslate + diff;
    
    // Apply the transform
    if (modalElement) {
      modalElement.style.transform = `translateX(${currentTranslate}px)`;
      modalElement.style.opacity = `${1 - (currentTranslate / window.innerWidth)}`;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    const swipeThreshold = window.innerWidth * 0.3; // 30% of screen width
    
    if (currentTranslate >= swipeThreshold) {
      onClose();
    } else {
      // Reset position
      currentTranslate = 0;
      if (modalElement) {
        modalElement.style.transform = '';
        modalElement.style.opacity = '1';
      }
    }
  }

  $: if (modalElement) {
    if (prevWidth !== width || prevHeight !== height) {
      modalElement.style.width = width;
      modalElement.style.maxHeight = height;
      prevWidth = width;
      prevHeight = height;
    }
  }
</script>

<svelte:window on:keydown={handleEscape} />

<Portal target="#portal-target">
  {#if isOpen}
    <div
      class="modal-backdrop"
      on:click={handleBackdropClick}
      class:blur={blurBackground}
      role="dialog"
      aria-modal="true"
    >
      <div
        bind:this={modalElement}
        class="modal-container"
        class:mobile-fullscreen={mobileFullscreen}
        on:click|stopPropagation
        on:touchstart|passive={handleTouchStart}
        on:touchmove|passive={handleTouchMove}
        on:touchend={handleTouchEnd}
        on:touchcancel={handleTouchEnd}
        style={`width: ${width}; max-height: ${height};`}
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 id="modal-title" class="modal-title">{title}</h2>
            {#if showCloseButton}
              <button
                class="close-button"
                on:click={onClose}
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            {/if}
          </header>

          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </div>
  {/if}
</Portal>

<style lang="postcss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .modal-container {
    position: relative;
    background: #1a1b23;
    border: 1px solid #2a2d3d;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    touch-action: pan-x;
    will-change: transform;
    transition: transform 0.2s ease-out, opacity 0.2s ease-out;
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: calc(85vh - 3rem);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    border-bottom: 1px solid #2a2d3d;
    background: #15161c;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #2a2d3d;
    border: none;
    border-radius: 6px;
    color: #ffffff;
  }

  .close-button:hover {
    background: #3a3e52;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.25rem;
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
  }

  .modal-body::-webkit-scrollbar {
    width: 6px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: #15161c;
    border-radius: 3px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background-color: #2a2d3d;
    border-radius: 3px;
  }

  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal-container {
      width: 100% !important;
      height: 100vh !important;
      max-height: 100vh !important;
      border: none;
    }

    .mobile-fullscreen {
      position: fixed;
      inset: 0;
      border-radius: 0;
    }

    .modal-content {
      height: 100vh;
      max-height: 100vh;
    }

    .modal-header {
      padding: 1rem;
      padding-top: max(1rem, env(safe-area-inset-top));
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .modal-body {
      padding: 1rem;
      padding-bottom: max(1rem, env(safe-area-inset-bottom));
      height: calc(100vh - var(--header-height, 60px));
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .modal-title {
      font-size: 1.1rem;
    }

    .close-button {
      width: 28px;
      height: 28px;
    }
  }

  @media (max-width: 480px) {
    .modal-backdrop {
      padding: 0;
    }
  }

  @supports (padding-top: env(safe-area-inset-top)) {
    .modal-container {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
  }
</style>
