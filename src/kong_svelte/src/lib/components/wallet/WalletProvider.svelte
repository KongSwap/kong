<script context="module">
  import { browser } from "$app/environment";

  // Add global keyboard shortcut for search
  if (browser) {
    document.addEventListener("keydown", (e) => {
      // Focus search input when "/" is pressed and a modal is open
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeModalSearch = document.querySelector(
          '.linput[type="text"]',
        );
        if (activeModalSearch) {
          e.preventDefault();
          // @ts-ignore
          activeModalSearch.focus();
        }
      }
    });
  }
</script>

<script lang="ts">
  import { auth, selectedWalletId } from "$lib/stores/auth";
  import { isMobileBrowser, isPlugAvailable } from "$lib/utils/browser";
  import Modal from "$lib/components/common/Modal.svelte";
  import {
    createNamespacedStore,
    STORAGE_KEYS,
  } from "$lib/config/localForage.config";
  import { tooltip } from "$lib/actions/tooltip";
  import Badge from "$lib/components/common/Badge.svelte";
  import {
    X,
    Search,
    AlertCircle,
    Info,
    ExternalLink,
    Clock,
    Trash2,
    LogIn,
  } from "lucide-svelte";
  import { fly, fade, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { onMount, tick } from "svelte";

  // Storage configuration
  const authStorage = createNamespacedStore(STORAGE_KEYS.AUTH_NAMESPACE);
  const RECENT_WALLETS_KEY = "recentWallets";
  const MAX_RECENT_WALLETS = 5;

  interface WalletInfo {
    id: string;
    walletName: string;
    logo: string;
    chain: string;
    googleSignIn?: string;
    recommended?: boolean;
    unsupported?: boolean;
    website?: string;
  }

  interface RecentWallet {
    id: string;
    timestamp: number;
  }

  // Map available wallets to our WalletInfo structure
  const walletList: WalletInfo[] = auth.pnp
    .getEnabledWallets()
    .map((wallet) => ({
      id: wallet.id,
      walletName: wallet.walletName,
      logo: wallet.logo,
      chain: wallet.chain,
      googleSignIn: wallet.id === "nfid" ? "Sign in with Google" : undefined,
      recommended: wallet.id === "oisy", // Mark OISY as recommended
      unsupported: null,
      website: wallet.website,
    }));

  // Props
  const {
    isOpen = false,
    onClose = () => {},
    onLogin = () => {},
  } = $props<{
    isOpen?: boolean;
    onClose?: () => void;
    onLogin?: () => void;
  }>();

  // State
  let connecting = $state(false);
  let connectingWalletId = $state<string | null>(null);
  let abortController = $state(new AbortController());
  let isOnMobile = $state(false);
  let filteredWallets = $state(walletList);
  let errorMessage = $state<string | null>(null);
  let groupedWalletsByChain = $state<Record<string, WalletInfo[]>>({});
  let sortedChainsList = $state<string[]>([]);
  let searchQuery = $state("");
  let searchInputRef = $state<HTMLInputElement | null>(null);
  let connectingTimeout = $state<number | null>(null);
  let focusedWalletIndex = $state(-1);
  let recentWallets = $state<RecentWallet[]>([]);
  let showClearConfirm = $state(false);
  let showRecentWalletsSection = $state(true);
  let walletDataLoaded = $state(false);
  let showDebugInfo = $state(false);

  // Group wallets by chain
  function groupWalletsByChain(
    wallets: WalletInfo[],
  ): Record<string, WalletInfo[]> {
    const grouped: Record<string, WalletInfo[]> = {};

    wallets.forEach((wallet) => {
      if (!grouped[wallet.chain]) {
        grouped[wallet.chain] = [];
      }
      grouped[wallet.chain].push(wallet);
    });

    return grouped;
  }

  // Sort chains by priority (Internet Computer first, then alphabetically)
  function getSortedChains(chains: string[]): string[] {
    const priorityChain = "Internet Computer";
    return chains.sort((a, b) => {
      if (a === priorityChain) return -1;
      if (b === priorityChain) return 1;
      return a.localeCompare(b);
    });
  }

  // Format chain name for display
  function formatChainName(chain: string): string {
    return chain || "Other";
  }

  function closeModal() {
    // Reset state when closing
    errorMessage = null;
    connecting = false;
    connectingWalletId = null;
    searchQuery = "";
    focusedWalletIndex = -1;
    showClearConfirm = false;
    showDebugInfo = false;
    onClose();
  }

  // Format date for display
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  // Initialize on mount with retries
  onMount(async () => {
    if (browser) {
      isOnMobile = isMobileBrowser();

      // Initialize IndexedDB (localForage)
      await initializeStorage();

      setTimeout(() => {
        if (searchInputRef) searchInputRef.focus();
      }, 100);
    }
  });

  // Retry initialization with exponential backoff - Simplified
  async function initializeStorage() {
    // Removed retryCount, maxRetries
    // const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);

    try {
      // Directly attempt to load wallets
      await loadRecentWallets();
    } catch (err) {
      // Log error, loadRecentWallets already handles its own errors
      console.error("Error during initializeStorage wrapper:", err);
    }
  }

  async function loadRecentWallets() {
    try {
      // Only try to load from localForage
      const stored = await authStorage.getItem(RECENT_WALLETS_KEY);

      if (stored && Array.isArray(stored) && stored.length > 0) {
        recentWallets = stored;
        walletDataLoaded = true;
        console.log(
          "Loaded recent wallets from localForage (IndexedDB):",
          stored.length,
        );
        return; // Successfully loaded
      }

      console.log("No recent wallet data found in localForage");
      walletDataLoaded = true;
    } catch (err) {
      console.warn("Could not load recent wallets from localForage:", err);
      walletDataLoaded = true; // Mark as loaded even if there was an error
    }
  }

  async function saveRecentWallets() {
    try {
      // Create a plain JS copy to remove Svelte proxies before saving
      const plainWallets = JSON.parse(JSON.stringify(recentWallets));
      await authStorage.setItem(RECENT_WALLETS_KEY, plainWallets);
      console.log("Saved recent wallets to localForage:", plainWallets.length);
      return true;
    } catch (err) {
      // Use console.error for better visibility
      console.error("Could not save recent wallets to localForage:", err);
      return false;
    }
  }

  async function clearAllRecentWallets() {
    recentWallets = [];
    showClearConfirm = false;
    try {
      await authStorage.removeItem(RECENT_WALLETS_KEY);
      console.log("Cleared wallet data from localForage");
    } catch (err) {
      console.warn("Could not clear recent wallets from localForage:", err);
    }
  }

  async function removeRecentWallet(walletId: string) {
    // Update state immediately
    recentWallets = recentWallets.filter((wallet) => wallet.id !== walletId);

    // Save changes to localForage
    await saveRecentWallets();
  }

  $effect(() => {
    if (browser) {
      isOnMobile = isMobileBrowser();
    }
  });

  // Effect for handling filteredWallets based on searchQuery and plug availability
  $effect(() => {
    if (!browser) return;

    // Get base wallet list
    let rawWallets = isPlugAvailable()
      ? auth.pnp.getEnabledWallets()
      : auth.pnp.getEnabledWallets().filter((w) => w.id !== "plug");

    // Map raw wallets to WalletInfo structure
    let mappedWallets = rawWallets.map((wallet) => ({
      id: wallet.id,
      walletName: wallet.walletName,
      logo: wallet.logo,
      chain: wallet.chain,
      googleSignIn: wallet.id === "nfid" ? "Sign in with Google" : undefined,
      recommended: wallet.id === "oisy", // Keep consistent with initial mapping
      unsupported: null, // Keep consistent
      website: wallet.website,
    }));

    // Apply search filter if there's a query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      mappedWallets = mappedWallets.filter(
        (wallet) =>
          wallet.walletName.toLowerCase().includes(query) ||
          wallet.chain.toLowerCase().includes(query) ||
          (wallet.googleSignIn &&
            wallet.googleSignIn.toLowerCase().includes(query)),
      );
    }

    // Update state in a single batch to avoid cascading updates
    filteredWallets = mappedWallets; // Use mapped wallets here
    const newGrouped = groupWalletsByChain(mappedWallets); // Use mapped wallets here
    groupedWalletsByChain = newGrouped;
    sortedChainsList = getSortedChains(Object.keys(newGrouped));

    // Always show recent wallets section
    showRecentWalletsSection = true;

    // Reset focused wallet index when filter changes
    focusedWalletIndex = -1;
  });

  // Cleanup on destroy
  $effect(() => {
    // This cleanup will run when the component is destroyed
    return () => {
      // Clean up any pending connection state
      if (connecting) {
        connecting = false;
        abortController.abort();
        if (connectingTimeout) {
          clearTimeout(connectingTimeout);
          connectingTimeout = null;
        }
      }
    };
  });

  async function handleConnect(walletId: string) {
    if (!walletId || connecting || !browser) return;

    errorMessage = null;
    connectingWalletId = walletId;

    // Reset abort controller for new connection attempt
    abortController = new AbortController();

    try {
      connecting = true;
      selectedWalletId.set(walletId);

      // Add timeout to prevent hanging connections
      connectingTimeout = window.setTimeout(() => {
        abortController.abort();
        errorMessage = "Connection timeout. Please try again.";
        connecting = false;
        connectingWalletId = null;
      }, 30000) as unknown as number;

      await auth.connect(walletId);

      // Update recent wallets list
      const now = Date.now();
      // Remove this wallet if it's already in the list, then add it to the top
      const updatedWallets = [
        { id: walletId, timestamp: now },
        ...recentWallets.filter((w) => w.id !== walletId),
      ].slice(0, MAX_RECENT_WALLETS); // Keep only the MAX_RECENT_WALLETS most recent

      recentWallets = updatedWallets;

      // Save to storage - ONLY localForage
      try {
        await saveRecentWallets();
      } catch (error) {
        console.warn("Could not save wallets to localForage:", error);
      }

      if (connectingTimeout) {
        clearTimeout(connectingTimeout);
        connectingTimeout = null;
      }

      if ($auth.isConnected) {
        onLogin();
        closeModal();
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error("Failed to connect wallet:", error);
        errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to connect wallet. Please try again.";
        selectedWalletId.set("");
      }
    } finally {
      connecting = false;
      connectingWalletId = null;
      if (connectingTimeout) {
        clearTimeout(connectingTimeout);
        connectingTimeout = null;
      }
    }
  }

  // Ensure state is reset when modal closes
  $effect(() => {
    if (!isOpen && (connecting || connectingWalletId)) {
      connecting = false;
      connectingWalletId = null;
      abortController.abort();
      if (connectingTimeout) {
        clearTimeout(connectingTimeout);
        connectingTimeout = null;
      }
    }
  });

  // Get wallet count for a chain
  function getWalletCount(chain: string): number {
    return groupedWalletsByChain[chain]?.length || 0;
  }

  // Get wallet info by ID
  function getWalletById(walletId: string): WalletInfo | undefined {
    return walletList.find((wallet) => wallet.id === walletId);
  }

  // Get all wallets as a flat array for keyboard navigation
  function getAllWallets(): WalletInfo[] {
    return sortedChainsList.flatMap(
      (chain) => groupedWalletsByChain[chain] || [],
    );
  }

  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent) {
    const allWallets = getAllWallets();

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusedWalletIndex = Math.min(
        focusedWalletIndex + 1,
        allWallets.length - 1,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusedWalletIndex = Math.max(focusedWalletIndex - 1, -1);
    } else if (
      event.key === "Enter" &&
      focusedWalletIndex >= 0 &&
      focusedWalletIndex < allWallets.length
    ) {
      event.preventDefault();
      handleConnect(allWallets[focusedWalletIndex].id);
    } else if (event.key === "Escape") {
      if (showClearConfirm) {
        showClearConfirm = false;
      } else {
        closeModal();
      }
    }
  }

  // Check if a wallet is focused for keyboard navigation
  function isWalletFocused(walletId: string): boolean {
    if (focusedWalletIndex < 0) return false;
    const allWallets = getAllWallets();
    return allWallets[focusedWalletIndex]?.id === walletId;
  }
</script>

<Modal
  {isOpen}
  onClose={closeModal}
  closeOnEscape={!connecting}
  closeOnClickOutside={!connecting}
  className="!p-0 md:!p-4"
  width="min(800px, 95vw)"
  height="auto"
  minHeight="min(600px, 95vh)"
  isPadded={false}
>
  <svelte:fragment slot="title">
    <h2 class="text-2xl font-semibold modal-title flex items-center gap-2">
      <LogIn size={20} class="text-kong-primary" />
      Connect Wallet
    </h2>
  </svelte:fragment>

  <!-- Error Message -->
  {#if errorMessage}
    <div
      in:fly={{ y: -20, duration: 300, easing: quintOut }}
      out:fade={{ duration: 200 }}
      class="mx-4 my-3 flex items-center gap-2 p-3 rounded-lg bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/20 text-sm"
      role="alert"
    >
      <AlertCircle size={16} class="flex-shrink-0" />
      <span>{errorMessage}</span>
      <button
        class="ml-auto text-kong-accent-red/80 hover:text-kong-accent-red transition-colors"
        on:click={() => (errorMessage = null)}
        aria-label="Dismiss error"
      >
        <X size={14} />
      </button>
    </div>
  {/if}

  <!-- Clear All Recent Wallets Confirmation Dialog -->
  {#if showClearConfirm}
    <div
      in:fade={{ duration: 200 }}
      class="confirm-dialog fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
      on:click={() => (showClearConfirm = false)}
    >
      <div
        class="p-5 bg-kong-bg-dark rounded-xl border border-kong-border shadow-lg max-w-md w-full mx-4"
        in:fly={{ y: 20, duration: 300, easing: quintOut }}
        on:click|stopPropagation
      >
        <h3 class="text-xl font-bold text-kong-text-primary mb-3">
          Clear all recent wallets?
        </h3>
        <p class="text-kong-text-secondary mb-5">
          This will remove all your recently used wallets from history. This
          action cannot be undone.
        </p>

        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 rounded-lg border border-kong-border text-kong-text-secondary hover:bg-kong-bg-light/10 transition-colors"
            on:click={() => (showClearConfirm = false)}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-kong-accent-red text-white hover:bg-kong-accent-red-hover transition-colors"
            on:click={clearAllRecentWallets}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Wallet List -->
  <div
    class="wallet-list-container w-full h-full flex flex-col overflow-hidden"
  >
    <div class="wallet-list overflow-y-auto flex-1 scrollbar-custom px-1 sm:px-2">
      <!-- Recently Used Wallet Section -->
      {#if recentWallets.length > 0}
        <div class="recent-wallets mb-6 px-2 sm:px-0" in:fade={{ duration: 300 }}>
          <div class="flex items-center justify-between mb-2">
            <h3
              class="text-sm font-medium text-kong-text-primary flex items-center gap-2"
            >
              <Clock size={14} class="text-kong-primary" />
              <span>Recently Used</span>
            </h3>

            {#if recentWallets.length > 1}
              <button
                class="text-xs text-kong-text-secondary hover:text-kong-accent-red flex items-center gap-1.5 px-2 py-1 rounded hover:bg-kong-accent-red/10 transition-colors"
                on:click={() => (showClearConfirm = true)}
              >
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            {/if}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each recentWallets as recentWallet, i (recentWallet.id)}
              {@const wallet = getWalletById(recentWallet.id)}
              {#if wallet}
                <div
                  class="recent-wallet-card relative"
                  in:fade={{ duration: 200, delay: i * 50 }}
                >
                  <div
                    class="wallet-card group relative flex items-center gap-3 w-full p-3 sm:p-3.5 rounded-xl
                        {i === 0
                      ? 'border border-kong-primary/40 bg-kong-primary/5'
                      : 'border border-kong-border/30 bg-kong-bg-dark/30'}
                        will-change-transform transition-all duration-200 ease-out
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kong-primary
                        hover:border-kong-primary/100 hover:bg-kong-primary/10 hover:translate-y-[-2px] hover:shadow-lg
                        active:translate-y-0 active:shadow-md
                        cursor-pointer
                        {connectingWalletId === wallet.id
                      ? 'animate-pulse-slow'
                      : ''}"
                    on:click={() => !connecting && handleConnect(wallet.id)}
                    on:keydown={(e) =>
                      e.key === "Enter" &&
                      !connecting &&
                      handleConnect(wallet.id)}
                    role="button"
                    tabindex="0"
                    aria-busy={connectingWalletId === wallet.id}
                    class:opacity-50={connecting &&
                      connectingWalletId !== wallet.id}
                  >
                    <div
                      class="wallet-logo relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg overflow-hidden transition-transform duration-300 scale-105"
                    >
                      <div
                        class="logo-glow absolute inset-0 opacity-60 transition-opacity duration-300"
                      ></div>
                      <img
                        src={wallet.logo}
                        alt={wallet.walletName}
                        class="w-full h-full rounded-lg transition-all duration-300 dark:brightness-100 object-contain z-10 relative"
                      />
                      {#if connectingWalletId === wallet.id}
                        <div
                          class="absolute top-0 left-0 w-full h-full rounded-full border-2 border-transparent border-t-kong-accent-green border-r-kong-accent-green/30 border-b-kong-accent-green/10 animate-spin"
                        ></div>
                      {/if}
                    </div>

                    <div class="wallet-info flex-1 text-left min-w-0">
                      <div class="flex items-center flex-wrap gap-1.5">
                        <span
                          class="font-medium text-sm sm:text-base transition-colors duration-200 group-hover:text-kong-primary truncate"
                          >{wallet.walletName}</span
                        >
                        {#if wallet.recommended}
                          <Badge variant="blue" size="xs">Recommended</Badge>
                        {/if}
                      </div>

                      <span
                        class="text-kong-text-secondary text-xs block mt-0.5"
                      >
                        <span class="inline-flex items-center gap-1">
                          <Clock size={10} class="inline" />
                          {formatDate(recentWallet.timestamp)}
                        </span>
                      </span>
                    </div>

                    <div class="flex items-center">
                      <button
                        class="remove-wallet flex items-center justify-center w-7 h-7 rounded-full text-kong-text-secondary hover:text-kong-accent-red hover:bg-kong-accent-red/10 transition-all duration-200"
                        on:click|stopPropagation={() =>
                          removeRecentWallet(wallet.id)}
                        use:tooltip={{
                          text: "Remove from history",
                          direction: "left",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <!-- Search Input -->
      <div
        class="search-container mb-5 px-2 sm:px-0"
        transition:fade={{ duration: 200 }}
      >
        <div class="relative">
          <div
            class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-kong-text-secondary"
          >
            <Search size={16} />
          </div>
          <input
            bind:this={searchInputRef}
            bind:value={searchQuery}
            type="text"
            class="w-full py-2.5 pl-10 pr-4 bg-kong-bg-dark/70 border border-kong-border rounded-xl shadow-inner text-sm text-kong-text-primary focus:outline-none focus:ring-2 focus:ring-kong-primary/50 focus:border-kong-primary transition-all duration-200"
            placeholder="Search wallets..."
            on:keydown={handleKeyDown}
          />
          {#if searchQuery}
            <button
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-kong-text-secondary hover:text-kong-text-primary"
              on:click={() => {
                searchQuery = "";
                if (searchInputRef) searchInputRef.focus();
              }}
            >
              <X size={14} />
            </button>
          {/if}
          <div
            class="absolute right-3 top-2.5 opacity-60 text-xs bg-kong-bg-dark/50 px-1.5 py-0.5 rounded text-kong-text-secondary border border-kong-border-light/30"
          >
            <kbd class="font-mono">/</kbd>
          </div>
        </div>
      </div>

      {#if filteredWallets.length === 0}
        <div
          class="flex flex-col items-center justify-center py-8 text-kong-text-secondary"
          in:fade={{ duration: 300 }}
        >
          <div
            class="mb-4 p-4 rounded-full bg-kong-bg-dark/50 shadow-inner-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-kong-text-secondary/70"
            >
              <path d="M19.9 13.5a1.5 1.5 0 0 0 0-3v3Z"></path>
              <path
                d="M19.9 7.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13.9a2 2 0 0 0 2-2v-1.5"
              ></path>
              <path d="M13 6.5V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1.5"></path>
            </svg>
          </div>
          <p class="text-xl font-bold mb-2 text-kong-text-primary">
            No wallets found
          </p>
          <p class="text-sm">Try a different search term</p>
          {#if searchQuery}
            <button
              class="mt-4 px-4 py-2 bg-kong-primary text-kong-text-on-primary rounded-lg transition-all hover:bg-kong-primary-hover hover:scale-105 active:scale-100 shadow-md hover:shadow-lg"
              on:click={() => (searchQuery = "")}
            >
              Clear search
            </button>
          {/if}
        </div>
      {:else}
        <!-- Available Wallets Section -->
        <div class="available-wallets px-2 sm:px-0">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            {#each sortedChainsList as chain}
              <div
                class="chain-section flex flex-col"
                in:fade={{ duration: 300, delay: 100 }}
              >
                <div class="chain-header flex items-center mb-3 gap-2">
                  <h4
                    class="text-xs font-medium text-kong-text-secondary uppercase tracking-wide"
                  >
                    {formatChainName(chain)}
                  </h4>
                  <span
                    class="text-xs bg-kong-bg-light/20 text-kong-text-secondary px-1.5 py-0.5 rounded-full"
                  >
                    {getWalletCount(chain)}
                    {getWalletCount(chain) === 1 ? "wallet" : "wallets"}
                  </span>
                </div>

                <div class="wallets-grid flex flex-col gap-2">
                  {#each groupedWalletsByChain[chain] as wallet, i}
                    {@const walletIndex = getAllWallets().findIndex(
                      (w) => w.id === wallet.id,
                    )}
                    {@const isFocused = isWalletFocused(wallet.id)}
                    {@const isRecentWallet = recentWallets.some(
                      (rw) => rw.id === wallet.id,
                    )}

                    <div
                      class="wallet-card group relative flex items-center gap-3 w-full p-3 sm:p-4 rounded-xl border border-kong-border/30 bg-kong-bg-dark/30
                          will-change-transform transition-all duration-200 ease-out
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kong-primary
                          hover:border-kong-primary/100 hover:bg-kong-primary/10 hover:translate-y-[-2px] hover:shadow-lg
                          active:translate-y-0 active:shadow-md
                          cursor-pointer
                          {connectingWalletId === wallet.id
                        ? 'animate-pulse-slow'
                        : ''}
                          {isFocused
                        ? 'border-kong-primary bg-kong-primary/5 ring-1 ring-kong-primary/50'
                        : ''}
                          {isRecentWallet
                        ? 'opacity-60 hover:opacity-100'
                        : ''}"
                      style="--border-glow: rgba(var(--primary), 0.8);"
                      on:click={() => !connecting && handleConnect(wallet.id)}
                      on:keydown={(e) =>
                        e.key === "Enter" &&
                        !connecting &&
                        handleConnect(wallet.id)}
                      role="button"
                      tabindex="0"
                      aria-busy={connectingWalletId === wallet.id}
                      data-wallet-index={walletIndex}
                      class:opacity-50={connecting &&
                        connectingWalletId !== wallet.id}
                      in:fade={{ duration: 200, delay: i * 50 }}
                    >
                      <div
                        class="wallet-logo relative w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-110"
                      >
                        <div
                          class="logo-glow absolute inset-0 opacity-0 transition-opacity duration-300"
                        ></div>
                        <img
                          src={wallet.logo}
                          alt={wallet.walletName}
                          class="w-full h-full rounded-lg transition-all duration-300 dark:brightness-100 object-contain hover:scale-110 z-10 relative"
                          loading="lazy"
                        />
                        {#if connectingWalletId === wallet.id}
                          <div
                            class="absolute top-0 left-0 w-full h-full rounded-full border-2 border-transparent border-t-kong-accent-green border-r-kong-accent-green/30 border-b-kong-accent-green/10 animate-spin"
                          ></div>
                        {/if}
                      </div>

                      <div class="wallet-info flex-1 text-left min-w-0">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span
                            class="font-medium text-sm transition-colors duration-200 group-hover:text-kong-primary truncate"
                            >{wallet.walletName}</span
                          >
                          {#if wallet.unsupported}
                            <span
                              class="text-xs font-semibold px-1 py-0.5 rounded bg-kong-accent-yellow/20 text-kong-accent-yellow"
                              use:tooltip={{
                                text: "The Plug website is no longer available. Use with caution. We recommend migrating to a different wallet.",
                                direction: "top",
                              }}
                            >
                              Unsupported
                            </span>
                          {/if}
                        </div>
                        <div class="flex items-center gap-1.5 pt-1">
                          {#if wallet.website}
                            <a
                              href={wallet.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-xs flex items-center justify-center text-kong-text-secondary hover:text-kong-primary hover:bg-kong-bg-light/20 transition-all duration-200 cursor-pointer"
                              title="Visit website"
                              on:click|stopPropagation
                            >
                              <ExternalLink size={12} class="inline mr-0.5" />
                            </a>
                          {/if}
                          {#if isRecentWallet && showRecentWalletsSection}
                            <span class="text-xs text-kong-text-secondary flex items-center">
                              <Clock size={10} class="inline mr-0.5" />
                              Recent
                            </span>
                          {/if}
                        </div>
                        
                      </div>
                      {#if wallet.googleSignIn}
                          <Badge variant="google" size="xs">
                            {wallet.googleSignIn}
                          </Badge>
                      {/if}

                      <div
                        class="wallet-arrow flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1 ml-1"
                      >
                        <svg
                          class="text-kong-text-secondary transition-all duration-300 group-hover:text-kong-primary"
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</Modal>

<style lang="postcss">
  /* Create proper layout for scrollbar */
  .wallet-list-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .wallet-list {
    scrollbar-gutter: stable;
    padding-bottom: 1rem;
  }

  /* Scrollbar customization */
  .scrollbar-custom {
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--primary), 0.5) rgba(var(--bg-dark), 0.2);
  }

  .scrollbar-custom::-webkit-scrollbar {
    width: 8px;
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    background: rgba(var(--bg-dark), 0.2);
    border-radius: 0;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    background-color: rgba(var(--primary), 0.5);
    border-radius: 3px;
    border: 2px solid rgb(var(--bg-dark));
  }

  /* Enhanced wallet card styles */
  .wallet-card {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    border-width: 1px !important;
    transition:
      border-color 0.25s ease,
      transform 0.3s cubic-bezier(0.2, 0, 0.2, 1),
      box-shadow 0.3s ease;
    will-change: transform, box-shadow;
    transform: translate3d(0, 0, 0);
  }

  .wallet-card:hover {
    border-width: 1px !important;
    border-color: rgb(var(--primary) / 0.8) !important;
    box-shadow:
      0 0 0 1px rgb(var(--primary) / 0.3),
      0 8px 20px -4px rgba(var(--primary), 0.25) !important;
    /* Create a subtle outline glow */
    outline: 1px solid rgba(var(--primary), 0.3);
    outline-offset: 1px;
    transform: translate3d(0, -2px, 0) !important;
  }

  .wallet-card::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(
      circle at center,
      rgba(var(--primary), 0.15),
      transparent 70%
    );
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .wallet-card:hover::after {
    opacity: 1;
  }

  .wallet-card:hover .logo-glow {
    opacity: 0.6;
  }

  .logo-glow {
    background: radial-gradient(
      circle at center,
      rgba(var(--primary), 0.6),
      rgba(var(--primary), 0.2) 60%,
      transparent 70%
    );
    filter: blur(8px);
    z-index: 0;
    transition: opacity 0.4s ease;
  }

  @keyframes shine {
    0% {
      background-position: -100% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .wallet-card.recommended {
    background: linear-gradient(
      135deg,
      rgba(var(--primary), 0.1),
      rgba(var(--primary), 0.05)
    );
    border-color: rgb(var(--primary) / 0.4) !important;
    position: relative;
  }

  .wallet-card.recommended::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(var(--primary), 0) 0%,
      rgba(var(--primary), 0.2) 50%,
      rgba(var(--primary), 0) 100%
    );
    background-size: 200% 100%;
    animation: shine 3s infinite linear;
    pointer-events: none;
    opacity: 0.6;
  }

  /* Add glow effect to recommended wallets */
  .wallet-card.recommended::after {
    content: "";
    position: absolute;
    inset: -1px;
    background: linear-gradient(
      135deg,
      rgba(var(--primary), 0.6) 0%,
      rgba(var(--primary), 0.2) 50%,
      rgba(var(--primary), 0) 100%
    );
    border-radius: inherit;
    z-index: -1;
    opacity: 0.5;
    filter: blur(4px);
  }

  /* Logo hover effect - simplified */
  .wallet-logo {
    transition: transform 0.4s cubic-bezier(0.2, 0, 0.2, 1);
  }

  .wallet-card:hover .wallet-logo {
    transform: scale(1.08);
  }

  /* Remove unnecessary GPU-heavy animations */
  @keyframes pulse-glow {
    0% {
      box-shadow: 0 0 0 0 rgba(var(--primary), 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(var(--primary), 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(var(--primary), 0);
    }
  }

  /* Simplify arrow animation */
  .wallet-arrow {
    transition: transform 0.3s cubic-bezier(0.2, 0, 0.2, 1);
  }

  .wallet-card:hover .wallet-arrow {
    transform: translateX(2px);
  }

  /* Recent wallet styling */
  .recent-wallet-card .wallet-card {
    box-shadow:
      0 0 0 1px rgb(var(--primary) / 0.3),
      0 4px 12px -2px rgba(var(--primary), 0.15);
  }

  .recent-wallet-card .wallet-card::after {
    opacity: 0.4;
  }

  /* Keyboard navigation focus styles */
  .wallet-card[data-wallet-index]:focus {
    outline: none;
    border-color: rgb(var(--primary));
    box-shadow: 0 0 0 2px rgb(var(--primary) / 0.3);
  }

  /* Clear confirmation dialog styling */
  .confirm-dialog {
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Remove button hover effects */
  .remove-wallet {
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  .recent-wallet-card:hover .remove-wallet {
    opacity: 1;
  }

  @keyframes modalFadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .wallet-list {
    max-height: 80vh;
  }

  @media (min-height: 800px) {
    .wallet-list {
      max-height: 80vh;
    }
  }

  /* Add entrance animations for wallets */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .wallet-card {
    animation: fadeInUp 0.3s ease-out forwards;
  }

  /* Keyboard shortcut handler */
  :global(body.modal-open) {
    overflow: hidden;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .wallet-list {
      padding-right: 0.5rem !important;
      padding-left: 0.5rem !important;
    }
    
    .wallet-card {
      padding: 0.75rem !important;
    }
    
    .wallet-logo {
      width: 2rem !important;
      height: 2rem !important;
    }
  }
</style>
