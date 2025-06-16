<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { X, Wallet } from "lucide-svelte";  
  import MobileNavGroup from "./NavbarMobile.svelte";
  import MobileMenuItem from "./NavbarMobileItem.svelte";
  import NavbarButton from "./NavbarButton.svelte";

  const mobileLogoPath = "/titles/logo-white-wide.png";
  

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    isLightTheme: boolean;
    mobileNavGroups: any[];
    accountMenuItems: any[];
    activeTab: any;
    walletButtonThemeProps: any;
    auth: any;
    notificationsStore: any;
    isAuthenticating: boolean;
    showWalletSidebar: boolean;
    walletSidebarActiveTab: string;
    onConnect: () => void;
  }

  let {
    isOpen,
    onClose,
    isLightTheme,
    mobileNavGroups,
    accountMenuItems,
    activeTab,
    walletButtonThemeProps,
    auth,
    notificationsStore,
    isAuthenticating,
    showWalletSidebar,
    walletSidebarActiveTab,
    onConnect
  }: Props = $props();

  // Helper for mobile menu item clicks - move action + close logic here
  function mobileMenuAction(action: () => void) {
    return () => {
      action();
      onClose();
    };
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50" transition:fade={{ duration: 200 }}>
    <div class="fixed inset-0 bg-kong-bg-dark/60 backdrop-blur-sm" onclick={onClose} />
    <div
      class="fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-dark border-r border-kong-border shadow-lg max-[375px]:w-[90%] max-[375px]:max-w-[300px]"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div class="flex items-center justify-between p-5 border-b border-kong-border max-[375px]:p-4">
        <img
          src={mobileLogoPath}
          alt="Kong Logo"
          class="navbar-logo h-9 !transition-all !duration-200"
          class:light-logo={isLightTheme}
          style={isLightTheme ? '--logo-brightness: 0.2' : ''}
        />
        <button 
          class="w-9 h-9 flex items-center justify-center rounded-full text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/10 hover:bg-kong-text-primary/15 transition-colors duration-200" 
          onclick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto py-3 space-y-3">
        <div class="px-4 py-2 max-[375px]:px-3">
          {#each mobileNavGroups as group (group.title)}
            <MobileNavGroup
              title={group.title}
              options={group.options}
              {activeTab}
              onClose={onClose}
            />
          {/each}
        </div>

        <div class="px-4 py-2 max-[375px]:px-3">
          <div class="text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2 tracking-wider">ACCOUNT</div>
          {#each accountMenuItems as item}
            {#if item.show}
              <MobileMenuItem
                label={item.label}
                icon={item.icon}
                onClick={item.onClick}
                iconBackground="bg-kong-text-primary/10"
                badgeCount={item.badgeCount ?? null}
              />
            {/if}
          {/each}
        </div>
      </nav>

      <div class="p-2 border-t border-kong-border">
        <NavbarButton
          icon={Wallet}
          label={auth.isConnected ? "Wallet" : "Connect Wallet"}
          onClick={mobileMenuAction(onConnect)}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          iconSize={20}
          class="w-full !py-5 justify-center"
          {...walletButtonThemeProps}
          isWalletButton={true}
          badgeCount={notificationsStore.unreadCount}
          loading={isAuthenticating}
        />
      </div>
    </div>
  </div>
{/if}

<style scoped lang="postcss">
  .light-logo {
    @apply invert brightness-[var(--logo-brightness,0.8)] transition-all duration-200;
    filter: invert(1) brightness(var(--logo-brightness, 0.2));
  }
</style> 