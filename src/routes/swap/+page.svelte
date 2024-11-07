<script lang="ts">
  import { t } from '$lib/locales/translations';
  import { TokenService } from '$lib/services/TokenService';
  import { onMount } from 'svelte';
  import Swap from '$lib/components/swap/Swap.svelte';
  import { tokenStore } from '$lib/stores/tokenStore';

  let tokens: any = null;

  onMount(async () => {
    tokenStore.loadTokens();
    try {
      tokens = await TokenService.fetchTokens();
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  });
</script>

<section class="swap-page">
  <div class="claim-section">
    <button class="claim-button" on:click={async () => await TokenService.claimFaucetTokens()}>
      Claim Tokens
    </button>
  </div>

  {#if tokens?.Ok}
    {#each tokens?.Ok as token}
      <div class="text-sm uppercase text-gray-500">
        {token?.IC?.name}
      </div>
    {/each}
  {:else if tokens}
    <div class="swap-container">
      <Swap />
    </div>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

<style lang="postcss">
  .swap-page {
    @apply w-full min-h-screen;
    background: url('/backgrounds/jungle.webp') center/cover no-repeat fixed;
  }

  .claim-section {
    @apply fixed top-4 right-4 z-50;
  }

  .claim-button {
    @apply px-4 py-2 bg-yellow-400 text-black font-bold rounded-lg 
           hover:bg-yellow-300 transition-all duration-200
           shadow-lg hover:shadow-xl;
  }

  .swap-container {
    @apply w-full max-w-[1800px] mx-auto px-4;
  }

  @media (max-width: 768px) {
    .swap-container {
      @apply px-2;
    }
  }
</style> 
