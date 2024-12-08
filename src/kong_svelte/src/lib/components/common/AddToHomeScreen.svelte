<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let deferredPrompt: any;
  let showPrompt = false;

  onMount(() => {
    if (!browser) return;

    // Check if user has already dismissed or installed
    const hasInteracted = localStorage.getItem('pwa-prompt-interaction');
    if (hasInteracted) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;
      showPrompt = true;
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      localStorage.setItem('pwa-prompt-interaction', 'installed');
      showPrompt = false;
    });
  });

  async function installPWA() {
    showPrompt = false;
    localStorage.setItem('pwa-prompt-interaction', 'dismissed');
    
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // Clear the deferredPrompt
    deferredPrompt = null;
  }

  function dismissPrompt() {
    showPrompt = false;
    localStorage.setItem('pwa-prompt-interaction', 'dismissed');
  }
</script>

{#if showPrompt}
  <div class="pwa-prompt" transition:slide={{ duration: 300 }}>
    <div class="prompt-content">
      <img src="/icons/icon-192x192.png" alt="App Icon" class="app-icon" />
      <div class="prompt-text">
        <h3>Add to Home Screen</h3>
        <p>Install Kong for a better experience</p>
      </div>
      <div class="prompt-actions">
        <button class="install-btn" on:click={installPWA}>
          Install
        </button>
        <button class="dismiss-btn" on:click={dismissPrompt}>
          Not Now
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .pwa-prompt {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    background: var(--bg-card);
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    padding: 16px;
    width: calc(100% - 40px);
    max-width: 400px;
  }

  .prompt-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .app-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  .prompt-text {
    flex: 1;
  }

  .prompt-text h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .prompt-text p {
    margin: 4px 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .prompt-actions {
    display: flex;
    gap: 8px;
  }

  .install-btn,
  .dismiss-btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .install-btn {
    background: var(--primary);
    color: white;
    border: none;
  }

  .install-btn:hover {
    opacity: 0.9;
  }

  .dismiss-btn {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  .dismiss-btn:hover {
    background: var(--bg-hover);
  }
</style>
