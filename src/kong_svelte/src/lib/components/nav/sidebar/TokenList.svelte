<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { tokenStore, portfolioValue } from '$lib/stores/tokenStore';
  import TokenRow from '$lib/components/nav/sidebar/TokenRow.svelte';
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/stores/walletStore';
  import { RefreshCw } from 'lucide-svelte';
  import LoadingIndicator from '$lib/components/stats/LoadingIndicator.svelte';
  import { derived } from 'svelte/store';
  import { formatTokenAmount, formatNumberCustom } from '$lib/utils/formatNumberCustom';

  onMount(async () => {
    if ($walletStore.isConnected) {
      await tokenStore.loadTokens();
      await tokenStore.loadBalances();
    }
  });

  // Derived store to prepare tokens with formatted values
  const formattedTokens = derived(
    [tokenStore, portfolioValue],
    ([$tokenStore, $portfolioValue]) => {
      return {
        tokens: $tokenStore.tokens.map(token => {
          const balance = $tokenStore.balances[token.canister_id]?.in_tokens || 0;
          const usdValue = $tokenStore.balances[token.canister_id]?.in_usd || 0;
          return {
            ...token,
            logo: token.logo || '/tokens/not_verified.webp', // Ensure logo is always defined
            formattedBalance: formatTokenAmount(balance, token.decimals),
            formattedUsdValue: formatNumberCustom(usdValue, 2) || '0',
          };
        }),
        portfolioValue: formatNumberCustom($portfolioValue, 2) || '0',
      };
    }
  );

  /**
   * Handles the reload action for tokens and balances.
   */
  function handleReload() {
    tokenStore.reloadTokensAndBalances();
  }
</script>

<div class="token-list">
  {#if $tokenStore.isLoading}
    <div class="loading"><LoadingIndicator /></div>
  {:else if $tokenStore.error}
    <div class="error">{$tokenStore.error}</div>
  {:else}
    <div class="relative flex justify-end">
      <button
        class="flex items-center px-2 py-1 bg-white/10 hover:bg-yellow-500 hover:text-black rounded-md"
        on:click={handleReload}
        aria-label="Refresh Balances"
      >
        <RefreshCw size={18} class="mr-2" /> Refresh Balances
      </button>
    </div>

    <div class="portfolio-value">
      <h3 class="text-xs uppercase font-semibold">Portfolio Value</h3>
      <p class="text-3xl font-bold font-mono">${$formattedTokens.portfolioValue}</p>
    </div>

    {#each $formattedTokens.tokens as token (token.canister_id)}
      <TokenRow {token} />
    {/each}
  {/if}
</div>

<style scoped>
  .token-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .loading, .error {
    text-align: center;
    padding: 16px;
  }
  
  .portfolio-value {
    position: relative;
    text-align: center;
    padding: 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    margin-bottom: 16px;
  }
</style>