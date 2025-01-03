<script lang="ts">
  import { liveTokens } from '$lib/services/tokens/tokenStore';
  import { onDestroy } from 'svelte';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Swap from '$lib/components/swap/Swap.svelte';
  import SwapPro from '$lib/components/swap/SwapPro.svelte';
  import { page } from '$app/stores';

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: 'normal' | 'pro' = 'normal';

  $: if ($liveTokens && $liveTokens.length > 0) {
    const fromCanisterId = $page.url.searchParams.get('from');
    const toCanisterId = $page.url.searchParams.get('to');
    
    fromToken = fromCanisterId ? $liveTokens.find(t => t.canister_id === fromCanisterId) || null : null;
    toToken = toCanisterId ? $liveTokens.find(t => t.canister_id === toCanisterId) || null : null;
  }

  const handleModeChange = (event: CustomEvent<{ mode: 'normal' | 'pro' }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapService.cleanup();
  });
</script>

<section class="w-full overflow-x-hidden">
  {#if $liveTokens}
    <div class="p-2 md:p-0 w-full flex justify-center">
      {#if currentMode === 'normal'}
        <Swap 
          initialFromToken={fromToken} 
          initialToToken={toToken} 
          {currentMode}
          on:modeChange={handleModeChange}
        />
      {:else}
        <SwapPro 
          initialFromToken={fromToken} 
          initialToToken={toToken}
          {currentMode}
          on:modeChange={handleModeChange}
        />
      {/if}
    </div>
  {:else}
    <p>Loading tokens...</p>
  {/if}
</section>
