<!-- src/lib/components/sidebar/TokenList.svelte -->
<script lang="ts">
    import { tokenStore } from '$lib/stores/tokenStore';
    import TokenRow from '$lib/components/nav/sidebar/TokenRow.svelte';
    import { onMount } from 'svelte';
    import { walletStore } from '$lib/stores/walletStore';
  
    onMount(async () => {
      await tokenStore.loadTokens();
      if ($walletStore.account) {
        await tokenStore.loadBalances($walletStore.account.principal);
      }
    });
  </script>
  
  <div class="token-list">
    {#if $tokenStore.isLoading}
      <div class="loading">Loading tokens...</div>
    {:else if $tokenStore.error}
      <div class="error">{$tokenStore.error}</div>
    {:else}
      <div class="portfolio-value">
        <h3>Portfolio Value</h3>
        <p>${$tokenStore.totalValueUsd}</p>
      </div>
      {#each $tokenStore.tokens as token (token.symbol)}
        <TokenRow {token} />
      {/each}
    {/if}
  </div>
  
  <style>
    .token-list {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .loading, .error {
      text-align: center;
      padding: 16px;
    }
    
    .portfolio-value {
      text-align: center;
      padding: 16px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      margin-bottom: 16px;
    }
  </style>
  
  