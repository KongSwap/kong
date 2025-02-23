<script lang="ts">
  import { page } from "$app/state";
  import { userTokens } from "$lib/stores/userTokens";
  import { loadWalletBalances, walletBalancesStore } from "$lib/stores/walletBalancesStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  let isLoading = $state(true);
  let loadingError = $state<string | null>(null);
  let totalValue = $state<number>(0);

  // Computed total value from wallet balances
  $effect(() => {
    totalValue = Object.values($walletBalancesStore).reduce(
      (acc, balance) => acc + Number(balance?.in_usd || 0),
      0
    );
  });

  async function loadWalletData() {
    try {
      isLoading = true;
      loadingError = null;

      const principal = page.params.principalId;
      if (principal === "anonymous") {
        throw new Error("No wallet connected");
      }
    } catch (error) {
      console.error("Failed to load wallet data:", error);
      loadingError = error instanceof Error ? error.message : "Failed to load wallet data";
    } finally {
      isLoading = false;
    }
  }

  // Load data when principalId changes
  $effect(() => {
    if (page.params.principalId) {
      loadWalletData();
    }
  });
</script>

<div class="flex flex-col gap-6">
  <Panel>
    {#if isLoading}
      <div class="flex items-center justify-center min-h-[200px]">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-kong-primary" />
      </div>
    {:else if loadingError}
      <div class="text-kong-accent-red mb-4">{loadingError}</div>
      <button
        class="text-sm text-kong-primary hover:text-opacity-80 transition-colors"
        onclick={loadWalletData}
      >
        Try Again
      </button>
    {:else}
      <div class="flex flex-col gap-6">
        <!-- Wallet Overview Section -->
        <div class="flex flex-col gap-2">
          <h2 class="text-2xl font-bold">Wallet Overview</h2>
          <div class="text-kong-text-secondary">
            {page.params.principalId}
          </div>
        </div>

        <!-- Asset Summary Section -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="bg-kong-surface-secondary rounded-lg p-4">
            <div class="text-sm text-kong-text-secondary mb-2">Total Value</div>
            <div class="text-xl font-bold">
              ${formatToNonZeroDecimal(totalValue)}
            </div>
          </div>
          
          <div class="bg-kong-surface-secondary rounded-lg p-4">
            <div class="text-sm text-kong-text-secondary mb-2">Unique Tokens</div>
            <div class="text-xl font-bold">
              {Object.keys($walletBalancesStore).length}
            </div>
          </div>
        </div>

        <!-- Top Assets Section -->
        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-semibold">Top Assets</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each Object.entries($walletBalancesStore)
              .sort((a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0))
              .slice(0, 4) as [canisterId, balance]}
              {#if $userTokens.tokens}
                {@const token = $userTokens.tokens.find(t => t.canister_id === canisterId)}
                {#if token}
                  <div class="bg-kong-surface-secondary rounded-lg p-4">
                    <div class="flex items-center gap-3">
                      <TokenImages tokens={[token]} size={32} />
                      <div class="flex flex-col">
                        <div class="font-semibold">{token.symbol}</div>
                        <div class="text-sm text-kong-text-secondary">
                          ${formatToNonZeroDecimal(balance?.in_usd || "0")}
                        </div>
                      </div>
                    </div>
                  </div>
                {/if}
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </Panel>
</div>