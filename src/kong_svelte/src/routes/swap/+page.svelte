<script lang="ts">
  import { t } from '$lib/services/translations';
  import { getTokenByCanisterId, tokenStore } from '$lib/services/tokens/tokenStore';
  import { onMount, onDestroy } from 'svelte';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Swap from '$lib/components/swap/Swap.svelte';
  import { page } from '$app/stores';
  import { isConnected } from '$lib/services/wallet/walletStore';

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;

  onMount(() => {
    const unsubscribe = page.subscribe(($page) => {
      fromToken = getTokenByCanisterId($page.url.searchParams.get('from'));
      toToken = getTokenByCanisterId($page.url.searchParams.get('to'));
    });
    return () => unsubscribe();
  });

  const claimTokens = async () => {
    const result = await tokenStore.claimFaucetTokens();
    console.log('Claim result', result);
    tokenStore.loadBalances();
  };

  onDestroy(() => {
    SwapService.cleanup();
  });
</script>

<section class="flex flex-col items-center justify-center">

  {#if $tokenStore.tokens}
    <div class="flex justify-center mt-8 md:mt-12">
      <Swap initialFromToken={fromToken?.symbol} initialToToken={toToken?.symbol} />
    </div>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

