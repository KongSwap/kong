<!-- src/launchpad_frontend/src/lib/components/PlugMobileDialog.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isPwa } from '$lib/utils/browser';

  const dispatch = createEventDispatcher();

  const isRunningAsPwa = isPwa();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
  <div class="w-full max-w-md p-6 space-y-4 border-2 border-cyan-500 bg-black/95">
    <div class="flex items-center justify-between">
      <h3 class="text-xl font-bold text-white">Install Plug Wallet</h3>
      <button
        on:click={() => dispatch('close')}
        class="p-2 transition-colors rounded-full hover:bg-cyan-500/20"
      >
        <span class="text-cyan-400">✕</span>
      </button>
    </div>

    <div class="space-y-4">
      {#if isRunningAsPwa}
        <p class="text-cyan-400">
          Please open this app in your device's browser to connect with Plug wallet.
        </p>
        <button
          on:click={() => window.open(window.location.href, '_blank')}
          class="w-full px-4 py-3 font-bold text-white transition-colors border-2 border-cyan-400 hover:bg-cyan-500/20"
        >
          Open in Browser
        </button>
      {:else}
        <p class="text-cyan-400">
          To use Plug wallet on mobile, you'll need to install the Plug mobile app:
        </p>
        <div class="grid grid-cols-2 gap-4">
          <a
            href="https://apps.apple.com/app/plug-crypto-wallet/id1599570197"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center px-4 py-3 font-bold text-white transition-colors border-2 border-cyan-400 hover:bg-cyan-500/20"
          >
            App Store
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=xyz.plugwallet.plug"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center px-4 py-3 font-bold text-white transition-colors border-2 border-cyan-400 hover:bg-cyan-500/20"
          >
            Play Store
          </a>
        </div>
      {/if}
    </div>
  </div>
</div> 
