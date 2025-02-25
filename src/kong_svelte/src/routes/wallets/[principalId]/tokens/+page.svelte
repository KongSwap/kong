<script lang="ts">
  import WalletTokenList from "./WalletTokenList.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { auth } from "$lib/services/auth";
  import { loadWalletBalances } from "$lib/stores/walletBalancesStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { page } from "$app/state";

  let isLoading = $state(true);
  let loadingError = $state<string | null>(null);

  async function loadTokenData() {
    try {
      isLoading = true;
      loadingError = null;

      const principal = page.params.principalId;
      if (principal === "anonymous") {
        throw new Error("No wallet connected");
      }

      // Load balances using the new wallet-specific store
      await loadWalletBalances(principal, { 
        tokens: $userTokens.tokens,
        forceRefresh: true 
      });
    } catch (error) {
      console.error("Failed to update data:", error);
      loadingError =
        error instanceof Error
          ? error.message
          : "Failed to load token data";
    } finally {
      isLoading = false;
    }
  }

  // Watch for principalId changes
  $effect(() => {
    if (page.params.principalId) {
      loadTokenData();
    }
  });

  // Watch for auth state changes
  $effect(() => {
    if (page.params.principalId) {
      loadTokenData();
    } else if (!$auth.isConnected) {
      loadingError = "No wallet connected";
    }
  });
</script>

<Panel variant="transparent">
  {#if isLoading}
    <div class="flex items-center justify-center min-h-[200px]">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-kong-primary"></div>
    </div>
  {:else if loadingError}
    <div class="text-kong-accent-red mb-4">{loadingError}</div>
    {#if loadingError}
      <button
        class="text-sm text-kong-primary hover:text-opacity-80 transition-colors"
        on:click={loadTokenData}
      >
        Try Again
      </button>
    {/if}
  {:else}
    <div class="flex flex-col gap-4">
      <WalletTokenList tokens={$userTokens?.tokens} />
    </div>
  {/if}
</Panel>