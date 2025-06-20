<script lang="ts">
  import { keyboardShortcuts, type KeyboardShortcut } from '$lib/services/keyboardShortcuts';
  import Modal from '$lib/components/common/Modal.svelte';
  import { keyboardShortcutsStore } from '$lib/stores/keyboardShortcutsStore';

  let allShortcuts = $state<KeyboardShortcut[]>([]);
  let shortcutsByScope = $state<Record<string, KeyboardShortcut[]>>({});
  let isOpen = $state(false);
  
  // Subscribe to the store
  $effect(() => {
    const unsubscribe = keyboardShortcutsStore.subscribe(state => {
      isOpen = state.isHelpOpen;
      if (state.isHelpOpen) {
        refreshShortcuts();
      }
    });
    
    return unsubscribe;
  });
  
  // Refresh shortcuts list
  function refreshShortcuts() {
    allShortcuts = keyboardShortcuts.getShortcuts();
    
    // Group shortcuts by scope
    shortcutsByScope = allShortcuts.reduce((acc, shortcut) => {
      const scope = shortcut.scope || 'global';
      if (!acc[scope]) {
        acc[scope] = [];
      }
      acc[scope].push(shortcut);
      return acc;
    }, {} as Record<string, KeyboardShortcut[]>);
  }
  
  // Format scope name for display
  function formatScopeName(scope: string): string {
    return scope.charAt(0).toUpperCase() + scope.slice(1);
  }
  
  // Close the help panel
  function close() {
    keyboardShortcutsStore.closeHelp();
  }
</script>

<Modal 
  isOpen={isOpen}
  title="Keyboard Shortcuts"
  onClose={close}
  closeOnEscape={true}
  closeOnClickOutside={true}
  width="600px"
  className="keyboard-shortcuts-modal"
>
  <div slot="title" class="flex items-center justify-between w-full">
    <h2 class="text-xl font-bold text-kong-text-primary">Keyboard Shortcuts</h2>
    <div class="shortcut-indicator">
      <span class="shortcut-key-small">Shift+?</span>
    </div>
  </div>
  
  <div class="shortcuts-content">
    {#each Object.entries(shortcutsByScope) as [scope, shortcuts]}
      <div class="shortcuts-section">
        <h3 class="section-title">{formatScopeName(scope)}</h3>
        <div class="shortcuts-list">
          {#each shortcuts as shortcut}
            <div class="shortcut-item">
              <div class="shortcut-key">{keyboardShortcuts.formatShortcut(shortcut)}</div>
              <div class="shortcut-description">{shortcut.description}</div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</Modal>

<style lang="postcss">
  .shortcut-indicator {
    @apply flex-1 flex justify-center;
  }
  
  .shortcut-key-small {
    @apply px-1.5 py-0.5 bg-kong-bg-tertiary border border-kong-border rounded text-xs text-kong-text-secondary;
    @apply hidden sm:block;
  }

  .shortcuts-content {
    @apply flex flex-col gap-6 py-4 overflow-y-auto max-h-[70vh];
  }

  .shortcuts-section {
    @apply flex flex-col gap-3;
  }

  .section-title {
    @apply text-lg font-medium text-kong-text-primary;
  }

  .shortcuts-list {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-2;
  }

  .shortcut-item {
    @apply flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors;
  }

  .shortcut-key {
    @apply px-2.5 py-1.5 bg-kong-bg-tertiary border border-kong-border rounded-md text-sm font-medium text-kong-text-secondary whitespace-nowrap;
  }

  .shortcut-description {
    @apply text-sm text-kong-text-primary;
  }
  
  :global(.keyboard-shortcuts-modal) {
    @apply max-w-xl mx-auto;
  }
</style> 