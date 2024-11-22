<script lang="ts">
  import { t } from '$lib/services/translations';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { onMount, onDestroy } from 'svelte';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Swap from '$lib/components/swap/Swap.svelte';
  import SwapPro from '$lib/components/swap/SwapPro.svelte';
  import { page } from '$app/stores';

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: 'normal' | 'pro' = 'normal';

  onMount(() => {
    const unsubscribe = page.subscribe(($page) => {
      fromToken = tokenStore.getToken($page.url.searchParams.get('from'));
      toToken = tokenStore.getToken($page.url.searchParams.get('to'));
    });
    return () => unsubscribe();
  });

  const handleModeChange = (event: CustomEvent<{ mode: 'normal' | 'pro' }>) => {
    currentMode = event.detail.mode;
  };

  onDestroy(() => {
    SwapService.cleanup();
  });
</script>

<section class="swap-container">
  {#if $tokenStore.tokens}
    <div class="swap-wrapper">
      {#if currentMode === 'normal'}
        <Swap 
          initialFromToken={fromToken} 
          initialToToken={toToken} 
          mode={currentMode}
          on:modeChange={handleModeChange}
        />
      {:else}
        <SwapPro 
          initialFromToken={fromToken} 
          initialToToken={toToken}
          mode={currentMode}
          on:modeChange={handleModeChange}
        />
      {/if}
    </div>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

<style lang="postcss">
  .swap-container {
    width: 100%;
    overflow-x: hidden;
  }

  .swap-wrapper {
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    justify-content: center;
  }
</style>
