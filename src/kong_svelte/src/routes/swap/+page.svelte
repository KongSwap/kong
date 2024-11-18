<script lang="ts">
  import { t } from '$lib/services/translations';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { onMount, onDestroy } from 'svelte';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Swap from '$lib/components/swap/Swap.svelte';
  import { page } from '$app/stores';

  let fromToken: FE.Token | null = null;
  let toToken: FE.Token | null = null;

  onMount(() => {
    const unsubscribe = page.subscribe(($page) => {
      fromToken = tokenStore.getToken($page.url.searchParams.get('from'));
      toToken = tokenStore.getToken($page.url.searchParams.get('to'));
    });
    return () => unsubscribe();
  });

  const claimTokens = async () => {
    await tokenStore.claimFaucetTokens();
    await tokenStore.loadBalances();
  };

  onDestroy(() => {
    SwapService.cleanup();
  });
</script>

<section class="flex flex-col items-center justify-center">

    <button on:click={claimTokens}>Claim Tokens</button>

  {#if $tokenStore.tokens}
    <div class="flex justify-center mt-8 md:mt-12">
      <Swap initialFromToken={fromToken} initialToToken={toToken} />
    </div>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

