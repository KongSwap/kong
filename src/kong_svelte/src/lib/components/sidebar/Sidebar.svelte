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
          className="sidebar-panel !bg-kong-bg-dark"
        >
          <div class="sidebar-layout">
            <!-- Header Section -->
            <header class="sidebar-header">
              <SidebarHeader {onClose} {activeTab} {setActiveTab} />
            </header>

            <!-- Main Content Section -->
            <main class="sidebar-content px-2 !rounded-t-none">
              {#if !$auth.isConnected}
                <WalletProvider
                  on:login={async () => {
                    await tick();
                    setActiveTab("tokens");
                  }}
                />
              {:else}
                <div class="content-container bg-kong-bg-light !rounded-t-none border-l border-b border-r border-kong-border/50">
                  {#if activeTab === "tokens"}
                    <TokenList tokens={$tokens || []} />
                  {:else if activeTab === "pools"}
                    <PoolList pools={$pools || []} on:close={handleClose} />
                  {:else if activeTab === "history"}
                    <TransactionHistory transactions={$transactions || []} />
                  {/if}
                </div>
              {/if}
            </main>

            <!-- Footer Section -->
            <footer class="border-t border-kong-border pt-1 mx-2">
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
    @apply p-2 flex flex-col gap-2 rounded-lg;
  }
</style>
