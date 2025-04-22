<script lang="ts">
  import { browser } from "$app/environment";
  import Portal from "svelte-portal";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X } from "lucide-svelte";
  import { modalStack } from "$lib/stores/modalStore";
  import Panel from "./Panel.svelte";
  import Toast from "./Toast.svelte";
  import { tick } from "svelte";
  
  // Props - standalone fullscreen modal props
  const {
    isOpen = false,
    modalKey = Math.random().toString(36).substr(2, 9),
    title = "",
    onClose = () => {},
    loading = false,
    closeOnEscape = true,
    closeOnClickOutside = true,
    className = "",
    variant = "solid",
    target = "#portal-target"
  } = $props<{
    isOpen?: boolean;
    modalKey?: string;
    title?: string | HTMLElement;
    onClose?: () => void;
    loading?: boolean;
    closeOnEscape?: boolean;
    closeOnClickOutside?: boolean;
    className?: string;
    variant?: "solid" | "transparent";
    target?: string;
  }>();

  // State
  let isMobile = $state(false);
  let zIndex = $state(99999);
  let modalElement: HTMLDivElement;

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
        // Base z-index is 99999, each modal adds 10 to ensure proper stacking
        zIndex = 99999 + (currentIndex * 10);
      }
    });

    return unsubscribe;
  });

  // Setup mobile responsiveness
  $effect(() => {
    if (browser) {
      const updateDimensions = () => {
        isMobile = window.innerWidth <= 768;
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => {
        window.removeEventListener("resize", updateDimensions);
      };
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
    };
  });

  function handleClose(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    modalStack.update((stack) => {
      const { [modalKey]: _, ...rest } = stack;
      return rest;
    });
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

<Portal {target}>
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
        on:click={handleBackdropClick}
        style="z-index: {zIndex};"
        transition:fade={{ duration: 120, easing: cubicOut }}
      />

      <div
        bind:this={modalElement}
        class="relative will-change-transform w-full h-full max-w-full flex flex-col overflow-hidden"
        style="z-index: {zIndex + 1};"
        on:click|stopPropagation
        transition:fade={{ duration: 150, delay: 100, easing: cubicOut }}
      >
        <Panel
          variant={variant}
          width="100%"
          height="100%"
          className="flex flex-col overflow-hidden fullscreen-modal {className}"
        >
          <div class="fullscreen-content h-full flex flex-col overflow-hidden">
            {#if loading}
              <div class="loading-overlay">
                <div class="spinner"></div>
              </div>
            {/if}

            <header class="modal-header px-6 py-4 border-b border-kong-border flex items-center justify-between">
              <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-kong-text-primary modal-title">
                  {#if typeof title === "string" && !title.includes("<")}
                    {title}
                  {/if}
                </h1>
                <slot name="header-actions"></slot>
              </div>
              
              <div class="flex items-center gap-4">
                <slot name="header-right"></slot>
                <button
                  class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-kong-bg-light/20 transition-colors"
                  on:click={handleClose}
                  aria-label="Close modal"
                >
                  <X size={20} class="text-kong-text-secondary hover:text-kong-accent-red transition-colors" />
                </button>
              </div>
            </header>
            
            <div class="modal-body flex-1 overflow-auto">
              <slot></slot>
            </div>
            
            <slot name="footer"></slot>
          </div>
        </Panel>
      </div>
    </div>
  {/if}
</Portal>

<style lang="postcss">
  :global(.fullscreen-modal) {
    height: 100vh !important; 
    max-height: 100vh !important;
    width: 100vw !important;
    max-width: 100vw !important;
    margin: 0 !important;
  }
  
  .modal-header {
    background-color: rgba(var(--bg-dark), 0.7);
    backdrop-filter: blur(10px);
    z-index: 10;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  /* Ensure proper scrolling */
  .fullscreen-content {
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--primary), 0.5) rgba(var(--bg-dark), 0.2);
  }
  
  .modal-body {
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--primary), 0.5) rgba(var(--bg-dark), 0.2);
  }
  
  .modal-body::-webkit-scrollbar {
    width: 6px;
  }
  
  .modal-body::-webkit-scrollbar-track {
    background: rgba(var(--bg-dark), 0.2);
    border-radius: 3px;
  }
  
  .modal-body::-webkit-scrollbar-thumb {
    background-color: rgba(var(--primary), 0.5);
    border-radius: 3px;
  }
  
  /* Loading overlay */
  .loading-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(var(--bg-dark), 0.7);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(var(--primary), 0.3);
    border-radius: 50%;
    border-top-color: rgb(var(--primary));
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style> 