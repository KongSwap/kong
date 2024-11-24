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
        class={`sidebar-wrapper ${isExpanded ? 'expanded' : ''}`}
        in:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
        out:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
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
  </div>
{/if}

<style>
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
    padding: 1rem;
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

  .sidebar-footer {
    min-height: 0;
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .overlay-close {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    cursor: pointer;
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
</style>
