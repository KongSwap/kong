<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import SideNav from "./SideNav.svelte";
  import ValueOverview from "./ValueOverview.svelte";
  import WalletInfo from "./WalletInfo.svelte";
  import { initializeWalletBalances, getStoredWalletBalances, walletBalancesStore, currentWalletStore } from "$lib/stores/walletBalancesStore";
  import { TokenService } from "$lib/services/tokens/TokenService";
  import { userTokens } from "$lib/stores/userTokens";

  let { children } = $props<{ children: any }>();

  // Track initialization state
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Get principal from the URL params
  let principal = $derived($page.params.principalId);

  async function initializeWallet() {
    try {
      isLoading = true;
      error = null;

      // First ensure we have tokens
      console.log('Fetching tokens...');
      const tokens = await TokenService.fetchTokens();
      if (!tokens?.length) {
        throw new Error('No tokens available');
      }
      console.log('Fetched tokens:', tokens.length, 'tokens');

      // Now initialize balances for current wallet
      console.log('Initializing balances for wallet:', principal);
      await initializeWalletBalances(principal);

      // Verify we got balances
      const newBalances = await getStoredWalletBalances(principal);
      console.log('New balances loaded:', Object.keys(newBalances).length, 'tokens with balances');

      if (Object.keys(newBalances).length === 0) {
        console.warn('No balances received after initialization');
      }
    } catch (err) {
      console.error("Failed to initialize wallet:", err);
      error = err instanceof Error ? err.message : "Failed to initialize wallet";
      walletBalancesStore.set({}); // Clear balances on error
      currentWalletStore.set(null);
    } finally {
      isLoading = false;
    }
  }

  // Initialize when principal changes and is different from current wallet
  $effect(() => {
    const currentWallet = $currentWalletStore;
    if (principal && currentWallet !== principal) {
      initializeWallet();
    } else if (!principal) {
      // Clear balances if no principal
      walletBalancesStore.set({});
      currentWalletStore.set(null);
    }
  });

  // Monitor balance changes
  $effect(() => {
    const balances = $walletBalancesStore;
    const currentWallet = $currentWalletStore;
    console.log('Wallet balances updated for', currentWallet, ':', Object.keys(balances).length, 'tokens with balances');
  });
</script>

<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4">
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Navigation Column -->
    <div class="space-y-6">
      <ValueOverview {principal} {isLoading} {error} />
      <SideNav {principal} />
    </div>
    <!-- Content Area -->
    <div class="lg:col-span-3 space-y-6">
      <WalletInfo {principal} />
      {@render children?.()}
    </div>
  </div>
</div>
