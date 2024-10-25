<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/translations';
  import { backendService } from '$lib/services/backendService';
  import WalletConnection from '$lib/components/WalletConnection.svelte';

  let tokens: any[] = [];
  let isBackendReady = false;

  onMount(async () => {
    await backendService.initializeActors();
    await loadTokens();
  });

  async function loadTokens() {
    try {
      tokens = await backendService.getTokens();
      console.log('Tokens:', tokens);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  }
</script>

<main class="flex flex-col">
  <!-- Translated Greeting and Welcome Message -->
  <p>
    {$t('common.greeting')}, {$t('common.welcome')}
  </p>

  <!-- Wallet Connection Section -->
  <WalletConnection />

  <!-- Tokens Display Section -->
  {#if tokens.Ok}
    {#each tokens.Ok as token}
      <div class="text-sm uppercase text-gray-500">
        {token?.IC?.name}
      </div>
    {/each}
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</main>
