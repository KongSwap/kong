<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { fade, scale, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
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
  
  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      event.stopPropagation();
      onClose();
    }
  }

  $: if (modalElement) {
    if (prevWidth !== width || prevHeight !== height) {
      modalElement.style.transition = "width 0.3s ease, height 0.3s ease, max-height 0.3s ease";
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
      transition:fade={{ duration: 200 }}
      class:blur={blurBackground}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        bind:this={modalElement}
        class="modal-container"
        class:mobile-fullscreen={mobileFullscreen}
        on:click|stopPropagation
        transition:scale={{
          duration: 250,
          start: 0.95,
          opacity: 0,
          easing: cubicOut,
        }}
        style="width: {width}; max-height: {height};"
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 id="modal-title" class="modal-title">{title}</h2>
            {#if showCloseButton}
              <button
                class="close-button"
                on:click={onClose}
                aria-label="Close modal"
                transition:scale={{
                  duration: 150,
                  start: 0.8,
                  opacity: 0,
                  easing: cubicOut
                }}
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
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: calc(85vh - 3rem);
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    border-bottom: 1px solid #2a2d3d;
    background: #15161c;
    transition: padding 0.3s ease;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
    transition: font-size 0.3s ease;
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
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .close-button:hover {
    background: #3a3e52;
    transform: translateY(-1px);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.25rem;
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
    transition: padding 0.3s ease;
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
      border-radius: 0;
      width: 100% !important;
      height: 100vh !important;
      max-height: 100vh !important;
      border: none;
    }

    .mobile-fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
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

    .modal-container {
      animation: slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
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
