<!-- WalletSidebar.svelte -->
<script lang="ts">
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { navActions } from "$lib/services/navActions";
  import { WALLET_TABS, WALLET_ACTIONS, WALLET_TRANSITIONS, type WalletTabId } from "$lib/config/walletTabs";
  import TabBar from "$lib/components/common/TabBar.svelte";
  import type { UITab, UITabAction } from "$lib/types/ui";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { enableBodyScroll, disableBodyScroll } from "$lib/utils/scrollUtils";

  // Props
  type Props = {
    isOpen?: boolean;
    activeTab?: WalletTabId;
    onClose?: () => void;
  };

  let { 
    isOpen = false, 
    activeTab = "notifications",
    onClose = () => {}
  }: Props = $props();
  
  // State
  let currentTab = $state(activeTab);
  let componentRefs = $state<Record<WalletTabId, any>>({
    wallet: null,
    chat: null,
    notifications: null
  });
  
  // Handle escape key
  $effect(() => {
    if (!isOpen) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  // Mark notifications as read when opening notifications tab
  $effect(() => {
    if (isOpen && currentTab === "notifications") {
      notificationsStore.markAllAsRead();
    }
  });

  // Initialize chat when switching to chat tab
  $effect(() => {
    if (currentTab === "chat" && isOpen && componentRefs.chat?.initialize) {
      // Small delay to ensure component is mounted
      setTimeout(() => componentRefs.chat.initialize(), 100);
    }
  });
  
  // Sync currentTab with activeTab prop
  $effect(() => {
    currentTab = activeTab;
  });

  // Handle body scroll
  $effect(() => {
    if (isOpen) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }
  });

  // Prepare tabs for TabBar component
  const tabs = $derived<UITab<WalletTabId>[]>(
    WALLET_TABS.map(tab => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      badge: tab.showBadge && currentTab !== tab.id ? $notificationsStore.unreadCount : undefined
    }))
  );

  // Prepare actions for TabBar component
  const actions = $derived<UITabAction[]>(
    WALLET_ACTIONS.map(action => ({
      ...action,
      onClick: async () => {
        switch (action.id) {
          case "disconnect":
            await navActions.disconnectWallet();
            onClose();
            break;
          case "close":
            onClose();
            break;
        }
      }
    }))
  );

</script>

{#if isOpen}
  <!-- Fixed size container with no overflow -->
  <div class="sidebar-container">
    <!-- Backdrop -->
    <div
      class="backdrop"
      onclick={onClose}
      transition:fade={WALLET_TRANSITIONS.backdrop.fade}
    ></div>
    
    <!-- Sidebar Panel -->
    <div 
      class="sidebar-panel"
      transition:fly={{ 
        ...WALLET_TRANSITIONS.panel.fly,
        easing: cubicOut 
      }}
    >
      <!-- Tab Bar -->
      <TabBar 
        {tabs}
        activeTab={currentTab}
        onTabChange={(tab) => (currentTab = tab)}
        {actions}
      />

      <!-- Tab Content -->
      <div class="tab-content">
        {#each WALLET_TABS as tab}
          {#if currentTab === tab.id}
            {@const Component = tab.component}
            <Component 
              bind:this={componentRefs[tab.id]}
              onClose={onClose} 
            />
          {/if}
        {/each}
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
  
  .backdrop {
    @apply fixed inset-0 bg-black/50 backdrop-blur-sm z-[9000];
  }
  
  .sidebar-panel {
    @apply fixed top-1/2 right-0 bg-kong-bg-primary rounded-l-lg;
    @apply border-l border-y border-kong-border shadow-md;
    @apply flex flex-col z-[9001];
    height: 98vh;
    width: 480px;
    max-width: 480px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
    transform: translate(0, -50%);
    overflow: hidden;
    overscroll-behavior: contain;
  }

  .tab-content {
    @apply flex-1 flex flex-col h-full overflow-hidden;
  }

  /* Responsive styles */
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
</style>
