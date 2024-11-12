<script lang="ts">
  import { fade } from 'svelte/transition';
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import Panel from './Panel.svelte';

  export let show = false;
  export let title: string;
  export let onClose: () => void;
  export let variant: "green" | "yellow" | "red" = "green";
  let width = "600px";
  let height = "80vh";

  let isMobile = false;
  let modalWidth = width;

  onMount(() => {
    if (browser) {
      const updateWidth = () => {
        const windowWidth = window.innerWidth;
        if (windowWidth <= 768) {
          const calculatedWidth = Math.max(300, Math.min(windowWidth - 50, 600));
          modalWidth = `${calculatedWidth}px`;
        } else {
          modalWidth = width;
        }
        isMobile = windowWidth <= 768;
      };
      
      updateWidth();
      window.addEventListener('resize', updateWidth);
      
      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }
  });
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="modal-overlay" 
    on:click={onClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    transition:fade={{ duration: 200 }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="modal-container"
      on:click|stopPropagation
    >
      <Panel 
        {variant}
        width={modalWidth}
        {height}
        className="modal-panel"
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 id="modal-title" class="modal-title">{title}</h2>
            <button 
              class="action-button close-button !border-0 !shadow-none group relative"
              on:click={onClose}
              aria-label="Close modal"
            >
              <span class="tooltip">Close</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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

          <div class="modal-body">
            <slot />
          </div>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .modal-container {
    position: relative;
    transform: translateY(0);
    animation: modalSlideIn 200ms ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-content {
    padding: 1.5rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .modal-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 1.875rem;
    font-weight: bold;
    color: #ffcd1f;
    margin: 0;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .action-button {
    border: 1px solid var(--sidebar-border);
    padding: 6px;
    border-radius: 4px;
    color: white;
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

  .close-button {
    background: rgba(186, 49, 49, 0.4);
    color: #ffffff;
  }

  .close-button:hover {
    background: rgba(255, 68, 68, 0.5);
    transform: translateY(-1px);
  }

  .tooltip {
    pointer-events: none;
    position: absolute;
    top: -2rem;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background: #1f2937;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .tooltip::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -0.375rem;
    transform: translateX(-50%) rotate(180deg);
    border: 0.25rem solid transparent;
    border-bottom-color: #1f2937;
  }

  .action-button:hover .tooltip {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .modal-content {
      padding: 1rem;
    }

    .modal-title {
      font-size: 1.5rem;
    }
  }
</style>
