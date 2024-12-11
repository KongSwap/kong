<script lang="ts">
	import kongLogo from '$lib/assets/kong_logo.png';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { slide } from 'svelte/transition';
  
  let deferredPrompt: any;
  let showPrompt = false;
  let isEligible = false;

  function checkEligibility() {
    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return false;

    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      // Check if running in Safari
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      return isSafari;
    }

    // For other devices, we'll wait for the beforeinstallprompt event
    return true;
  }

  onMount(() => {
    if (!browser) return;

    // First check if device is eligible
    isEligible = checkEligibility();
    if (!isEligible) return;

    // Then check if user has already interacted
    const hasInteracted = localStorage.getItem('pwa-prompt-interaction');
    if (hasInteracted) return;

    // For iOS, show prompt immediately
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
      showPrompt = true;
      return;
    }

    // For other devices, wait for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showPrompt = true;
    });

    window.addEventListener('appinstalled', () => {
      localStorage.setItem('pwa-prompt-interaction', 'installed');
      showPrompt = false;
    });
  });

  async function installPWA() {
    if (!deferredPrompt) {
      // For iOS, just show instructions
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        alert('To install Kong:\n1. Tap the share button\n2. Scroll down and tap "Add to Home Screen"');
      }
      showPrompt = false;
      localStorage.setItem('pwa-prompt-interaction', 'dismissed');
      return;
    }

    showPrompt = false;
    localStorage.setItem('pwa-prompt-interaction', 'dismissed');
    
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
  <div class="pwa-prompt bg-gray-800 text-white/80" transition:slide={{ duration: 300 }}>
    <div class="prompt-content">
      <img src={kongLogo} alt="Kong Logo" class="app-icon" />

      <div class="prompt-text">
        <h3>Add to Home Screen</h3>
        <p>Install Kong for a better experience</p>
      </div>
      <div class="prompt-actions flex flex-col">
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
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-shadow: 0 8px 16px -4px rgb(0 0 0 / 0.25), 
                0 4px 6px -2px rgb(0 0 0 / 0.1);
    padding: 20px;
    width: calc(100% - 40px);
    max-width: 420px;
    backdrop-filter: blur(8px);
    animation: slideUp 0.3s ease-out;
    overflow: visible;
  }

  .monkey-hang {
    position: absolute;
    bottom: -80px;
    right: -20px;
    width: 120px;
    height: auto;
    transform: rotate(-10deg) scaleX(-1);
    pointer-events: none;
    animation: swing 4s ease-in-out infinite;
    transform-origin: bottom center;
  }

  @keyframes swing {
    0%, 100% { transform: rotate(-10deg) scaleX(-1); }
    50% { transform: rotate(-15deg) scaleX(-1); }
  }

  @keyframes slideUp {
    from {
      transform: translate(-50%, 100%);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }

  .prompt-content {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
  }

  .app-icon {
    width: 52px;
    border-radius: 14px;
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.2);
  }

  .prompt-text {
    flex: 1;
    min-width: 0;
  }

  .prompt-text h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .prompt-text p {
    margin: 4px 0 0;
    font-size: 0.9375rem;
    opacity: 0.8;
    line-height: 1.4;
  }

  .prompt-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    justify-content: flex-end;
  }

  .install-btn,
  .dismiss-btn {
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .install-btn {
    background: theme(colors.k-light-blue);
    color: white;
    border: none;
  }

  .install-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
    box-shadow: 0 4px 8px -2px theme(colors.k-light-blue / 0.3);
  }

  .install-btn:active {
    transform: translateY(0);
  }

  .dismiss-btn {
    background: rgba(255, 255, 255, 0.1);
    color: inherit;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dismiss-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  .dismiss-btn:active {
    transform: translateY(0);
  }

  @media (max-width: 480px) {
    .pwa-prompt {
      bottom: 16px;
      width: calc(100% - 32px);
      padding: 16px;
    }

    .monkey-hang {
      width: 60px;
      bottom: -60px;
      right: -15px;
    }

    .prompt-content {
      gap: 16px;
    }

    .app-icon {
      width: 48px;
      height: 48px;
    }

    .prompt-text h3 {
      font-size: 1rem;
    }

    .prompt-text p {
      font-size: 0.875rem;
    }

    .install-btn,
    .dismiss-btn {
      padding: 8px 16px;
      font-size: 0.875rem;
    }
  }
</style>
