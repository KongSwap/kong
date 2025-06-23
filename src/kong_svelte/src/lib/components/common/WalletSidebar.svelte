<!-- WalletSidebar.svelte -->
<script lang="ts">
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
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount, onDestroy } from "svelte";
  import { enableBodyScroll, disableBodyScroll } from "$lib/utils/scrollUtils";
  // Component imports
  import TrollboxPanel from "$lib/components/wallet/trollbox/TrollboxPanel.svelte";
  import WalletPanel from "$lib/components/wallet/WalletPanel.svelte";
  import NotificationsPanel from "$lib/components/notifications/NotificationsPanel.svelte";

  // Define prop types
  type SidebarProps = {
    isOpen?: boolean;
    activeTab?: "notifications" | "chat" | "wallet";
    onClose?: () => void;
  };

  // Receive props using $props rune
  let { 
    isOpen = false, 
    activeTab = "notifications" as "notifications" | "chat" | "wallet",
    onClose = () => {}
  }: SidebarProps = $props();
  
  // State variables
  let currentTab = $state(activeTab);
  let trollboxPanel = $state<TrollboxPanel | null>(null);
  
  // Close on escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      onClose();
    }
  }

  // Toggle body overflow to prevent background scrolling
  function toggleBodyOverflow(shouldPreventScroll: boolean) {
    if (!browser) return;
    document.body.classList.toggle("sidebar-open", shouldPreventScroll);
  }

  // Setup and cleanup
  $effect.root(() => {
    if (browser) {
      window.addEventListener("keydown", handleKeydown);
      if (isOpen) toggleBodyOverflow(true);
    }

    return () => {
      if (browser) {
        window.removeEventListener("keydown", handleKeydown);
        toggleBodyOverflow(false);
      }
    };
  });

  // Watch for changes to isOpen
  $effect(() => {
    if (browser) toggleBodyOverflow(isOpen);
  });

  // Mark notifications as read when opening notifications tab
  $effect(() => {
    if (isOpen && currentTab === "notifications") {
      notificationsStore.markAllAsRead();
    }
  });

  // Initialize trollbox when switching to chat tab
  $effect(() => {
    if (currentTab === "chat" && isOpen && browser && trollboxPanel) {
      setTimeout(() => trollboxPanel.initialize(), 100);
    }
  });

  // Disconnect wallet and close sidebar
  async function handleDisconnect() {
    try {
      await auth.disconnect();
      onClose();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }
  
  // Sync currentTab with activeTab prop
  $effect(() => {
    currentTab = activeTab;
  });

  $effect(() => {
    if (isOpen) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }
  });

</script>

{#if isOpen}
  <!-- Fixed size container with no overflow -->
  <div class="sidebar-container">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9000]"
      onclick={onClose}
      transition:fade={{ duration: 200, easing: cubicOut }}
    ></div>
    
    <!-- Sidebar -->
    <div 
      class="sidebar-panel bg-kong-bg-primary rounded-l-lg"
      transition:fly={{ 
        x: 480, 
        duration: 300, 
        easing: cubicOut 
      }}
    >
      <!-- Tabs at the top -->
      <div class="flex border-b border-kong-border bg-kong-bg-primary">
        {#each [
          { id: 'wallet' as const, icon: Wallet, label: 'Wallet' },
          { id: 'chat' as const, icon: MessagesSquare, label: 'Chat' },
          { id: 'notifications' as const, icon: Bell, label: 'Notifications' }
        ] as tab}
          {@const Icon = tab.icon}
          <button
            class="tab-button {currentTab === tab.id ? 'active' : ''}"
            onclick={() => (currentTab = tab.id)}
          >
            <Icon size={16} />
            <span class="tab-label">{tab.label}</span>
            {#if tab.id === 'notifications' && currentTab !== tab.id && $notificationsStore.unreadCount > 0}
              <Badge variant="red" size="xs">{$notificationsStore.unreadCount}</Badge>
            {/if}
          </button>
        {/each}

        <!-- Disconnect button -->
        <button
          class="tab-button disconnect"
          onclick={handleDisconnect}
          aria-label="Disconnect wallet"
        >
          <LogOut size={16} />
        </button>

        <!-- Close button -->
        <button
          class="tab-button close"
          onclick={onClose}
          aria-label="Close sidebar"
        >
          <IconClose size={16} />
        </button>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 flex flex-col h-full overflow-hidden">
        {#if currentTab === "notifications"}
          <NotificationsPanel onClose={onClose} />
        {:else if currentTab === "chat"}
          <TrollboxPanel bind:this={trollboxPanel} onClose={onClose} />
        {:else if currentTab === "wallet"}
          <WalletPanel onClose={onClose} />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .sidebar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 9000;
    overflow: visible;
  }
  
  .sidebar-panel {
    @apply border-l border-y border-kong-border shadow-md;
    position: fixed;
    top: 50%;
    right: 0;
    height: 98vh;
    width: 480px;
    max-width: 480px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    z-index: 9001;
    transform: translate(0, -50%);
    overflow: hidden;
    overscroll-behavior: contain;
  }

  .tab-button {
    @apply py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors;
    @apply text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5;
  }

  .tab-button.active {
    @apply flex-1 text-kong-primary border-b-2 border-kong-primary bg-kong-text-primary/5;
  }

  .tab-button:not(.active):not(.disconnect):not(.close) {
    @apply px-6;
  }

  .tab-button.disconnect {
    @apply px-6;
  }

  .tab-button.close {
    @apply px-4;
  }

  .tab-label {
    @apply hidden;
  }

  .tab-button.active .tab-label {
    @apply sm:block;
  }

  @media (max-width: 640px) {
    .sidebar-panel {
      width: 100%; 
      max-width: 100%;
      border-left: none;
      height: 100dvh;
    }
  }

  @media (min-width: 641px) and (max-width: 800px) {
    .sidebar-panel {
      width: 90%;
      max-width: 480px;
    }
  }

  :global(.sidebar-open) {
    overflow: hidden !important;
    overscroll-behavior: none;
    touch-action: none;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  :global(.sidebar-open::-webkit-scrollbar) {
    display: none;
  }
</style>
