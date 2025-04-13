<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { auth } from "$lib/stores/auth";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import ConfirmLiquidityModal from "$lib/components/liquidity/modals/ConfirmLiquidityModal.svelte";
  
  // Import tab components
  import PoolOverview from "./PoolOverview.svelte";
  import AddLiquidity from "./AddLiquidity.svelte";
  import RemoveLiquidity from "./RemoveLiquidity.svelte";
  import Earnings from "./Earnings.svelte";
  import SendTokens from "./SendTokens.svelte";

  const dispatch = createEventDispatcher();

  export let pool: any;
  export let showModal = false;

  let token0: any = null;
  let token1: any = null;
  let lastPoolSymbols = { address_0: "", address_1: "" };
  let showConfirmModal = false;
  let activeTab: "overview" | "remove" | "add" | "earnings" | "send" = "overview";

  $: if (
    pool &&
    (pool.address_0 !== lastPoolSymbols.address_0 ||
      pool.address_1 !== lastPoolSymbols.address_1)
  ) {
    lastPoolSymbols = { address_0: pool.address_0, address_1: pool.address_1 };
    fetchTokenData();
  }

  async function fetchTokenData() {
    try {
      const tokensData = await fetchTokensByCanisterId([
        pool.address_0,
        pool.address_1,
      ]);
      token0 =
        tokensData.find((t: any) => t.canister_id === pool.address_0) || null;
      token1 =
        tokensData.find((t: any) => t.canister_id === pool.address_1) || null;
      
      // Initialize the liquidity store with the tokens
      if (token0 && token1) {
        liquidityStore.setToken(0, token0);
        liquidityStore.setToken(1, token1);
        
        // Load token balances
        loadBalances([token0, token1], auth.pnp.account?.owner?.toString(), true);
      }
    } catch (e) {
      console.error("Error fetching token data by canister id:", e);
      token0 = null;
      token1 = null;
    }
  }

  // Reset state when modal opens/closes
  $: if (!showModal) {
    resetState();
    dispatch("liquidityRemoved");
  } else if (showModal && pool.initialTab) {
    // Set the active tab based on the initialTab property
    activeTab = pool.initialTab;
  }

  function resetState() {
    activeTab = "overview";
    showConfirmModal = false;
    liquidityStore.resetAmounts();
  }

  function handleShowConfirmModal() {
    showConfirmModal = true;
  }
</script>

<Modal
  isOpen={showModal}
  onClose={() => {
    showModal = false;
  }}
  variant="solid"
  width="min(420px, 95vw)"
  height="auto"
  className="!flex !flex-col !max-h-[90vh]"
  isPadded={false}
>
  <div slot="title" class="modal-header">
    <div class="flex items-center gap-3">
      <TokenImages tokens={[token0, token1]} size={24} overlap={true} />
      <h2 class="text-lg font-medium">{pool.symbol_0}/{pool.symbol_1}</h2>
    </div>
  </div>

  <div class="tab-navigation">
    <button
      class="tab-button {activeTab === 'overview' ? 'active' : ''}"
      on:click={() => (activeTab = "overview")}
    >
      Overview
    </button>
    <button
      class="tab-button {activeTab === 'add' ? 'active' : ''}"
      on:click={() => (activeTab = "add")}
    >
      Add
    </button>
    <button
      class="tab-button {activeTab === 'remove' ? 'active' : ''}"
      on:click={() => (activeTab = "remove")}
    >
      Remove
    </button>
    <button
      class="tab-button {activeTab === 'earnings' ? 'active' : ''}"
      on:click={() => (activeTab = "earnings")}
    >
      Earnings
    </button>
    <button
      class="tab-button {activeTab === 'send' ? 'active' : ''}"
      on:click={() => (activeTab = "send")}
    >
      Send
    </button>
  </div>

  <div class="pool-details">
    <div class="pool-content">
      {#if activeTab === "overview"}
        <PoolOverview {pool} {token0} {token1} />
      {:else if activeTab === "earnings"}
        <Earnings />
      {:else if activeTab === "add"}
        <AddLiquidity 
          {pool} 
          {token0} 
          {token1} 
          on:showConfirmModal={handleShowConfirmModal} 
        />
      {:else if activeTab === "send"}
        <SendTokens
          {pool}
          {token0}
          {token1}
          on:tokensSent={() => {
            dispatch("liquidityRemoved");
            showModal = false;
          }}
        />
      {:else}
        <RemoveLiquidity 
          {pool} 
          {token0} 
          {token1} 
          on:close={() => showModal = false} 
          on:liquidityRemoved={() => dispatch("liquidityRemoved")} 
        />
      {/if}
    </div>
  </div>
</Modal>

{#if showConfirmModal}
  <ConfirmLiquidityModal
    isCreatingPool={false}
    show={showConfirmModal}
    onClose={() => {
      liquidityStore.resetAmounts();
      showConfirmModal = false;
      resetState();
    }}
    on:liquidityAdded={() => {
      showConfirmModal = false;
      showModal = false;
      dispatch("liquidityAdded");
    }}
    modalKey={`confirm-liquidity-${pool.address_0}-${pool.address_1}`}
    target="#modals"
  />
{/if}

<style lang="postcss">
  .modal-header {
    @apply flex flex-col gap-2;
  }

  .tab-navigation {
    @apply flex border-b border-kong-border/20 -mt-2;
  }

  .tab-button {
    @apply px-3 py-2 text-sm font-medium text-kong-text-primary/60 relative
           transition-all duration-200 hover:text-kong-text-primary;
  }

  .tab-button.active {
    @apply text-kong-text-primary;
  }

  .tab-button.active::after {
    content: "";
    @apply absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full;
  }

  .pool-details {
    @apply flex flex-col flex-1 overflow-hidden;
  }

  .pool-content {
    @apply p-4 overflow-y-auto;
  }

  @media (max-width: 640px) {
    .pool-content {
      @apply pb-6;
    }
  }
</style> 