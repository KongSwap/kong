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

<main class="flex flex-col items-center">
  <button class="pt-32" on:click={async () => await TokenService.claimFaucetTokens()}>Claim Tokens</button>
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
</main>

<style>
  .swap-container {
    display: flex;
    justify-content: center;
  }
</style>
