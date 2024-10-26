<script lang="ts">
  import { t } from '$lib/translations';
  import { backendService } from '$lib/services/backendService';
  import WalletConnection from '$lib/components/WalletConnection.svelte';

  let tokens: any[] = [];
  let isBackendReady = false;

  backendService.isReady.subscribe((ready) => {
    isBackendReady = ready;
  });

  $: if (isBackendReady) {
    (async () => {
      tokens = await backendService.getTokens();
    })();
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
