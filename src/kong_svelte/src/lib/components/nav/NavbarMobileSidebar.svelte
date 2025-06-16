<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { goto } from "$app/navigation";
  import { fade, slide } from "svelte/transition";
  import { X, Wallet } from "lucide-svelte";  
  import MobileNavGroup from "./NavbarMobile.svelte";
  import MobileMenuItem from "./NavbarMobileItem.svelte";
  import NavbarButton from "./NavbarButton.svelte";
  import { Settings as SettingsIcon, Copy, Bell, Coins, TrendingUpDown, Award, ChartCandlestick, ChartScatter, Trophy } from "lucide-svelte";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";
  import { getAccountIds } from "$lib/utils/accountUtils";
  import { userTokens } from "$lib/stores/userTokens";
  import { loadBalances } from "$lib/stores/tokenStore";

  const mobileLogoPath = "/titles/logo-white-wide.png";
  

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    isLightTheme: boolean;
    activeTab: any;
    walletButtonThemeProps: any;
    isAuthenticating: boolean;
    showWalletSidebar: boolean;
    walletSidebarActiveTab: string;
    onConnect: () => void;
    toggleWalletSidebar: (tab: string) => void;
  }

  let {
    isOpen,
    onClose,
    isLightTheme,
    activeTab,
    walletButtonThemeProps,
    isAuthenticating,
    showWalletSidebar,
    walletSidebarActiveTab,
    onConnect,
    toggleWalletSidebar
  }: Props = $props();

  const mobileNavGroups = $derived([
    { title: "SWAP", options: [
      { label: "Basic Swap", description: "Simple and intuitive token swapping interface", path: "/", icon: Wallet, comingSoon: false },
      { label: "Pro Swap", description: "Advanced trading features with detailed market data", path: "/pro", icon: Coins, comingSoon: false },
    ] },
    {
      title: "PREDICT",
      options: [
        {
          label: "Prediction Markets",
          description: "Trade on future outcomes",
          path: "/predict",
          icon: TrendingUpDown,
          comingSoon: false,
        },
      ],
    },
    { title: "EARN", options: [
      { label: "Liquidity Pools", description: "Provide liquidity to earn trading fees and rewards", path: "/pools", icon: Coins, comingSoon: false },
      { label: "Airdrop", description: "Claim your airdrop tokens", path: "/airdrop-claims", icon: Award, comingSoon: false },
    ] },
    { title: "STATS", options: [
      { label: "Overview", description: "View general statistics and platform metrics", path: "/stats", icon: ChartCandlestick, comingSoon: false },
      { label: "Bubbles", description: "Visualize token price changes with bubbles", path: "/stats/bubbles", icon: ChartScatter, comingSoon: false },
      { label: "Leaderboards", description: "View trading leaderboards", path: "/stats/leaderboard", icon: Trophy, comingSoon: false },
    ] },
  ]);

  const accountMenuItems = $derived([
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: () => goto("/settings"),
      show: true
    },
    // {
    //   label: "Claim Tokens",
    //   icon: Droplet,
    //   onClick: claimTokens,
    //   show: showFaucetOption
    // },
    {
      label: "Copy Principal ID",
      icon: Copy,
      onClick: copyPrincipalId,
      show: $auth.isConnected
    },
    {
      label: "Copy Account ID",
      icon: Copy,
      onClick: copyAccountId,
      show: $auth.isConnected
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: () => toggleWalletSidebar("notifications"),
      badgeCount: $notificationsStore.unreadCount,
      show: true
    }
  ]);

  async function claimTokens() {
    await faucetClaim();
    // Use runes directly
    await loadBalances($userTokens.tokens, $auth.account.owner, true);
  }

  function copyPrincipalId() {
    const principalToCopy = $auth?.account?.owner;
    if (principalToCopy) {
      copyToClipboard(principalToCopy);
    } else {
      console.error("Could not get Principal ID to copy.");
    }
  }

  function copyAccountId() {
    const currentAccountId = $auth.isConnected && $auth.account?.owner
      ? getAccountIds($auth.account.owner, $auth.account.subaccount).main
      : "";
    if (currentAccountId) {
      copyToClipboard(currentAccountId);
    } else {
      console.error("Could not get Account ID to copy.");
    }
  }

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
          label={$auth.isConnected ? "Wallet" : "Connect Wallet"}
          onClick={mobileMenuAction(onConnect)}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          iconSize={20}
          class="w-full !py-5 justify-center"
          {...walletButtonThemeProps}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
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