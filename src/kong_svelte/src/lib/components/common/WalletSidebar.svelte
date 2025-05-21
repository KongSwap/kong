<!-- WalletSidebar.svelte -->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut, quintOut } from "svelte/easing";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import {
    X as IconClose,
    Bell,
    MessagesSquare,
    Wallet,
    LogOut,
  } from "lucide-svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { browser } from "$app/environment";
  import { auth } from "$lib/stores/auth";

  // TrollBox imports
  import TrollboxPanel from "$lib/components/wallet/trollbox/TrollboxPanel.svelte";
  import WalletPanel from "$lib/components/wallet/WalletPanel.svelte";
  import NotificationsPanel from "$lib/components/notifications/NotificationsPanel.svelte";
  import { slide } from "svelte/transition";

  // Define prop types
  type SidebarProps = {
    isOpen?: boolean;
    activeTab?: "notifications" | "chat" | "wallet";
    onClose?: () => void; // Add callback prop instead of using event dispatcher
  };

  // Receive props using $props rune with correct destructuring
  let { 
    isOpen = false, 
    activeTab = "notifications" as "notifications" | "chat" | "wallet",
    onClose = () => {} // Default empty function to avoid null checks
  }: SidebarProps = $props();
  
  // Create state variables that can be modified within the component
  let currentTab = $state(activeTab);
  
  // Hover state for tabs with timers for debouncing
  let walletTabHovered = $state(false);
  let chatTabHovered = $state(false);
  let notificationsTabHovered = $state(false);
  let disconnectTabHovered = $state(false);
  
  // Hover timers for debouncing
  let walletHoverTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let chatHoverTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let notificationsHoverTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let disconnectHoverTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  
  // Reference to the TrollboxPanel component
  let trollboxPanel = $state<TrollboxPanel | null>(null);
  
  // Debounced hover handlers
  function setTabHover(tab: 'wallet' | 'chat' | 'notifications' | 'disconnect', state: boolean) {
    if (state) {
      // Immediately set hover state on mouseenter
      if (tab === 'wallet') {
        clearTimeout(walletHoverTimer as ReturnType<typeof setTimeout>);
        walletTabHovered = true;
      } else if (tab === 'chat') {
        clearTimeout(chatHoverTimer as ReturnType<typeof setTimeout>);
        chatTabHovered = true;
      } else if (tab === 'notifications') {
        clearTimeout(notificationsHoverTimer as ReturnType<typeof setTimeout>);
        notificationsTabHovered = true;
      } else if (tab === 'disconnect') {
        clearTimeout(disconnectHoverTimer as ReturnType<typeof setTimeout>);
        disconnectTabHovered = true;
      }
    } else {
      // Delay removal of hover state on mouseleave
      if (tab === 'wallet') {
        walletHoverTimer = setTimeout(() => { walletTabHovered = false; }, 300);
      } else if (tab === 'chat') {
        chatHoverTimer = setTimeout(() => { chatTabHovered = false; }, 300);
      } else if (tab === 'notifications') {
        notificationsHoverTimer = setTimeout(() => { notificationsTabHovered = false; }, 300);
      } else if (tab === 'disconnect') {
        disconnectHoverTimer = setTimeout(() => { disconnectTabHovered = false; }, 300);
      }
    }
  }
  
  // Close on escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      handleClose();
    }
  }

  // Toggle body overflow to prevent background scrolling
  function toggleBodyOverflow(shouldPreventScroll: boolean) {
    if (!browser) return;

    if (shouldPreventScroll) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }
  }

  // Setup and cleanup with $effect.root() - equivalent to onMount with cleanup
  $effect.root(() => {
    if (browser) {
      window.addEventListener("keydown", handleKeydown);

      // Set initial overflow state if sidebar starts open
      if (isOpen) {
        toggleBodyOverflow(true);
      }
    }

    // Return a cleanup function
    return () => {
      if (browser) {
        window.removeEventListener("keydown", handleKeydown);

        // Ensure we remove the overflow-hidden class when component is destroyed
        toggleBodyOverflow(false);
        
        // Clean up timers
        [walletHoverTimer, chatHoverTimer, notificationsHoverTimer, disconnectHoverTimer].forEach(timer => {
          if (timer) clearTimeout(timer);
        });
      }
    };
  });

  // Watch for changes to isOpen and update body overflow
  $effect(() => {
    if (browser && isOpen !== undefined) {
      toggleBodyOverflow(isOpen);
    }
  });

  // When the sidebar opens, mark all notifications as read if on notifications tab
  $effect(() => {
    if (isOpen && currentTab === "notifications") {
      notificationsStore.markAllAsRead();
    }
  });

  // When tab changes to chat, initialize trollbox if not already done
  $effect(() => {
    if (currentTab === "chat" && isOpen && browser && trollboxPanel) {
      // Allow some time for DOM to update
      setTimeout(() => {
        trollboxPanel.initialize();
      }, 100);
    }
  });

  // Close the sidebar
  function handleClose() {
    // Use the callback instead of dispatching an event
    onClose();
  }
  
  // Disconnect wallet and close sidebar
  async function handleDisconnect() {
    try {
      await auth.disconnect();
      // Close sidebar after disconnecting
      handleClose();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }
  
  // Effect to sync currentTab with activeTab prop
  $effect(() => {
    currentTab = activeTab;
  });

  // Visibility style, no animation needed
  let sidebarVisible = $state(false);
  
  $effect(() => {
    // If sidebar is opened, wait a tiny bit to ensure styles are applied before showing
    if (isOpen) {
      setTimeout(() => {
        sidebarVisible = true;
      }, 10);
    } else {
      sidebarVisible = false;
    }
  });
</script>

{#if isOpen}
  <!-- Fixed size container with no overflow -->
  <div class="sidebar-container">
    <!-- Backdrop (no transition to avoid layout shifts) -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999]"
      onclick={handleClose}
    ></div>
    
    <!-- Sidebar with static positioning (no animations) -->
    <div
      class="sidebar-panel bg-kong-bg-dark rounded-l-lg"
      class:visible={sidebarVisible}
    >
      <!-- Tabs at the top -->
      <div class="flex border-b border-kong-border bg-kong-bg-dark">
        <button
          class="{currentTab === 'wallet'
            ? 'flex-1 text-kong-primary border-b-2 border-kong-primary bg-kong-text-primary/5'
            : 'px-6 text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5'} py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
          onclick={() => (currentTab = "wallet")}
          onmouseenter={() => setTabHover('wallet', true)}
          onmouseleave={() => setTabHover('wallet', false)}
        >
          <div class="transition-all duration-300 ease-in-out transform {currentTab === 'wallet' || walletTabHovered ? 'scale-110' : 'scale-100'}">
            <Wallet size={16} />
          </div>
          {#if currentTab === "wallet" || walletTabHovered}
            <span transition:slide={{ duration: 200, axis: 'x' }}>Wallet</span>
          {/if}
        </button>

        <button
          class="{currentTab === 'chat'
            ? 'flex-1 text-kong-primary border-b-2 border-kong-primary bg-kong-text-primary/5'
            : 'px-6 text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5'} py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
          onclick={() => (currentTab = "chat")}
          onmouseenter={() => setTabHover('chat', true)}
          onmouseleave={() => setTabHover('chat', false)}
        >
          <div class="transition-all duration-300 ease-in-out transform {currentTab === 'chat' || chatTabHovered ? 'scale-110' : 'scale-100'}">
            <MessagesSquare size={16} />
          </div>
          {#if currentTab === "chat" || chatTabHovered}
            <span transition:slide={{ duration: 200, axis: 'x' }}>Chat</span>
          {/if}
        </button>

        <button
          class="{currentTab === 'notifications'
            ? 'flex-1 text-kong-primary border-b-2 border-kong-primary bg-kong-text-primary/5'
            : 'px-6 text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5'} py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
          onclick={() => (currentTab = "notifications")}
          onmouseenter={() => setTabHover('notifications', true)}
          onmouseleave={() => setTabHover('notifications', false)}
        >
          <div class="transition-all duration-300 ease-in-out transform {currentTab === 'notifications' || notificationsTabHovered ? 'scale-110' : 'scale-100'}">
            <Bell size={16} />
          </div>
          {#if currentTab === "notifications" || notificationsTabHovered}
            <span transition:slide={{ duration: 200, axis: 'x' }}>Notifications</span>
          {:else if $notificationsStore.unreadCount > 0}
            <Badge variant="red" size="xs"
              >{$notificationsStore.unreadCount}</Badge
            >
          {/if}
        </button>

        <!-- Disconnect button - NEW -->
        <button
          class="px-6 text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 ease-in-out"
          onclick={handleDisconnect}
          onmouseenter={() => setTabHover('disconnect', true)}
          onmouseleave={() => setTabHover('disconnect', false)}
          aria-label="Disconnect wallet"
        >
          <div class="transition-all duration-300 ease-in-out transform {disconnectTabHovered ? 'scale-110' : 'scale-100'}">
            <LogOut size={16} />
          </div>
          {#if disconnectTabHovered}
            <span transition:slide={{ duration: 200, axis: 'x' }}>Disconnect</span>
          {/if}
        </button>

        <!-- Close button -->
        <button
          class="px-4 py-3.5 text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5 transition-colors duration-300 ease-in-out flex items-center justify-center"
          onclick={handleClose}
          aria-label="Close sidebar"
        >
          <IconClose size={16} />
        </button>
      </div>

      <!-- Tab Content -->
      {#if currentTab === "notifications"}
        <NotificationsPanel onClose={handleClose} />
      {:else if currentTab === "chat"}
        <!-- Chat Tab Content - Using TrollboxPanel component -->
        <div class="flex-1 flex flex-col h-full overflow-hidden">
          <TrollboxPanel bind:this={trollboxPanel} onClose={handleClose} />
        </div>
      {:else if currentTab === "wallet"}
        <!-- Wallet Tab Content - Using WalletPanel component -->
        <div class="flex-1 flex flex-col h-full overflow-hidden">
          <WalletPanel onClose={handleClose} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss" scoped>
  /* Completely fixed sidebar container with no dimensions */
  .sidebar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 999;
    /* Make sure this container never causes overflow */
    overflow: visible;
  }
  
  /* The sidebar panel itself */
  .sidebar-panel {
    @apply border-l border-y border-kong-border shadow-md;
    position: fixed;
    top: 50%;
    right: 0;
    height: 98vh; /* Use percentage of viewport height */
    width: 100%;
    max-width: 480px !important;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    opacity: 0;
    /* Combined transform for both centering and slide-in */
    transform: translate(100%, -50%);
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), 
                opacity 0.2s ease-in-out;
    overflow: hidden;
    overscroll-behavior: contain;
  }
  
  /* Visible state for the sidebar */
  .sidebar-panel.visible {
    transform: translate(0, -50%);
    opacity: 1;
  }

  /* Media queries for responsive sizing */
  @media (max-width: 640px) {
    .sidebar-panel {
      width: 100%; 
      max-width: 100%;
      border-left: none;
      /* On mobile, take up more screen space */
      height: 95vh;
      /* Adjust for centering */
      top: 50%;
      transform: translate(100%, -50%);
    }
    
    .sidebar-panel.visible {
      transform: translate(0, -50%);
    }
  }

  @media (min-width: 641px) and (max-width: 800px) {
    .sidebar-panel {
      width: 90%;
      max-width: 480px;
    }
  }

  /* Custom body styles when sidebar is open */
  .sidebar-open {
    overflow: hidden !important;
    overscroll-behavior: none;
    touch-action: none;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .sidebar-open::-webkit-scrollbar {
    display: none;
  }
</style>
