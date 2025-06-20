<script lang="ts">
  import kongLogo from "$lib/assets/kong_logo.png";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { isMobileBrowser } from "$lib/utils/browser";
  import type { BeforeInstallPromptEvent } from "$lib/types/pwa";

  // State using runes
  let InstallPWADialog = $state<typeof import("$lib/components/common/InstallPWADialog.svelte").default | null>(null);
  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let showPrompt = $state(false);
  let showIOSDialog = $state(false);
  let isEligible = $state(false);
  const PWA_PROMPT_KEY = "settings:pwa-install-prompt";

  async function loadInstallDialog() {
    InstallPWADialog = (await import("$lib/components/common/InstallPWADialog.svelte")).default;
  }

  onMount(async () => {
    if (!browser) return;

    // First check if device is eligible
    isEligible = isMobileBrowser();
    if (!isEligible) return;

    // Then check if user has already interacted
    const hasInteracted = localStorage.getItem(PWA_PROMPT_KEY);
    if (hasInteracted) return;

    // For iOS, show prompt immediately
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) {
      showPrompt = true;
      return;
    }

    // For other devices, wait for beforeinstallprompt
    window.addEventListener("beforeinstallprompt", (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt = e;
      showPrompt = true;
    });

    window.addEventListener("appinstalled", () => {
      localStorage.setItem(PWA_PROMPT_KEY, "installed");
      showPrompt = false;
    });
  });

  async function installPWA() {
    if (!deferredPrompt) {
      // For iOS, show dialog instead of alert
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) {
        await loadInstallDialog();
        showIOSDialog = true;
      }
      showPrompt = false;
      return;
    }

    try {
      showPrompt = false;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(PWA_PROMPT_KEY, "installed");
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      deferredPrompt = null;
    }
  }

  async function dismissPrompt() {
    showPrompt = false;
    // Persist dismissal
    localStorage.setItem(PWA_PROMPT_KEY, "dismissed");
  }

  async function closeIOSDialog({ source }: { source: 'backdrop' | 'button' }) {
    showIOSDialog = false;
    if (source === 'backdrop') {
      showPrompt = true;
      return;
    }
    if (source === 'button') {
      localStorage.setItem(PWA_PROMPT_KEY, "dismissed");
    }
  }
</script>

{#if showPrompt}
  <div
    class="fixed bottom-5 left-1/2 z-[1000] w-[calc(100%-40px)] max-w-[420px] -translate-x-1/2"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="rounded-[20px] border border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 p-5 text-white/80 backdrop-blur-md shadow-xl sm:bottom-4 sm:w-[calc(100%-32px)] sm:p-4"
      transition:fly|local={{ y: 100, duration: 400, easing: cubicOut }}
    >
      <div class="flex flex-col">
        <div class="flex flex-1 items-center gap-4">
          <div class="flex flex-col">
            <h3 class="m-0 text-lg font-semibold leading-tight text-white sm:text-base">Add Kong to Home Screen</h3>
            <p class="mt-1 text-[0.9375rem] leading-snug opacity-80 sm:text-sm">Get instant access to Kong from your device</p>
          </div>
          <div class="relative ml-auto rounded-full w-20 sm:w-12">
            <img 
              src={kongLogo} 
              alt="Kong Logo" 
              class="relative w-20 rounded-full shadow-sm sm:h-11 sm:w-11"
            />
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-3 sm:mt-4">
          <button 
            class="rounded-xl bg-gradient-45 from-kong-primary to-kong-primary/80 px-5 py-2.5 text-[0.9375rem] font-medium text-white transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-kong-primary/40 sm:px-4 sm:py-2 sm:text-sm"
            onclick={installPWA}
          >
            Install App
          </button>
          <button 
            class="rounded-xl px-5 py-2.5 text-[0.9375rem] font-medium text-white/90 transition-colors hover:bg-white/5 sm:px-4 sm:py-2 sm:text-sm"
            onclick={dismissPrompt}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showIOSDialog && InstallPWADialog}
  <svelte:component 
    this={InstallPWADialog}
    bind:open={showIOSDialog}
    onClose={closeIOSDialog}
  />
{/if}

<style lang="postcss">
  /* Custom utility class for 45-degree gradient that's not easily done with Tailwind */
  .bg-gradient-45 {
    background: linear-gradient(45deg, var(--tw-gradient-from), var(--tw-gradient-to));
  }
</style>
