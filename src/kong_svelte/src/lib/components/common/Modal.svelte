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
    class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 grid place-items-center overflow-hidden" 
    on:click={onClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <!-- svelte-ignore a11y_unknown_aria_attribute -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="relative"
      on:click|stopPropagation
      role="dialog"
    >
      <Panel 
        variant={variant === "red" ? "blue" : variant}
        width={modalWidth}
        height={modalHeight}
        className="modal-panel"
      >
        <div class="p-6 h-full flex flex-col">
          <header class="flex justify-between items-center mb-6">
            <h2 id="modal-title" class="font-sans text-2xl font-medium text-white m-0 tracking-wide">{title}</h2>
            <button 
              class="rounded text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease-in-out w-10 h-10 flex-shrink-0 bg-opacity-40 hover:text-rose-700 hover:stroke-2 hover:translate-y-[-1px] relative group"
              on:click={onClose}
              aria-label="Close modal"
            >
              <span class="hover:stroke-2 absolute top-[-2rem] left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white p-1 rounded text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100">Close</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="#ff4444"
                stroke="currentColor"
                stroke-width="1"
                class="hover:stroke-2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </header>

          <div class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent">
            <slot />
          </div>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  @media (max-width: 768px) {
    .modal-content {
      padding: 0.5rem;
    }

    .modal-title {
      font-size: 1.75rem;
    }
  }
</style>
