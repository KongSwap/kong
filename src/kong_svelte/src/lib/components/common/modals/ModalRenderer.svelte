<script lang="ts">
  import { modalManager, type ModalState } from '$lib/stores/modalManager';
  import { onMount } from 'svelte';

  // Subscribe to modal manager state
  let modals = $state<ModalState[]>([]);
  
  // Lazy-loaded modal components cache
  let modalComponents = $state<Record<string, any>>({});
  let loadingComponents = $state<Set<string>>(new Set());

  $effect(() => {
    const unsubscribe = modalManager.subscribe(state => {
      modals = state.modals;
      
      // Preload modal components for open modals
      state.modals.forEach(modal => {
        if (!modalComponents[modal.props.type] && !loadingComponents.has(modal.props.type)) {
          loadModalComponent(modal.props.type);
        }
      });
    });

    return unsubscribe;
  });

  // Lazy load modal components with caching
  async function loadModalComponent(type: string) {
    if (modalComponents[type] || loadingComponents.has(type)) {
      return modalComponents[type];
    }

    loadingComponents.add(type);

    try {
      let component;
      
      switch (type) {
        case 'confirmation':
          component = (await import('./ConfirmationModal.svelte')).default;
          break;
        case 'form':
          component = (await import('./FormModal.svelte')).default;
          break;
        case 'selector':
          component = (await import('./SelectorModal.svelte')).default;
          break;
        case 'signature':
          component = (await import('./SignatureModal.svelte')).default;
          break;
        case 'qr':
          component = (await import('./QRModal.svelte')).default;
          break;
        case 'custom':
          component = (await import('./CustomModal.svelte')).default;
          break;
        default:
          console.warn(`Unknown modal type: ${type}`);
          return null;
      }

      modalComponents[type] = component;
      return component;
    } catch (error) {
      console.error(`Failed to load modal component for type: ${type}`, error);
      return null;
    } finally {
      loadingComponents.delete(type);
    }
  }

  // Get cached modal component or return null if not loaded
  function getModalComponent(type: string) {
    return modalComponents[type] || null;
  }

  // Preload common modal types for better performance
  onMount(async () => {
    // Preload most commonly used modals
    const commonTypes = ['confirmation', 'form'];
    
    await Promise.all(
      commonTypes.map(type => loadModalComponent(type))
    );
  });

  // Cleanup inactive modal components to free memory
  $effect(() => {
    const activeTypes = new Set(modals.map(modal => modal.props.type));
    
    // Clean up components that haven't been used recently
    Object.keys(modalComponents).forEach(type => {
      if (!activeTypes.has(type)) {
        // Keep components in cache for a short time after use
        setTimeout(() => {
          if (!modalManager.hasOpenModals() || !modals.some(m => m.props.type === type)) {
            // Only clean up if component isn't currently in use
            const currentlyActive = modalManager.getOpenModals().some(m => m.props.type === type);
            if (!currentlyActive) {
              delete modalComponents[type];
            }
          }
        }, 30000); // Keep in cache for 30 seconds after last use
      }
    });
  });
</script>

<!-- Render all active modals with lazy loading -->
{#each modals as modal (modal.id)}
  {@const ModalComponent = getModalComponent(modal.props.type)}
  
  {#if ModalComponent}
    <!-- Modal component is loaded, render it -->
    <ModalComponent id={modal.id} {...modal.props} />
  {:else if loadingComponents.has(modal.props.type)}
    <!-- Show loading state while component loads -->
    <div 
      class="fixed inset-0 grid place-items-center"
      style="z-index: {modal.zIndex};"
      role="dialog"
      aria-modal="true"
      aria-label="Loading modal"
    >
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
      <div class="relative bg-kong-bg-primary rounded-lg p-8 shadow-xl border border-kong-border-primary">
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 border-2 border-kong-accent-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="text-kong-text-primary">Loading modal...</span>
        </div>
      </div>
    </div>
  {:else}
    <!-- Component failed to load or invalid type -->
    <div 
      class="fixed inset-0 grid place-items-center"
      style="z-index: {modal.zIndex};"
      role="dialog"
      aria-modal="true"
      aria-label="Modal error"
    >
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
      <div class="relative bg-kong-bg-primary rounded-lg p-8 shadow-xl border border-red-500">
        <div class="text-center">
          <div class="text-red-500 text-lg mb-2">Modal Error</div>
          <div class="text-kong-text-secondary text-sm mb-4">
            Failed to load modal type: {modal.props.type}
          </div>
          <button
            type="button"
            onclick={() => modalManager.close(modal.id)}
            class="px-4 py-2 bg-kong-accent-primary text-white rounded-lg hover:bg-kong-accent-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
{/each}