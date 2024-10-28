<script lang="ts">
  import { t } from '$lib/locales/translations';
  import { backendService } from '$lib/services/backendService';
  import { onMount } from 'svelte';

  let tokens: any = null;

  onMount(async () => {
    try {
      tokens = await backendService.getTokens();
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  });
</script>

<main class="flex flex-col">
  <!-- Translated Greeting and Welcome Message -->
  <p>
    {$t('common.greeting')}, {$t('common.welcome')}
  </p>



  <!-- Tokens Display Section -->
  {#if tokens?.Ok}
    {#each tokens?.Ok as token}
      <div class="text-sm uppercase text-gray-500">
        {token?.IC?.name}
      </div>
    {/each}
  {:else if tokens}
    <p>No tokens found.</p>
  {:else}
    <p>{$t('common.loadingTokens')}</p>
  {/if}
</main>
