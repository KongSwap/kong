<!-- src/kong_svelte/src/lib/components/nav/Sidebar.svelte -->
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Panel from "$lib/components/common/Panel.svelte";
  import WalletProvider from "$lib/components/sidebar/WalletProvider.svelte";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";
  import TokenList from "./TokenList.svelte";
  import SocialSection from "./SocialSection.svelte";
  import TransactionHistory from "./TransactionHistory.svelte";
  import PoolList from "./PoolList.svelte";
  import { kongDB } from "$lib/services/db";
  import { liveQuery } from "dexie";
  import { auth } from "$lib/services/auth";
  import { tick } from "svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";

  export let sidebarOpen: boolean;
  export let onClose: () => void;

  let activeTab: "tokens" | "pools" | "history" = "tokens";
  let isExpanded = false;
  let isMobile = false;

  // Subscribe to sidebar store
  sidebarStore.subscribe(state => {
    isExpanded = state.isExpanded;
  });

  onMount(() => {
    if (browser) {
      activeTab = (localStorage.getItem("sidebarActiveTab") as "tokens" | "pools" | "history") || "tokens";
      const updateDimensions = () => {
        isMobile = window.innerWidth <= 768;
      };

      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  });

  // Live database subscriptions
  const tokens = liveQuery(() => kongDB.tokens.toArray());
  const pools = liveQuery(() => kongDB.pools.toArray());
  const transactions = liveQuery(() => kongDB.transactions.toArray());

  function handleClose() {
    sidebarStore.collapse();
    onClose();
  }

  function setActiveTab(tab: "tokens" | "pools" | "history") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem("sidebarActiveTab", tab);
    }
  }
</script>

{#if sidebarOpen}
  <div
    class="sidebar-overlay"
    role="dialog"
    aria-modal="true"
    transition:fade={{ duration: 200 }}
  >
    <button
      class="overlay-close"
      on:click={handleClose}
      aria-label="Close sidebar"
    />
    <div
      class={`sidebar-wrapper ${isExpanded ? 'expanded' : ''}`}
      transition:fly={{ x: 300, duration: 200, easing: cubicOut }}
    >
      <Panel
        width="100%"
        height="100%"
        className="sidebar-panel"
      >
        <div class="sidebar-layout">
          <header class="sidebar-header">
            <SidebarHeader {onClose} {activeTab} {setActiveTab} />
          </header>

          <div class="sidebar-content">
            {#if !$auth.isConnected}
              <WalletProvider
                on:login={async () => {
                  await tick();
                  setActiveTab("tokens");
                }}
              />
            {:else if activeTab === "tokens"}
              <TokenList tokens={$tokens || []} />
            {:else if activeTab === "pools"}
              <PoolList pools={$pools || []} />
            {:else if activeTab === "history"}
              <TransactionHistory transactions={$transactions || []} />
            {/if}
          </div>

          <footer class="sidebar-footer">
            <SocialSection />
          </footer>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 1rem;
  }

  .sidebar-wrapper {
    position: relative;
    height: calc(100% - 2rem);
    width: 527px;
    transition: all 0.3s ease-out;
  }

  .sidebar-wrapper.expanded {
    width: calc(100% - 2rem);
    height: calc(100% - 2rem);
  }

  .sidebar-wrapper :global(.panel) {
    backdrop-filter: blur(20px);
    height: 100%;
  }

  .sidebar-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .sidebar-header {
    flex-shrink: 0;
  }

  .sidebar-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sidebar-footer {
    flex-shrink: 0;
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .overlay-close {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      width: 100%;
      height: 100%;
    }

    .sidebar-overlay {
      padding: 0;
    }
  }
</style>
