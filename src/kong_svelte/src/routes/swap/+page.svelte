<script lang="ts">
  import { t } from '$lib/locales/translations';
  import { backendService } from '$lib/services/backendService';
  import { onMount } from 'svelte';
  import Swap from '$lib/components/swap/Swap.svelte';

  let tokens: any = null;

  onMount(async () => {
    try {
      tokens = await backendService.getTokens();
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  });
</script>

<main class="flex flex-col items-center">
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
