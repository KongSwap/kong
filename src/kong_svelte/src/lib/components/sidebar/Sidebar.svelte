<script lang="ts">
  import { fade } from "svelte/transition";
  import { browser } from "$app/environment";
  import Panel from "$lib/components/common/Panel.svelte";
  import { auth } from "$lib/services/auth";
  import { tick } from "svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";
  import { fly } from 'svelte/transition';
  import { userTokens } from "$lib/stores/userTokens";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";

  // Define props
  const { onClose } = $props<{ onClose: () => void }>();

  // State management using runes - using let for mutable state
  let activeTab = $state<"tokens" | "pools" | "history">("tokens");
  let isExpanded = $state(false);

  // Dynamic component references - using let for mutable state
  let WalletProviderComponent = $state<any>(null);
  let TokenListComponent = $state<any>(null);
  let PoolListComponent = $state<any>(null);
  let TransactionHistoryComponent = $state<any>(null);

  // Track component loading states
  let componentsLoading = $state({
    wallet: false,
    tokens: false,
    pools: false,
    history: false
  });

  // Update isExpanded when sidebarStore changes
  $effect(() => {
    // Correctly subscribe to the store value using the $ syntax
    isExpanded = $sidebarStore.isExpanded;
  });

  // Initialize from localStorage when mounted
  $effect(() => {
    if (browser) {
      const savedTab = localStorage.getItem("sidebarActiveTab") as "tokens" | "pools" | "history";
      if (savedTab) {
        activeTab = savedTab;
      }
    }
  });
  
  // Handle cleanup when component is destroyed
  $effect.root(() => {
    return () => {
      // Clear component references
      WalletProviderComponent = null;
      TokenListComponent = null;
      PoolListComponent = null;
      TransactionHistoryComponent = null;
    };
  });

  // Add a flag to track initial render
  let isInitialRender = $state(true);

  // Track whether sidebar is open to avoid re-renders caused by isOpen changes
  let isOpen = $state(false);

  // Track sidebar open state safely
  $effect(() => {
    isOpen = $sidebarStore.isOpen;
    
    // Only load components if the sidebar is open
    if ($sidebarStore.isOpen && !isInitialRender) {
      // Defer component loading slightly to improve performance on open
      setTimeout(() => {
        if (!$auth.isConnected) {
          loadWalletProvider();
        } else {
          // Preload the active component
          switch (activeTab) {
            case "tokens": loadTokenList(); break;
            case "pools": loadPoolList(); break;
            case "history": loadTransactionHistory(); break;
          }
        }
      }, 50);
    }
    
    isInitialRender = false;
  });

  // Effect to handle wallet provider loading when not connected
  $effect(() => {
    if (isOpen && !$auth.isConnected && !WalletProviderComponent && !componentsLoading.wallet) {
      loadWalletProvider();
    }
  });

  // Add a new effect to handle tab changes
  $effect(() => {
    // Only proceed if sidebar is open and user is connected
    if (!isOpen || !$auth.isConnected) return;
    
    // Load component based on active tab
    switch (activeTab) {
      case "tokens": loadTokenList(); break;
      case "pools": loadPoolList(); break;
      case "history": loadTransactionHistory(); break;
    }
  });

  // Component loading utility functions 
  async function loadComponent<T>(
    importFn: () => Promise<any>, 
    key: keyof typeof componentsLoading
  ): Promise<T> {
    // Prevent duplicate loads
    if (componentsLoading[key]) return Promise.resolve(null) as Promise<T>;
    
    try {
      // Set loading state first, separately from async operation
      componentsLoading = { ...componentsLoading, [key]: true };
      
      const module = await importFn();
      return module.default;
    } catch (error) {
      console.error(`Failed to load component: ${key}`, error);
      return null as T;
    } finally {
      // Only update if we haven't already changed to another state
      componentsLoading = { ...componentsLoading, [key]: false };
    }
  }
  
  // Change component loading functions to reduce reactivity
  async function loadWalletProvider() {
    if (WalletProviderComponent || componentsLoading.wallet) return;
    
    try {
      const component = await loadComponent(
        () => import("$lib/components/sidebar/WalletProvider.svelte"),
        'wallet'
      );
      WalletProviderComponent = component;
    } catch (e) {
      console.error("Failed to load wallet provider", e);
    }
  }

  async function loadTokenList() {
    if (TokenListComponent || componentsLoading.tokens) return;
    
    try {
      const component = await loadComponent(
        () => import("$lib/components/sidebar/TokenList.svelte"),
        'tokens'
      );
      TokenListComponent = component;
    } catch (e) {
      console.error("Failed to load token list", e);
    }
  }

  async function loadPoolList() {
    if (PoolListComponent || componentsLoading.pools) return;
    
    try {
      const component = await loadComponent(
        () => import("$lib/components/sidebar/PoolList.svelte"),
        'pools'
      );
      PoolListComponent = component;
    } catch (e) {
      console.error("Failed to load pool list", e);
    }
  }

  async function loadTransactionHistory() {
    if (TransactionHistoryComponent || componentsLoading.history) return;
    
    try {
      const component = await loadComponent(
        () => import("$lib/components/sidebar/TransactionHistory.svelte"),
        'history'
      );
      TransactionHistoryComponent = component;
    } catch (e) {
      console.error("Failed to load transaction history", e);
    }
  }

  // Modify the UI interaction function to be more efficient
  function handleClose() {
    // Use a more direct approach
    sidebarStore.collapse();
  }

  function setActiveTab(tab: "tokens" | "pools" | "history") {
    if (activeTab === tab) return; // Prevent unnecessary updates
    
    // Set the active tab
    activeTab = tab;
    
    // Save to localStorage if browser is available
    if (browser) {
      localStorage.setItem("sidebarActiveTab", tab);
    }
    
    // Explicitly trigger component loading for the new tab
    if ($auth.isConnected) {
      switch (tab) {
        case "tokens": 
          // Use setTimeout to break potential reactive loop
          setTimeout(() => loadTokenList(), 0); 
          break;
        case "pools": 
          setTimeout(() => loadPoolList(), 0);
          break;
        case "history": 
          setTimeout(() => loadTransactionHistory(), 0);
          break;
      }
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 w-full h-screen md:static md:w-auto md:h-auto">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-zoom-out pointer-events-auto md:hidden"
      in:fade|local={{ duration: 150, delay: 50 }}
      out:fade|local={{ duration: 150 }}
      on:click={handleClose}
      role="button"
      tabindex="-1"
      aria-label="Close sidebar"
    />
    {#if !$auth.isConnected}
      {#if componentsLoading.wallet}
        <div class="fixed inset-0 z-[2] flex items-center justify-center text-kong-text-primary">
          <LoadingIndicator text="Loading wallet provider..." />
        </div>
      {:else if WalletProviderComponent}
        <svelte:component
          this={WalletProviderComponent}
          on:login={async () => {
            await tick();
            setActiveTab("tokens");
          }}
        />
      {/if}
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
          in:fly|local={{ x: 20, duration: 150, delay: 50 }}
          out:fly|local={{ x: 20, duration: 150 }}
        >
          <Panel
            width="100%"
            height="100%"
            variant="solid"
            className="sidebar-panel !bg-kong-bg-dark !py-0"
            isSidebar={true}
          >
            <div
              class="grid grid-rows-auto-1fr-auto flex-1 min-h-full overflow-hidden !rounded-b-lg"
            >
              <!-- Header Section -->
              <header class="min-h-0">
                <SidebarHeader {onClose} {activeTab} {setActiveTab} />
              </header>

              <!-- Main Content Section -->
              <main class="min-h-0 px-2 flex-1">
                <div
                  class="flex flex-col flex-1 h-full rounded-lg bg-kong-bg-light !rounded-t-none border-l border-b border-r border-kong-border"
                >
                  {#if activeTab === "tokens"}
                    {#if componentsLoading.tokens}
                      <div class="flex flex-col justify-center items-center h-[calc(100vh-180px)] md:h-[calc(100vh-220px)]">
                        <LoadingIndicator text="Loading tokens..." />
                      </div>
                    {:else if TokenListComponent}
                      <svelte:component this={TokenListComponent} tokens={$userTokens.tokens} />
                    {/if}
                  {:else if activeTab === "pools"}
                    {#if componentsLoading.pools}
                      <div class="flex flex-col justify-center items-center h-[calc(100vh-180px)] md:h-[calc(100vh-220px)]">
                        <LoadingIndicator text="Loading pools..." />
                      </div>
                    {:else if PoolListComponent}
                      <svelte:component this={PoolListComponent} on:close={handleClose} />
                    {/if}
                  {:else if activeTab === "history"}
                    {#if componentsLoading.history}
                      <div class="flex flex-col justify-center items-center h-[calc(100vh-180px)] md:h-[calc(100vh-220px)]">
                        <LoadingIndicator text="Loading transactions..." />
                      </div>
                    {:else if TransactionHistoryComponent}
                      <svelte:component this={TransactionHistoryComponent} />
                    {/if}
                  {/if}
                </div>
              </main>

              <!-- Footer Section -->
              <footer
                class="px-4 pt-1 border-t border-kong-border/30 z-10 bg-kong-bg-dark"
              >
                <div class="flex justify-end gap-x-2">
                  &nbsp;
                </div>
              </footer>
            </div>
          </Panel>
        </div>
      </div>
    {/if}
  </div>
{/if}

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
