<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import Panel from './Panel.svelte';

  export let show = false;
  export let title: string;
  export let onClose: () => void;
  export let variant: "green" | "yellow" | "red" = "green";
  export let width = "600px";
  export let height = "80vh";

  let isMobile = false;
  let modalWidth = width;
  let modalHeight = height;

  onMount(() => {
    if (browser) {
      const updateDimensions = () => {
        const windowWidth = window.innerWidth;
        if (windowWidth <= 768) {
          const calculatedWidth = Math.max(300, Math.min(windowWidth - 25, 600));
          modalWidth = `${calculatedWidth}px`;
          modalHeight = "90vh";
        } else {
          modalWidth = width;
          modalHeight = height;
        }
        isMobile = windowWidth <= 768;
      };
      
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      
      return () => {
        window.removeEventListener('resize', updateDimensions);
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
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="modal-container"
      on:click|stopPropagation
    >
      <Panel 
        variant={variant === "red" ? "blue" : variant}
        width={modalWidth}
        height={modalHeight}
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
    z-index: 9999;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .modal-container {
    position: relative;
  }

  .modal-content {
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
    font-family: 'Alumni Sans', sans-serif;
    font-size: 2rem;
    font-weight: 500;
    color: white;
    margin: 0;
    letter-spacing: 0.02em;
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

  @media (max-width: 768px) {
    .modal-content {
      padding: 0.5rem;
    }

    .modal-title {
      font-size: 1.75rem;
    }
  }
</style>
