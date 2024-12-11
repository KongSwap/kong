<script lang="ts">
  import { t } from '$lib/services/translations';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { onDestroy } from 'svelte';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Swap from '$lib/components/swap/Swap.svelte';
  import SwapPro from '$lib/components/swap/SwapPro.svelte';
  import { page } from '$app/stores';

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: 'normal' | 'pro' = 'normal';

  $: if ($tokenStore.tokens && $tokenStore.tokens.length > 0) {
    const fromCanisterId = $page.url.searchParams.get('from');
    const toCanisterId = $page.url.searchParams.get('to');
    
    fromToken = fromCanisterId ? $tokenStore.tokens.find(t => t.canister_id === fromCanisterId) || null : null;
    toToken = toCanisterId ? $tokenStore.tokens.find(t => t.canister_id === toCanisterId) || null : null;
  }

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
      <div class="swap-normal">
        <Swap 
          initialFromToken={fromToken} 
          initialToToken={toToken} 
          {currentMode}
          on:modeChange={handleModeChange}
        />
      </div>
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
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

<style scoped lang="postcss">
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

  .swap-normal {
    background-color: transparent;

  }

  @media (max-width: 640px) {
    .swap-normal {
      padding-top: 0.5rem;
      padding: 1rem 1rem 0;
    }
  }

  @media (max-width: 640px) {
    .swap-normal {
      padding-top: 0.25rem;
    }
  }
</style>
