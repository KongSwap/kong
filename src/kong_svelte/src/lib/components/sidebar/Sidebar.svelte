<script lang="ts">
  import { fade } from "svelte/transition";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import Panel from "$lib/components/common/Panel.svelte";
  import { auth } from "$lib/services/auth";
  import { tick } from "svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";
  import ButtonV2 from "../common/ButtonV2.svelte";
  import { fly } from 'svelte/transition';
  import { Loader2 } from "lucide-svelte";
  import { Coins } from "lucide-svelte";
    import { loadBalances } from "$lib/services/tokens";

  let WalletProviderComponent: any;
  let AddCustomTokenModalComponent: any;
  let TokenListComponent: any;
  let PoolListComponent: any;
  let TransactionHistoryComponent: any;
  let ManageTokensModalComponent: any;

  // Keep track of component loading promises
  let loadingPromises: Promise<any>[] = [];

  async function loadComponent(importFn: () => Promise<any>) {
    const promise = importFn();
    loadingPromises = [...loadingPromises, promise];
    try {
      const module = await promise;
      return module.default;
    } finally {
      loadingPromises = loadingPromises.filter(p => p !== promise);
    }
  }

  async function loadWalletProvider() {
    WalletProviderComponent = await loadComponent(() => 
      import("$lib/components/sidebar/WalletProvider.svelte")
    );
  }

  async function loadTokenList() {
    TokenListComponent = await loadComponent(() => 
      import("./TokenList.svelte")
    );
  }

  async function loadPoolList() {
    PoolListComponent = await loadComponent(() => 
      import("./PoolList.svelte")
    );
  }

  async function loadTransactionHistory() {
    TransactionHistoryComponent = await loadComponent(() => 
      import("./TransactionHistory.svelte")
    );
  }

  async function loadManageTokensModal() {
    ManageTokensModalComponent = await loadComponent(() => 
      import("./ManageTokensModal.svelte")
    );
  }

  // Cleanup function
  onDestroy(() => {
    // Clear component references
    WalletProviderComponent = null;
    AddCustomTokenModalComponent = null;
    TokenListComponent = null;
    PoolListComponent = null;
    TransactionHistoryComponent = null;
    ManageTokensModalComponent = null;
    
    // Cancel any pending loads
    loadingPromises = [];
  });

  export let onClose: () => void;

  let activeTab: "tokens" | "pools" | "history" = "tokens";
  let isExpanded = false;
  let showAddTokenModal = false;
  let showManageTokensModal = false;

  sidebarStore.subscribe((state) => {
    isExpanded = state.isExpanded;
  });

  onMount(() => {
    if (browser) {
      activeTab =
        (localStorage.getItem("sidebarActiveTab") as
          | "tokens"
          | "pools"
          | "history") || "tokens";
    }
  });

  function handleClose() {
    sidebarStore.collapse();
  }

  function setActiveTab(tab: "tokens" | "pools" | "history") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem("sidebarActiveTab", tab);
    }
  }

$: if (showManageTokensModal === false) {
  loadBalances(auth.pnp?.account?.principal?.toText(), { forceRefresh: true });
}
</script>

{#key $sidebarStore.isOpen}
  <div class="fixed inset-0 w-full h-screen md:static md:w-auto md:h-auto">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-zoom-out pointer-events-auto md:hidden"
      in:fade|local={{ duration: 200 }}
      out:fade|local={{ duration: 200 }}
      on:click={handleClose}
      role="button"
      tabindex="-1"
      aria-label="Close sidebar"
    />
    {#if !$auth.isConnected}
      {#await loadWalletProvider()}
        <div class="fixed inset-0 z-[2] flex items-center justify-center text-kong-text-primary">Loading...</div>
      {:then}
        {#if WalletProviderComponent}
          <svelte:component
            this={WalletProviderComponent}
            on:login={async () => {
              await tick();
              setActiveTab("tokens");
            }}
          />
        {/if}
      {/await}
    {:else}
      <div
        class="fixed inset-0 z-[2] isolate pointer-events-none"
        role="dialog"
        aria-modal="true"
      >
        <div
          class={`fixed right-0 top-0 bottom-0 w-full md:right-4 md:top-4 md:bottom-4 md:w-[527px] grid transform-gpu backface-hidden pointer-events-auto perspective-1000 ${
            isExpanded ? "inset-0 w-auto" : ""
          }`}
          in:fly={{ x: 20, duration: 200 }}
          out:fly={{ x: 20, duration: 200 }}
        >
          <Panel
            width="100%"
            height="100%"
            variant="solid"
            className="sidebar-panel !bg-kong-bg-dark !py-0"
          >
            <div
              class="grid grid-rows-auto-1fr-auto flex-1 min-h-full overflow-hidden !rounded-b-lg"
            >
              <!-- Header Section -->
              <header class="min-h-0">
                <SidebarHeader {onClose} {activeTab} {setActiveTab} />
              </header>

              <!-- Main Content Section -->
              <main class="min-h-0 px-2 !rounded-t-none !rounded-b-lg flex-1">
                <div
                  class="flex flex-col flex-1 h-full gap-1 rounded-lg bg-kong-bg-light !rounded-t-none border-l !rounded-b-lg border-b border-r border-kong-border"
                >
                  {#if activeTab === "tokens"}
                    {#await loadTokenList()}
                      <div class="flex flex-col justify-center items-center min-h-[87dvh]">
                        <Loader2 class="animate-spin" size={20} />
                        <p>Loading tokens...</p>
                      </div>
                    {:then}
                      {#if TokenListComponent}
                        <svelte:component this={TokenListComponent} />
                      {/if}
                    {/await}
                  {:else if activeTab === "pools"}
                    {#await loadPoolList()}
                      <div class="flex flex-col justify-center items-center min-h-[87dvh]">
                        <Loader2 class="animate-spin" size={20} />
                        <p>Loading pools...</p>
                      </div>
                    {:then}
                      {#if PoolListComponent}
                        <svelte:component this={PoolListComponent} on:close={handleClose} />
                      {/if}
                    {/await}
                  {:else if activeTab === "history"}
                    {#await loadTransactionHistory()}
                      <div class="flex flex-col justify-center items-center min-h-[87dvh]">
                        <Loader2 class="animate-spin" size={20} />
                        <p>Loading transactions...</p>
                      </div>
                    {:then}
                      {#if TransactionHistoryComponent}
                        <svelte:component this={TransactionHistoryComponent} />
                      {/if}
                    {/await}
                  {/if}
                </div>
              </main>

              <!-- Footer Section -->
              <footer
                class="px-4 pt-1 border-t border-kong-border/30 z-10 bg-kong-bg-dark"
              >
                <div class="flex justify-end gap-x-2">
                  <ButtonV2
                    variant="transparent"
                    theme="primary"
                    className="add-token-button mb-1 !text-kong-text-primary/50"
                    on:click={() => (showManageTokensModal = true)}
                  >
                    <div class="flex items-center gap-x-2">
                      <Coins size={16} />
                      Manage Tokens
                    </div>
                  </ButtonV2>
                </div>
              </footer>
            </div>
          </Panel>

          {#if showManageTokensModal}
            {#await loadManageTokensModal()}
              <!-- Optional loading state -->
            {:then}
              {#if ManageTokensModalComponent}
                <svelte:component
                  this={ManageTokensModalComponent}
                  bind:isOpen={showManageTokensModal}
                />
              {/if}
            {/await}
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/key}

<style scoped lang="postcss">
  :global(.wallet-modal) {
    @apply relative overflow-hidden;
    background: linear-gradient(180deg, #0b1026 0%, #0a0f1f 100%);
  }

  :global(.wallet-modal::before) {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle at 20% 35%,
        rgba(51, 153, 255, 0.15) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 85% 24%,
        rgba(0, 217, 255, 0.12) 0%,
        transparent 45%
      ),
      radial-gradient(
        circle at 10% 55%,
        rgba(51, 153, 255, 0.15) 0%,
        transparent 45%
      ),
      radial-gradient(
        circle at 70% 75%,
        rgba(51, 153, 255, 0.12) 0%,
        transparent 40%
      );
    pointer-events: none;
    opacity: 0.6;
  }

  :global(.wallet-modal::after) {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(
        1.5px 1.5px at 10% 10%,
        rgba(255, 255, 255, 0.9) 0%,
        transparent 100%
      ),
      radial-gradient(
        1.5px 1.5px at 20% 20%,
        rgba(255, 255, 255, 0.8) 0%,
        transparent 100%
      ),
      radial-gradient(
        2px 2px at 30% 30%,
        rgba(255, 255, 255, 0.9) 0%,
        transparent 100%
      ),
      radial-gradient(
        2px 2px at 40% 40%,
        rgba(255, 255, 255, 0.8) 0%,
        transparent 100%
      ),
      radial-gradient(
        1px 1px at 50% 50%,
        rgba(255, 255, 255, 0.7) 0%,
        transparent 100%
      ),
      radial-gradient(
        1.5px 1.5px at 60% 60%,
        rgba(255, 255, 255, 0.8) 0%,
        transparent 100%
      ),
      radial-gradient(
        2px 2px at 70% 70%,
        rgba(255, 255, 255, 0.9) 0%,
        transparent 100%
      ),
      radial-gradient(
        1px 1px at 80% 80%,
        rgba(255, 255, 255, 0.8) 0%,
        transparent 100%
      ),
      radial-gradient(
        1.5px 1.5px at 90% 90%,
        rgba(255, 255, 255, 0.9) 0%,
        transparent 100%
      );
    background-size: 250px 250px;
    background-repeat: repeat;
    pointer-events: none;
    opacity: 0.5;
    animation: space-twinkle 60s linear infinite;
  }

  /* Add a third layer for more depth */
  :global(.wallet-modal .modal-body::before) {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
        1px 1px at 15% 15%,
        rgba(255, 255, 255, 0.7) 0%,
        transparent 100%
      ),
      radial-gradient(
        1px 1px at 35% 35%,
        rgba(255, 255, 255, 0.7) 0%,
        transparent 100%
      ),
      radial-gradient(
        1px 1px at 55% 55%,
        rgba(255, 255, 255, 0.7) 0%,
        transparent 100%
      ),
      radial-gradient(
        1px 1px at 75% 75%,
        rgba(255, 255, 255, 0.7) 0%,
        transparent 100%
      );
    background-size: 150px 150px;
    background-repeat: repeat;
    pointer-events: none;
    opacity: 0.3;
    animation: space-twinkle-reverse 45s linear infinite;
  }

  @keyframes space-twinkle {
    0% {
      transform: translateY(0) rotate(0deg);
    }
    100% {
      transform: translateY(-250px) rotate(5deg);
    }
  }

  @keyframes space-twinkle-reverse {
    0% {
      transform: translateY(0) rotate(0deg);
    }
    100% {
      transform: translateY(-150px) rotate(-3deg);
    }
  }

  :global(.wallet-modal .modal-body) {
    @apply relative z-10;
  }

  :global(.wallet-modal header) {
    @apply !px-6 !py-4 relative z-10;
    backdrop-filter: blur(8px);
  }

  :global(.wallet-modal header h2) {
    @apply text-xl font-semibold text-kong-text-primary;
  }

  .wallet-connect-container {
    @apply flex flex-col gap-6 relative z-10;
  }

  .wallet-connect-header {
    @apply px-4 text-center;
  }

  .wallet-connect-body {
    @apply px-2;
  }

  .wallet-loading-placeholder {
    @apply fixed inset-0 z-[2] flex items-center justify-center text-kong-text-primary;
  }

  .loading-placeholder {
    @apply flex justify-center text-kong-text-primary py-4;
  }
</style>
