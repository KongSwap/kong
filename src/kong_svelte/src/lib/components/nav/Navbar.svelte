<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { toastStore } from "$lib/stores/toastStore";
  import { onMount, onDestroy } from "svelte";
  import { Droplet, Settings as SettingsIcon, Copy, Menu, X, Wallet, ChevronDown, Coins, Award, PiggyBank } from "lucide-svelte";
  import { TokenService } from "$lib/services/tokens/TokenService";
  import { loadBalances } from "$lib/services/tokens";
  import { tooltip } from "$lib/actions/tooltip";
  import { page } from '$app/stores';
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
  import { browser } from "$app/environment";
  import Settings from "$lib/components/settings/Settings.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { swapModeService } from "$lib/services/settings/swapModeService";
    import { themeStore } from "$lib/stores/themeStore";

  let showSettings = false;
  let isMobile = false;
  let activeTab: "swap" | "earn" | "stats" = "swap";
  let navOpen = false;
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown: 'swap' | 'earn' | null = null;
  const tabs = ["swap", "earn", "stats"] as const;

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
    window.addEventListener('resize', checkMobile);
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('resize', checkMobile);
    }
  });

  function onTabChange(tab: "swap" | "earn" | "stats") {
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
      label: 'Liquidity Pools',
      description: 'Provide liquidity to earn trading fees and rewards',
      path: '/pools',
      icon: Coins,
      comingSoon: false
    },
    { 
      label: 'Staking',
      description: 'Stake your tokens to earn yield and governance rights',
      path: '/pools/staking',
      icon: Award,
      comingSoon: true
    },
    { 
      label: 'Borrow & Lend',
      description: 'Lend assets to earn interest or borrow against your collateral',
      path: '/pools/lending',
      icon: PiggyBank,
      comingSoon: true
    }
  ];

  function showDropdown(type: 'swap' | 'earn') {
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
      label: 'Basic Swap',
      description: 'Simple and intuitive token swapping interface',
      path: '/swap',
      icon: Wallet,
      comingSoon: false
    },
    { 
      label: 'Pro Swap',
      description: 'Advanced trading features with detailed market data',
      path: '/swap/pro',
      icon: Coins,
      comingSoon: false
    }
  ];

  $: {
    const path = $page.url.pathname;
    if (path.startsWith('/swap')) {
      activeTab = 'swap';
    } else if (path.startsWith('/earn') || path.startsWith('/pools')) {
      activeTab = 'earn';
    } else if (path.startsWith('/stats')) {
      activeTab = 'stats';
    }
  }

  async function handleSwapClick() {
    const lastMode = swapModeService.getLastMode();
    const path = lastMode === 'pro' ? '/swap/pro' : '/swap';
    await goto(path);
    onTabChange('swap');
  }

  function handleSwapOptionClick(option: typeof swapOptions[number]) {
    if (!option.comingSoon) {
      hideDropdown();
      setTimeout(async () => {
        const mode = option.path === '/swap/pro' ? 'pro' : 'basic';
        swapModeService.saveMode(mode);
        await goto(option.path);
        onTabChange('swap');
      }, 150);
    }
  }
</script>

<div class="mb-4 w-full top-0 left-0 z-50 relative">
  <div class="mx-auto h-16 flex items-center justify-between px-6">
    <div class="flex items-center gap-10">
      {#if isMobile}
        <button class="h-[34px] w-[34px] flex items-center justify-center" on:click={() => (navOpen = !navOpen)}>
          <Menu size={20} color={$themeStore === "dark" ? "white" : "black"} />
        </button>
      {:else}
        <button class="flex items-center hover:opacity-90 transition-opacity" on:click={() => goto("/")}>
          <img 
            src="/titles/logo-white-wide.png"
            alt="Kong Logo" 
            class="h-[30px] transition-all duration-200"
            class:light-logo={$themeStore === 'light'}
          />
        </button>

        <nav class="flex items-center gap-0.5">
          {#each tabs as tab}
            {#if tab === 'earn'}
              <div 
                class="nav-dropdown"
                on:mouseenter={() => showDropdown('earn')}
                on:mouseleave={hideDropdown}
              >
                <button
                  class="nav-link {activeTab === tab ? 'active' : ''}"
                >
                  {tab.toUpperCase()}
                  <ChevronDown size={16} />
                </button>
                
                {#if activeDropdown === 'earn'}
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 150 }}>
                    <div class="px-5 pb-3 text-xs font-semibold tracking-wider text-kong-text-secondary border-b border-kong-border mb-2">EARN OPTIONS</div>
                    {#each earnOptions as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-150 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        on:click={async () => {
                          if (!option.comingSoon) {
                            hideDropdown();
                            await goto(option.path);
                            onTabChange('earn');
                          }
                        }}
                        class:disabled={option.comingSoon}
                      >
                        <div class="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-md bg-kong-text-primary/5 text-kong-text-primary transition-all duration-300 ease-out transform group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">{option.label}</span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm text-kong-text-secondary leading-normal">{option.description}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if tab === 'swap'}
              <div 
                class="nav-dropdown"
                on:mouseenter={() => showDropdown('swap')}
                on:mouseleave={hideDropdown}
              >
                <button
                  class="nav-link {activeTab === tab ? 'active' : ''}"
                  on:click={handleSwapClick}
                >
                  {tab.toUpperCase()}
                  <ChevronDown size={16} />
                </button>
                
                {#if activeDropdown === 'swap'}
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 150 }}>
                    <div class="px-5 pb-3 text-xs font-semibold tracking-wider text-kong-text-secondary border-b border-kong-border mb-2">SWAP OPTIONS</div>
                    {#each swapOptions as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-150 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        on:click={() => handleSwapOptionClick(option)}
                        class:disabled={option.comingSoon}
                      >
                        <div class="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-md bg-kong-text-primary/5 text-kong-text-primary transition-all duration-300 ease-out transform group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">{option.label}</span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm text-kong-text-secondary leading-normal">{option.description}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <button
                class="nav-link {activeTab === tab ? 'active' : ''}"
                on:click={async () => {
                  await goto(`/${tab}`);
                  onTabChange(tab);
                  goto(`/${tab}`);
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
      <div class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        <button class="flex items-center hover:opacity-90 transition-opacity" on:click={() => goto("/")}>
          <img 
            src="/titles/logo-white-wide.png"
            alt="Kong Logo" 
            class="h-6 transition-all duration-200"
            class:light-logo={$themeStore === 'light'}
          />
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

        {#if $auth.isConnected}
          {#if process.env.DFX_NETWORK === 'local' || process.env.DFX_NETWORK === 'staging'}
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
          class="h-[34px] px-3.5 flex items-center gap-1.5 rounded-md text-sm font-semibold text-kong-text-primary bg-kong-primary/15 border border-kong-primary/30 transition-all duration-150 hover:bg-kong-primary/20 hover:border-kong-primary/40"
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
    <div class="mobile-menu-content" transition:slide={{ duration: 200, axis: "x" }}>
      <div class="mobile-menu-header">
        <img 
          src="/titles/logo-white-wide.png"
          alt="Kong Logo" 
          class="logo-wide"
        />
        <button class="mobile-close-btn" on:click={() => (navOpen = false)}>
          <X size={20} />
        </button>
      </div>

      <nav class="mobile-nav">
        <div class="mobile-nav-section">
          {#each tabs as tab}
            {#if tab === 'earn'}
              <div class="mobile-nav-group">
                <div class="mobile-nav-group-title">EARN</div>
                {#each earnOptions as option}
                  <button
                    class="mobile-nav-btn {activeTab === 'earn' && option.path === '/pools' ? 'active' : ''}"
                    on:click={() => {
                      if (!option.comingSoon) {
                        onTabChange('earn');
                        goto(option.path);
                        navOpen = false;
                      }
                    }}
                    class:disabled={option.comingSoon}
                  >
                    <div class="mobile-nav-btn-icon">
                      <svelte:component this={option.icon} size={18} />
                    </div>
                    <div class="mobile-nav-btn-content">
                      <span>{option.label}</span>
                      {#if option.comingSoon}
                        <span class="coming-soon-badge">Soon</span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            {:else if tab === 'swap'}
              <div class="mobile-nav-group mb-0">
                <div class="mobile-nav-group-title">SWAP</div>
                {#each swapOptions as option}
                  <button
                    class="mobile-nav-btn {activeTab === 'swap' && $page.url.pathname === option.path ? 'active' : ''}"
                    on:click={() => {
                      if (!option.comingSoon) {
                        handleSwapOptionClick(option);
                        navOpen = false;
                      }
                    }}
                    class:disabled={option.comingSoon}
                  >
                    <div class="mobile-nav-btn-icon">
                      <svelte:component this={option.icon} size={18} />
                    </div>
                    <div class="mobile-nav-btn-content">
                      <span>{option.label}</span>
                      {#if option.comingSoon}
                        <span class="coming-soon-badge">Soon</span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            {:else if tab === 'stats'}
              <div class="mobile-nav-group">
                <div class="mobile-nav-group-title">STATS</div>
                <button
                  class="mobile-nav-btn {activeTab === 'stats' ? 'active' : ''}"
                  on:click={() => {
                    onTabChange('stats');
                    goto('/stats');
                    navOpen = false;
                  }}
                >
                  <div class="mobile-nav-btn-icon">
                    <Award size={18} />
                  </div>
                  <span>Statistics</span>
                </button>
              </div>
            {/if}
          {/each}
        </div>

        <div class="mobile-nav-section">
          <div class="mobile-nav-section-title">ACCOUNT</div>
          <button class="mobile-nav-btn" on:click={handleOpenSettings}>
            <div class="mobile-nav-btn-icon bg-kong-text-primary/10">
              <SettingsIcon size={18} />
            </div>
            <span>Settings</span>
          </button>

          {#if $auth.isConnected}
            {#if process.env.DFX_NETWORK === 'local' || process.env.DFX_NETWORK === 'staging'}
              <button class="mobile-nav-btn" on:click={claimTokens}>
                <div class="mobile-nav-btn-icon bg-kong-text-primary/10">
                  <Droplet size={18} />
                </div>
                <span>Claim Tokens</span>
              </button>
            {/if}

            <button class="mobile-nav-btn" on:click={() => copyToClipboard(auth.pnp?.account?.owner)}>
              <div class="mobile-nav-btn-icon bg-kong-text-primary/10">
                <Copy size={18} />
              </div>
              <span>Copy Principal ID</span>
            </button>
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
    on:close={() => showSettings = false}
  >
    <Settings on:close={() => showSettings = false} />
  </Modal>
{/if}

{#if $sidebarStore.isOpen}
  <div class="sidebar-portal">
    <div 
      class="sidebar-backdrop"
      transition:fade={{ duration: 150 }}
      on:click={() => sidebarStore.close()}
    />
    <Sidebar
      isOpen={true}
      onClose={() => sidebarStore.close()}
    />
  </div>
{/if}

<style scoped lang="postcss">

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



  /* Mobile Menu */
  .mobile-menu-content {
    @apply fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col;
    @apply bg-kong-bg-dark border-r border-kong-border;
  }

  .mobile-menu-header {
    @apply flex items-center justify-between p-5 border-b border-kong-border;
  }

  .mobile-menu-header .logo-wide {
    filter: brightness(var(--logo-brightness, 1)) invert(var(--logo-invert, 0));
  }

  .mobile-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-200 text-sm font-medium;
  }

  .mobile-nav-btn:hover,
  .mobile-nav-btn.active {
    color: theme(colors.kong.text-primary);
    @apply bg-kong-text-primary/10 border-kong-border-light light:border-gray-800/20;
  }

  .nav-dropdown {
    @apply relative z-[60];
  }

  .nav-dropdown .nav-link {
    @apply flex items-center gap-1;
  }

  .nav-dropdown::after {
    @apply content-[''] absolute top-full left-0 w-full h-2 bg-transparent;
  }


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
    @apply w-8 h-8 flex items-center justify-center rounded-lg text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/5 hover:bg-kong-text-primary/10 transition-colors duration-200;
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

  .mobile-nav-group {
    @apply mb-3;
  }

  .mobile-nav-group-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2;
  }

  .mobile-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-200 text-sm font-medium;
  }

  .mobile-nav-btn.active {
    @apply text-kong-text-primary bg-kong-primary/10;
  }

  .mobile-nav-btn-icon {
    @apply flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-kong-text-primary/5;
  }

  .mobile-nav-btn-content {
    @apply flex items-center justify-between flex-1;
  }

  .mobile-menu-footer {
    @apply p-4 border-t border-kong-border;
  }

  .mobile-wallet-btn {
    @apply w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-kong-primary/15 hover:bg-kong-primary/20 text-kong-text-primary font-semibold border border-kong-primary/30 hover:border-kong-primary/40 transition-all duration-200;
  }

  .coming-soon-badge {
    @apply text-[10px] font-medium px-2 py-0.5 rounded bg-kong-primary/20 text-kong-primary;
  }

  .sidebar-portal {
    @apply fixed inset-0 z-[100] isolate;
  }

  .sidebar-backdrop {
    @apply fixed inset-0 bg-black/20 backdrop-blur-[4px];
  }

  /* Update logo styles */
  .light-logo {
    @apply invert brightness-[0.75] transition-all duration-200;
  }
</style>
