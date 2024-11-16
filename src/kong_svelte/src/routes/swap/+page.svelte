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
    const result = await tokenStore.claimFaucetTokens();
    await tokenStore.loadBalances();
  };

  onDestroy(() => {
    SwapService.cleanup();
  });
</script>

<section class="flex flex-col items-center justify-center bg-game-theme">

  {#if process.env.DFX_NETWORK === 'local'}
    <button on:click={claimTokens}>Claim Tokens</button>
  {/if}

  {#if $tokenStore.tokens}
    <div class="flex justify-center mt-8 md:mt-12">
      <Swap initialFromToken={fromToken} initialToToken={toToken} />
    </div>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

<style lang="postcss">
  .bg-game-theme {
    background: 
      /* Animated fireflies/particles */
      radial-gradient(circle at 50% 50%, rgba(255,255,150,0.1) 0%, transparent 10%) 0 0 / 15px 15px,
      /* Parallax forest layers */
      linear-gradient(0deg, 
        rgba(25, 55, 45, 0.9) 0%,
        rgba(35, 75, 65, 0.8) 20%,
        rgba(45, 95, 85, 0.7) 40%,
        rgba(55, 115, 105, 0.6) 60%,
        rgba(65, 135, 125, 0.5) 80%,
        rgba(75, 155, 145, 0.4) 100%
      ),
      /* Base color */
      #1a4a3c;
    min-height: 100vh;
    animation: firefly 4s infinite alternate;
  }

  @keyframes firefly {
    0% { background-position: 0% 0%; }
    100% { background-position: 100% 100%; }
  }
</style>

