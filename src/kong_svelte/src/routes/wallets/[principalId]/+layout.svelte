<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import SideNav from "./SideNav.svelte";
  import ValueOverview from "./ValueOverview.svelte";
  import WalletInfo from "./WalletInfo.svelte";
  import { initializeWalletBalances, getStoredWalletBalances, walletBalancesStore, currentWalletStore } from "$lib/stores/walletBalancesStore";
  import { TokenService } from "$lib/services/tokens/TokenService";
  import { userTokens } from "$lib/stores/userTokens";
  import Panel from "$lib/components/common/Panel.svelte";

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

{#if process.env.DFX_NETWORK !== 'ic'}
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
{:else}
 <!-- Coming Soon Display -->
 <div class="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[70vh] text-center">
   <Panel 
     variant="transparent" 
     type="main" 
     width="100%" 
     className="max-w-2xl p-8 flex flex-col items-center"
     transition="fade"
     transitionParams={{ duration: 400 }}
   >
     <!-- Icon/Graphic -->
     <div class="mb-6 inline-flex p-6 rounded-full bg-kong-bg-light/50">
       <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 text-kong-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
       </svg>
     </div>
     
     <!-- Title -->
     <h1 class="text-3xl font-bold text-kong-text-primary mb-4">Advanced Wallet Data Coming Soon!</h1>
     
     <!-- Description -->
     <p class="text-kong-text-secondary text-lg mb-8">
       We're working hard to bring you advanced wallet features on the KongSwap. 
       Stay tuned for a seamless token management experience.
     </p>
     
     <!-- Progress Indicator -->
     <div class="w-full bg-kong-border h-2 rounded-full mb-4 overflow-hidden">
       <div class="bg-kong-accent-blue h-full rounded-full w-full relative overflow-hidden">
         <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"></div>
       </div>
     </div>
     
     <p class="text-kong-text-secondary">Development in progress - 98% complete</p>
   </Panel>
 </div>
{/if}
