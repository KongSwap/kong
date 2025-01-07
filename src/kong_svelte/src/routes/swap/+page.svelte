<script lang="ts">
  import { liveTokens } from '$lib/services/tokens/tokenStore';
  import { onDestroy, onMount } from 'svelte';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Swap from '$lib/components/swap/Swap.svelte';
  import SwapPro from '$lib/components/swap/SwapPro.svelte';
  import { page } from '$app/stores';
  import { loadMoonPay } from '@moonpay/moonpay-js';
  
  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;
  let currentMode: 'normal' | 'pro' = 'normal';
  let moonPaySdk: any;

  const showMoonPay = async () => {
    if (moonPaySdk) {
      await moonPaySdk.show();
    }
  };

  onMount(async () => {
    const moonPay = await loadMoonPay();
    moonPaySdk = moonPay({
      flow: 'buy',
      environment: 'production',
      variant: 'overlay',
      params: {
        apiKey: process.env.MOONPAY_API_KEY,
        theme: 'dark',
        baseCurrencyCode: 'usd',
        baseCurrencyAmount: '100',
        defaultCurrencyCode: 'icp_icp'
      }
    });

    const handleOnramp = () => {
      showMoonPay();
    };

    window.addEventListener('onramp', handleOnramp);
    return () => {
      window.removeEventListener('onramp', handleOnramp);
    };
  });

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

<style>
  .onramp-button {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    color: white;
    border-radius: 12px;
    transition: all 0.2s ease;
    background: rgba(55, 114, 255, 0.2);
    border: none;
    cursor: pointer;
  }

  .onramp-button:hover {
    background: rgba(55, 114, 255, 0.3);
  }
</style>
