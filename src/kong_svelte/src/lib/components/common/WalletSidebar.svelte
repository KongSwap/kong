<!-- WalletSidebar.svelte -->
<script lang="ts">
  import { fade, fly, slide } from "svelte/transition";
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
      // Instead of overflow-hidden which is too restrictive,
      // we'll add a custom class that we can style in CSS
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
</script>

{#if isOpen}
  <!-- Add crossfade for backdrop for smoother overall effect -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999]"
    transition:fade={{ duration: 200 }}
    onclick={handleClose}
  ></div>
  <aside
    class="fixed top-0 right-0 bottom-0 w-[480px] bg-kong-bg-dark border-l border-kong-border flex flex-col z-[1000] overscroll-behavior-contain"
    style="box-shadow: -10px 0 30px rgba(0, 0, 0, 0.25);"
    in:fly={{ x: 500, duration: 400, easing: quintOut }}
    out:fly={{ x: 500, duration: 300, easing: cubicOut }}
  >
    <!-- Tabs at the top -->
    <div class="flex border-b border-kong-border">
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
  </aside>
{/if}

<style>
  @media (max-width: 640px) {
    aside {
      width: 100%; /* w-full */
      border-left: 0; /* border-l-0 */
    }
  }

  @media (min-width: 641px) and (max-width: 800px) {
    aside {
      width: 90%; /* Use percentage for medium screens */
      max-width: 480px;
    }
  }

  /* Custom body styles when sidebar is open */
  :global(body.sidebar-open) {
    /* Allow scrolling within sidebar elements while preventing background scrolling */
    overflow: hidden;
    /* This ensures the page content doesn't shift */
    padding-right: 16px; /* Add padding to account for scrollbar width */
  }
</style>
