<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { toastStore } from "$lib/stores/toastStore";
  import { onMount, onDestroy } from "svelte";
  import {
    Droplet,
    Settings as SettingsIcon,
    Copy,
    ChartScatter,
    Menu,
    ChartCandlestick,
    X,
    Wallet,
    Coins,
    Award,
    PiggyBank,
    TrendingUpDown,
    Search,
  } from "lucide-svelte";
  import { TokenService } from "$lib/services/tokens/TokenService";
  import { loadBalances } from "$lib/services/tokens";
  import { tooltip } from "$lib/actions/tooltip";
  import { page } from "$app/stores";
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
  import { browser } from "$app/environment";
  import Settings from "$lib/components/settings/Settings.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { themeStore } from "$lib/stores/themeStore";
  import NavOption from "./NavOption.svelte";
  import MobileNavGroup from "./MobileNavGroup.svelte";
  import MobileMenuItem from "./MobileMenuItem.svelte";
  import { searchStore } from "$lib/stores/searchStore";

  let showSettings = false;
  let isMobile = false;
  let activeTab: "swap" | "predict" | "earn" | "stats" = "swap";
  let navOpen = false;
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown: "swap" | "earn" | "stats" | null = null;

  // Filter tabs based on DFX_NETWORK
  const allTabs = ["swap", "predict", "earn", "stats"] as const;
  $: tabs =
    process.env.DFX_NETWORK !== "ic"
      ? allTabs
      : allTabs.filter((tab) => tab !== "predict");

  const dataOptions = [
    {
      label: "Overview",
      description: "View general statistics and platform metrics",
      path: "/stats",
      icon: ChartCandlestick,
      comingSoon: false,
    },
    {
      label: "Bubbles",
      description: "Visualize token price changes with bubbles",
      path: "/stats/bubbles",
      icon: ChartScatter,
      comingSoon: false,
    },
  ];

  function handleOpenSettings() {
    showSettings = true;
  }

  function handleConnect() {
    sidebarStore.toggleOpen();
  }

  function checkMobile() {
    isMobile = window.innerWidth < 768;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener("resize", checkMobile);
    }
  });

  function onTabChange(tab: "swap" | "earn" | "stats" | "predict") {
    activeTab = tab;
  }

  async function copyToClipboard(text: string | undefined) {
    if (!text) {
      toastStore.error("No Principal ID available");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toastStore.success("Principal ID copied");
    } catch (err) {
      toastStore.error("Failed to copy Principal ID");
    }
  }

  async function claimTokens() {
    await TokenService.faucetClaim();
    await loadBalances($auth.account.owner, { forceRefresh: true });
  }

  const earnOptions = [
    {
      label: "Liquidity Pools",
      description: "Provide liquidity to earn trading fees and rewards",
      path: "/pools",
      icon: Coins,
      comingSoon: false,
    },
    {
      label: "Staking",
      description: "Stake your tokens to earn yield and governance rights",
      path: "/pools/staking",
      icon: Award,
      comingSoon: true,
    },
    {
      label: "Borrow & Lend",
      description:
        "Lend assets to earn interest or borrow against your collateral",
      path: "/pools/lending",
      icon: PiggyBank,
      comingSoon: true,
    },
  ];

  function showDropdown(type: "swap" | "earn" | "stats") {
    clearTimeout(closeTimeout);
    activeDropdown = type;
  }

  function hideDropdown() {
    closeTimeout = setTimeout(() => {
      activeDropdown = null;
    }, 150);
  }

  const swapOptions = [
    {
      label: "Basic Swap",
      description: "Simple and intuitive token swapping interface",
      path: "/swap",
      icon: Wallet,
      comingSoon: false,
    },
    {
      label: "Pro Swap",
      description: "Advanced trading features with detailed market data",
      path: "/swap/pro",
      icon: Coins,
      comingSoon: false,
    },
  ];

  $: {
    const path = $page.url.pathname;
    if (path.startsWith("/swap")) {
      activeTab = "swap";
    } else if (path.startsWith("/earn") || path.startsWith("/pools")) {
      activeTab = "earn";
    } else if (path.startsWith("/stats")) {
      activeTab = "stats";
    } else if (path.startsWith("/predict")) {
      activeTab = "predict";
    }
  }

  function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const textElement = img.nextElementSibling as HTMLElement;
    img.style.display = "none";
    if (textElement) {
      textElement.style.display = "block";
    }
  }

  function handleOpenSearch() {
    searchStore.open();
  }
</script>

<div class="mb-4 w-full top-0 left-0 z-50 relative pt-2">
  <div class="mx-auto h-16 flex items-center justify-between px-6">
    <div class="flex items-center gap-10">
      {#if isMobile}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center"
          on:click={() => (navOpen = !navOpen)}
        >
          <Menu size={20} color={$themeStore === "dark" ? "white" : "black"} />
        </button>
      {:else}
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          on:click={() => goto("/swap")}
        >
          <img
            src="/titles/logo-white-wide.png"
            alt="Kong Logo"
            class="h-[30px] transition-all duration-200"
            class:light-logo={$themeStore === "light"}
            on:error={handleImageError}
          />
          <span
            class="hidden text-xl font-bold text-kong-text-primary"
            style="display: none;"
          >
            KONG
          </span>
        </button>

        <nav class="flex items-center gap-0.5">
          {#each tabs as tab}
            {#if tab === "earn"}
              <NavOption
                label="EARN"
                options={earnOptions}
                isActive={activeTab === "earn"}
                {activeDropdown}
                onShowDropdown={showDropdown}
                onHideDropdown={hideDropdown}
                {onTabChange}
                defaultPath="/pools"
              />
            {:else if tab === "swap"}
              <NavOption
                label="SWAP"
                options={swapOptions}
                isActive={activeTab === "swap"}
                {activeDropdown}
                onShowDropdown={showDropdown}
                onHideDropdown={hideDropdown}
                {onTabChange}
                defaultPath="/swap"
              />
            {:else if tab === "stats"}
              <NavOption
                label="STATS"
                options={dataOptions}
                isActive={activeTab === "stats"}
                {activeDropdown}
                onShowDropdown={showDropdown}
                onHideDropdown={hideDropdown}
                {onTabChange}
                defaultPath="/stats"
              />
            {:else if tab === "predict"}
              <button
                class="nav-link {activeTab === tab ? 'active' : ''}"
                on:click={() => {
                  goto("/predict");
                  onTabChange("predict");
                }}
              >
                {tab.toUpperCase()}
              </button>
            {/if}
          {/each}
        </nav>
      {/if}
    </div>

    {#if isMobile}
      <div
        class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
      >
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          on:click={() => goto("/")}
        >
          <img
            src="/titles/logo-white-wide.png"
            alt="Kong Logo"
            class="h-6 transition-all duration-200"
            class:light-logo={$themeStore === "light"}
            on:error={handleImageError}
          />
          <span
            class="hidden text-lg font-bold text-kong-text-primary"
            style="display: none;"
          >
            KONG
          </span>
        </button>
      </div>
    {/if}

    <div class="flex items-center gap-1.5">
      {#if !isMobile}
        <button
          class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
          on:click={handleOpenSettings}
          use:tooltip={{ text: "Settings", direction: "bottom" }}
        >
          <SettingsIcon size={18} />
        </button>

        {#if process.env.DFX_NETWORK !== "ic"}
          <button
            class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
            on:click={handleOpenSearch}
            use:tooltip={{ text: "Search", direction: "bottom" }}
          >
            <Search size={18} />
          </button>
        {/if}

        {#if $auth.isConnected}
          {#if process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging"}
            <button
              class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
              on:click={claimTokens}
              use:tooltip={{ text: "Claim test tokens", direction: "bottom" }}
            >
              <Droplet size={18} />
            </button>
          {/if}

          <button
            class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
            on:click={() => copyToClipboard(auth.pnp?.account?.owner)}
            use:tooltip={{ text: "Copy Principal ID", direction: "bottom" }}
          >
            <Copy size={18} />
            <span>PID</span>
          </button>
        {/if}

        <button
          class="h-[34px] px-3.5 flex items-center gap-1.5 rounded-md text-sm font-semibold text-kong-text-primary/95 bg-kong-primary/40 border border-kong-primary/80 transition-all duration-150 hover:bg-kong-primary/60 hover:border-kong-primary/90"
          class:selected={$sidebarStore.isOpen}
          on:click={handleConnect}
        >
          <Wallet size={18} />
          <span>{$auth.isConnected ? "Wallet" : "Connect"}</span>
        </button>
      {:else}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center rounded-md text-kong-text-primary bg-kong-primary/15 border border-kong-primary/30 transition-all duration-150 hover:bg-kong-primary/20 hover:border-kong-primary/40"
          class:selected={$sidebarStore.isOpen}
          on:click={handleConnect}
        >
          <Wallet size={18} />
        </button>
      {/if}
    </div>
  </div>
</div>

{#if navOpen && isMobile}
  <div class="mobile-menu" transition:fade={{ duration: 200 }}>
    <div class="mobile-menu-overlay" on:click={() => (navOpen = false)} />
    <div
      class="mobile-menu-content"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div class="mobile-menu-header">
        <img
          src="/titles/logo-white-wide.png"
          alt="Kong Logo"
          class="logo-wide"
          class:light-logo={$themeStore === "light"}
        />
        <button class="mobile-close-btn" on:click={() => (navOpen = false)}>
          <X size={16} />
        </button>
      </div>

      <nav class="mobile-nav">
        <div class="mobile-nav-section">
          <MobileNavGroup
            title="SWAP"
            options={swapOptions}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />

          <MobileNavGroup
            title="EARN"
            options={earnOptions}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />

          <MobileNavGroup
            title="STATS"
            options={dataOptions}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />

          {#if process.env.DFX_NETWORK === "ic"}
            <MobileNavGroup
              title="PREDICT"
              options={[
                {
                  label: "Prediction Markets",
                  description: "Trade on future outcomes",
                  path: "/predict",
                  icon: TrendingUpDown,
                  comingSoon: false,
                },
              ]}
              {activeTab}
              {onTabChange}
              onClose={() => (navOpen = false)}
            />
          {/if}
        </div>

        <div class="mobile-nav-section">
          <div class="mobile-nav-section-title">ACCOUNT</div>
          <MobileMenuItem
            label="Settings"
            icon={SettingsIcon}
            onClick={() => {
              handleOpenSettings();
              navOpen = false;
            }}
            iconBackground="bg-kong-text-primary/10"
          />

          {#if process.env.DFX_NETWORK !== "ic"}
            <MobileMenuItem
              label="Search"
              icon={Search}
              onClick={() => {
                handleOpenSearch();
                navOpen = false;
              }}
              iconBackground="bg-kong-text-primary/10"
            />
          {/if}

          {#if $auth.isConnected}
            {#if process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging"}
              <MobileMenuItem
                label="Claim Tokens"
                icon={Droplet}
                onClick={() => {
                  claimTokens();
                  navOpen = false;
                }}
                iconBackground="bg-kong-text-primary/10"
              />
            {/if}

            <MobileMenuItem
              label="Copy Principal ID"
              icon={Copy}
              onClick={() => {
                copyToClipboard(auth.pnp?.account?.owner);
                navOpen = false;
              }}
              iconBackground="bg-kong-text-primary/10"
            />
          {/if}
        </div>
      </nav>

      <div class="mobile-menu-footer">
        <button
          class="mobile-wallet-btn"
          on:click={() => {
            handleConnect();
            navOpen = false;
          }}
        >
          <Wallet size={20} />
          <span>{$auth.isConnected ? "Wallet" : "Connect Wallet"}</span>
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showSettings}
  <Modal
    isOpen={true}
    title="Settings"
    height="auto"
    variant="transparent"
    on:close={() => (showSettings = false)}
  >
    <Settings on:close={() => (showSettings = false)} />
  </Modal>
{/if}

{#if $sidebarStore.isOpen}
  <div class="sidebar-portal">
    <div
      class="sidebar-backdrop"
      transition:fade={{ duration: 150 }}
      on:click={() => sidebarStore.close()}
    />
    <Sidebar onClose={() => sidebarStore.close()} />
  </div>
{/if}

<style scoped lang="postcss">
  /* Mobile Menu */
  .mobile-menu {
    @apply fixed inset-0 z-50;
  }

  .mobile-menu-overlay {
    @apply fixed inset-0 bg-black/50 backdrop-blur-sm;
  }

  .mobile-menu-content {
    @apply fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-dark border-r border-kong-border;
  }

  .mobile-menu-header {
    @apply flex items-center justify-between p-5 border-b border-kong-border;
  }

  .mobile-close-btn {
    @apply w-7 h-7 flex items-center justify-center rounded-lg text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/5 hover:bg-kong-text-primary/10 transition-colors duration-200;
  }

  .mobile-nav {
    @apply flex-1 overflow-y-auto py-2;
  }

  .mobile-nav-section {
    @apply px-4 py-2;
  }

  .mobile-nav-section:not(:last-child) {
    @apply mb-2;
  }

  .mobile-nav-section-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2 tracking-wider;
  }

  .mobile-menu-footer {
    @apply p-0;
  }

  .mobile-wallet-btn {
    @apply w-full flex items-center justify-center gap-2 px-4 py-1.5 bg-kong-primary/15 hover:bg-kong-primary/20 text-kong-text-primary font-semibold border border-kong-primary/30 hover:border-kong-primary/40 transition-all duration-200;
  }

  .sidebar-portal {
    @apply fixed inset-0 z-[100] isolate;
  }

  .sidebar-backdrop {
    @apply fixed inset-0 bg-black/20 backdrop-blur-[4px];
  }

  /* Logo styles */
  .light-logo {
    @apply invert brightness-[0.8] transition-all duration-200;
  }

  .mobile-menu-header .logo-wide {
    @apply transition-all duration-200;
  }

  .mobile-menu-header .logo-wide.light-logo {
    @apply invert brightness-[0.2];
  }

  /* Basic nav link for predict tab */
  .nav-link {
    @apply relative h-16 px-5 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200;
  }

  .nav-link:hover {
    @apply text-kong-text-primary;
  }

  .nav-link.active {
    @apply text-kong-primary;
    text-shadow: 0 0px 30px theme(colors.kong.primary);
  }
</style>
