<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Panel from "$lib/components/common/Panel.svelte";
  import WalletProvider from "$lib/components/sidebar/WalletProvider.svelte";
  import TokenList from "./TokenList.svelte";
  import { kongDB } from "$lib/services/db";
  import { liveQuery } from "dexie";
  import { auth } from "$lib/services/auth";
  import { tick } from "svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";
  import TransactionHistory from "./TransactionHistory.svelte";
  import PoolList from "./PoolList.svelte";
  import AddCustomTokenModal from "./AddCustomTokenModal.svelte";
  import ButtonV2 from "../common/ButtonV2.svelte";
  import Modal from "$lib/components/common/Modal.svelte";

  export let onClose: () => void;

  let activeTab: "tokens" | "pools" | "history" = "tokens";
  let isExpanded = false;
  let isMobile = false;
  let showAddTokenModal = false;


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
      const updateDimensions = () => {
        isMobile = window.innerWidth <= 768;
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  });

  async function handleClose() {
    await sidebarStore.collapse();
  }

  function setActiveTab(tab: "tokens" | "pools" | "history") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem("sidebarActiveTab", tab);
    }
  }

  // Live database subscriptions with debug logging
  const tokens = liveQuery(async () => {
    const dbTokens = await kongDB.tokens.toArray();
    return dbTokens;
  });

  const pools = liveQuery(async () => {
    const dbPools = await kongDB.pools.toArray();
    return dbPools;
  });

  const transactions = liveQuery(async () => {
    const dbTransactions = await kongDB.transactions.toArray();
    return dbTransactions;
  });
</script>

{#if $sidebarStore.isOpen}
  <div class="sidebar-root">
    <div
      class="backdrop"
      in:fade|local={{ duration: 150 }}
      out:fade|local={{ duration: 150 }}
      on:click={handleClose}
      role="button"
      tabindex="-1"
      aria-label="Close sidebar"
    />
    {#if !$auth.isConnected}
      <Modal
        isOpen={true}
        title="Connect Wallet"
        onClose={handleClose}
        width="440px"
        height="auto"
        variant="transparent"
        className="wallet-modal"
      >
        <div class="wallet-connect-container">

          <div class="wallet-connect-body">
            <WalletProvider
              on:login={async () => {
                await tick();
                setActiveTab("tokens");
              }}
            />
          </div>
          <div class="wallet-connect-footer">
            <p class="text-xs text-kong-text-secondary text-center pb-4">
              Rumble in the crypto jungle at <a href="#" class="text-kong-primary hover:text-kong-primary-hover">KongSwap.io</a>.
            </p>
          </div>
        </div>
      </Modal>
    {:else}
      <div class="sidebar-container" role="dialog" aria-modal="true">
        <div
          class={`sidebar-wrapper ${isExpanded ? "expanded" : ""}`}
          in:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
          out:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
        >
          <Panel
            width="100%"
            height="100%"
            variant="solid"
            className="sidebar-panel !bg-kong-bg-dark !py-0"
          >
            <div class="sidebar-layout !rounded-b-lg">
              <!-- Header Section -->
              <header class="sidebar-header">
                <SidebarHeader {onClose} {activeTab} {setActiveTab} />
              </header>

              <!-- Main Content Section -->
              <main class="sidebar-content px-2 !rounded-t-none !rounded-b-lg">
                <div class="content-container bg-kong-bg-light !rounded-t-none border-l !rounded-b-lg border-b border-r border-kong-border">
                  {#if activeTab === "tokens"}
                    <TokenList tokens={$tokens || []} />
                  {:else if activeTab === "pools"}
                    <PoolList pools={$pools || []} on:close={handleClose} />
                  {:else if activeTab === "history"}
                    <TransactionHistory transactions={$transactions || []} />
                  {/if}
                </div>
              </main>

              <!-- Footer Section -->
              <footer class="border-t border-kong-border py-1 mx-2">
                <div class="flex justify-end">
                  <ButtonV2 
                    variant="transparent"
                    theme="accent-blue"
                    className="add-token-button" 
                    on:click={() => showAddTokenModal = true}
                  >
                    Import Token
                  </ButtonV2>
                </div>
              </footer>
            </div>
          </Panel>

          {#if showAddTokenModal}
            <AddCustomTokenModal
              on:close={() => (showAddTokenModal = false)}
            />
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style scoped lang="postcss">
  .sidebar-root {
    position: fixed;
    inset: 0;
    z-index: 100;
    isolation: isolate;
    pointer-events: none;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    pointer-events: auto;
    cursor: pointer;
  }

  .sidebar-container {
    position: fixed;
    inset: 0;
    z-index: 2;
    display: grid;
    pointer-events: none;
  }

  .sidebar-wrapper {
    position: fixed;
    inset: 1rem 1rem 1rem auto;
    width: 527px;
    height: calc(100vh - 2rem);
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
    display: grid;
    z-index: 2;
    pointer-events: auto;
  }

  .sidebar-wrapper.expanded {
    inset: 1rem;
    width: auto;
  }

  .sidebar-wrapper :global(.panel) {
    backdrop-filter: blur(20px);
    height: 100%;
    display: grid;
  }

  .sidebar-layout {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .sidebar-header {
    min-height: 0;
  }

  .sidebar-content {
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    display: grid;
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      inset: 0;
      width: 100%;
      height: 100vh;
    }

    .sidebar-wrapper.expanded {
      inset: 0;
    }
  }

  .content-container {
    @apply flex flex-col gap-2 rounded-lg;
  }

  .wallet-connect-container {
    @apply flex flex-col gap-6;
  }

  .wallet-connect-header {
    @apply px-4 text-center;
  }

  .wallet-connect-body {
    @apply px-2;
  }

  .wallet-connect-footer {
    @apply px-4 pt-2;
  }

  :global(.wallet-modal) {
    @apply relative overflow-hidden;
    background: linear-gradient(180deg, #0B1026 0%, #0A0F1F 100%);
  }

  :global(.wallet-modal::before) {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 20% 35%, rgba(51, 153, 255, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 85% 24%, rgba(0, 217, 255, 0.12) 0%, transparent 45%),
      radial-gradient(circle at 10% 55%, rgba(51, 153, 255, 0.15) 0%, transparent 45%),
      radial-gradient(circle at 70% 75%, rgba(51, 153, 255, 0.12) 0%, transparent 40%);
    pointer-events: none;
    opacity: 0.6;
  }

  :global(.wallet-modal::after) {
    content: '';
    position: absolute;
    inset: 0;
    background-image: 
      radial-gradient(1.5px 1.5px at 10% 10%, rgba(255, 255, 255, 0.9) 0%, transparent 100%),
      radial-gradient(1.5px 1.5px at 20% 20%, rgba(255, 255, 255, 0.8) 0%, transparent 100%),
      radial-gradient(2px 2px at 30% 30%, rgba(255, 255, 255, 0.9) 0%, transparent 100%),
      radial-gradient(2px 2px at 40% 40%, rgba(255, 255, 255, 0.8) 0%, transparent 100%),
      radial-gradient(1px 1px at 50% 50%, rgba(255, 255, 255, 0.7) 0%, transparent 100%),
      radial-gradient(1.5px 1.5px at 60% 60%, rgba(255, 255, 255, 0.8) 0%, transparent 100%),
      radial-gradient(2px 2px at 70% 70%, rgba(255, 255, 255, 0.9) 0%, transparent 100%),
      radial-gradient(1px 1px at 80% 80%, rgba(255, 255, 255, 0.8) 0%, transparent 100%),
      radial-gradient(1.5px 1.5px at 90% 90%, rgba(255, 255, 255, 0.9) 0%, transparent 100%);
    background-size: 250px 250px;
    background-repeat: repeat;
    pointer-events: none;
    opacity: 0.5;
    animation: space-twinkle 60s linear infinite;
  }

  /* Add a third layer for more depth */
  :global(.wallet-modal .modal-body::before) {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(1px 1px at 15% 15%, rgba(255, 255, 255, 0.7) 0%, transparent 100%),
      radial-gradient(1px 1px at 35% 35%, rgba(255, 255, 255, 0.7) 0%, transparent 100%),
      radial-gradient(1px 1px at 55% 55%, rgba(255, 255, 255, 0.7) 0%, transparent 100%),
      radial-gradient(1px 1px at 75% 75%, rgba(255, 255, 255, 0.7) 0%, transparent 100%);
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

  .wallet-connect-footer {
    @apply px-4 pt-2 border-t border-kong-border/30;
    backdrop-filter: blur(8px);
  }
</style>
