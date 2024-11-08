<script lang="ts">
  import { t } from '$lib/services/translations';
  import { TokenService, tokenStore } from '$lib/services/tokens';
  import { onMount } from 'svelte';
  import Swap from '$lib/components/swap/Swap.svelte';

  let tokens: any = null;

  onMount(async () => {
    try {
      tokens = $tokenStore.tokens;
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  });

  const claimTokens = async () => {
    await TokenService.claimFaucetTokens();
    tokenStore.loadTokens();
  };
</script>

<section class="flex flex-col items-center justify-center pt-40">
  {#if process.env.DFX_NETWORK === 'local'}
    <button on:click={claimTokens}>Claim Tokens</button>
  {/if}
  {#if tokens?.Ok}
    {#each tokens?.Ok as token}
      <div class="text-sm uppercase text-gray-500">
        {token?.IC?.name}
      </div>
    {/each}
  {:else if tokens}
    <div class="flex justify-center">
      <Swap />
    </div>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</section>

