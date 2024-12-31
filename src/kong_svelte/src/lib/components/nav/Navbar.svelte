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

<div class="nav-container-wrapper mt-2">
  <div class="nav-container">
    <div class="left-section">
      {#if isMobile}
        <button class="mobile-icon-btn" on:click={() => (navOpen = !navOpen)}>
          <Menu size={20} color={$themeStore === "dark" ? "white" : "black"} />
        </button>
      {:else}
        <button class="logo-link" on:click={() => goto("/")}>
          <img 
            src="/titles/logo-white-wide.png"
            alt="Kong Logo" 
            class="logo-wide"
          />
        </button>

        <nav class="nav-tabs">
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
                  <div class="dropdown-menu" transition:fade={{ duration: 150 }}>
                    <div class="dropdown-header">EARN OPTIONS</div>
                    {#each earnOptions as option}
                      <button
                        class="dropdown-item"
                        on:click={async () => {
                          if (!option.comingSoon) {
                            hideDropdown();
                            await goto(option.path);
                            onTabChange('earn');
                          }
                        }}
                        class:disabled={option.comingSoon}
                      >
                        <div class="dropdown-item-icon">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="dropdown-item-content">
                          <div class="dropdown-item-title-row">
                            <span class="dropdown-item-title">{option.label}</span>
                            {#if option.comingSoon}
                              <span class="coming-soon-badge">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="dropdown-item-description">{option.description}</span>
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
                  <div class="dropdown-menu" transition:fade={{ duration: 150 }}>
                    <div class="dropdown-header">SWAP OPTIONS</div>
                    {#each swapOptions as option}
                      <button
                        class="dropdown-item"
                        on:click={() => handleSwapOptionClick(option)}
                        class:disabled={option.comingSoon}
                      >
                        <div class="dropdown-item-icon">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="dropdown-item-content">
                          <div class="dropdown-item-title-row">
                            <span class="dropdown-item-title">{option.label}</span>
                            {#if option.comingSoon}
                              <span class="coming-soon-badge">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="dropdown-item-description">{option.description}</span>
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
      <div class="center-section">
        <button class="logo-link" on:click={() => goto("/")}>
          <img 
            src="/titles/logo-white-wide.png"
            alt="Kong Logo" 
            class="logo-wide"
          />
        </button>
      </div>
    {/if}

    <div class="right-section">
      {#if !isMobile}
        <button
          class="action-btn"
          on:click={handleOpenSettings}
          use:tooltip={{ text: "Settings", direction: "bottom" }}
        >
          <SettingsIcon size={18} />
        </button>

        {#if $auth.isConnected}
          {#if process.env.DFX_NETWORK === 'local' || process.env.DFX_NETWORK === 'staging'}
            <button
              class="action-btn"
              on:click={claimTokens}
              use:tooltip={{ text: "Claim test tokens", direction: "bottom" }}
            >
              <Droplet size={18} />
            </button>
          {/if}

          <button
            class="action-btn"
            on:click={() => copyToClipboard(auth.pnp?.account?.owner)}
            use:tooltip={{ text: "Copy Principal ID", direction: "bottom" }}
          >
            <Copy size={18} />
            <span>PID</span>
          </button>
        {/if}

        <button
          class="action-btn wallet-btn"
          class:selected={$sidebarStore.isOpen}
          on:click={handleConnect}
        >
          <Wallet size={18} />
          <span>{$auth.isConnected ? "Wallet" : "Connect"}</span>
        </button>
      {:else}
        <button
          class="action-btn wallet-btn mobile-wallet-btn"
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
  @font-face {
    font-family: "Space Grotesk";
    src: url("/fonts/Alumni-Sans-Latin.woff2") format("woff2");
    font-weight: normal;
    font-style: normal;
  }

  .nav-container-wrapper {
    @apply mb-4;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 50;
    position: relative;
  }

  .nav-container {
    margin: 0 auto;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
  }

  /* Left Section */
  .left-section {
    display: flex;
    align-items: center;
    gap: 40px;
  }

  .logo-link {
    display: flex;
    align-items: center;
  }

  .logo-wide {
    height: 30px;
    transition: all 0.2s ease;
    filter: brightness(var(--logo-brightness, 1)) invert(var(--logo-invert, 0));
  }

  .logo-link:hover .logo-wide {
    filter: brightness(var(--logo-hover-brightness, 0.9)) invert(var(--logo-invert, 0));
  }

  /* Navigation */
  .nav-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .nav-link {
    position: relative;
    height: 64px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: theme(colors.kong.text-secondary);
    letter-spacing: 0.3px;
    transition: all 0.2s ease;
  }

  .nav-link:hover {
    color: theme(colors.kong.text-primary);
  }

  .nav-link.active {
    color: theme(colors.kong.primary);
    text-shadow: 0 0px 30px theme(colors.kong.primary);
  }

  /* Right Section */
  .right-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Action Buttons */
  .action-btn {
    height: 34px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: theme(colors.kong.text-secondary);
    @apply bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    color: theme(colors.kong.text-primary);
    @apply bg-kong-text-primary/10 border-kong-border-light;
  }

  .wallet-btn {
    background: theme(colors.kong.primary / 15%);
    border: 1px solid theme(colors.kong.primary / 30%);
    color: theme(colors.kong.text-primary);
    padding: 0 14px;
    height: 34px;
    font-weight: 600;
  }

  .wallet-btn:hover {
    background: theme(colors.kong.primary / 20%);
    border-color: theme(colors.kong.primary / 40%);
  }

  .wallet-btn.selected {
    background: theme(colors.kong.primary / 25%);
    border-color: theme(colors.kong.primary / 50%);
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
    height: 40px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: theme(colors.kong.text-secondary);
    transition: all 0.15s ease;
  }

  .mobile-nav-btn:hover,
  .mobile-nav-btn.active {
    color: theme(colors.kong.text-primary);
    @apply bg-kong-text-primary/10 border-kong-border-light light:border-gray-800/20;
  }

  .nav-dropdown {
    position: relative;
    z-index: 60;
  }

  .nav-dropdown .nav-link {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100%);
    left: -20px;
    min-width: 480px;
    padding: 12px;
    @apply bg-kong-bg-dark/70;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    @apply border border-kong-border;
    @apply rounded-md;
    box-shadow: 
      0 8px 32px rgb(0 0 0 / 0.2),
      0 0 0 1px rgb(var(--text-primary) / 0.02);
    z-index: 61;
  }

  .dropdown-header {
    padding: 0 20px 12px 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: theme(colors.kong.text-secondary);
    border-bottom: 1px solid theme(colors.kong.border);
    margin-bottom: 8px;
  }

  .dropdown-item {
    width: 100%;
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: center;
    text-align: left;
    @apply relative rounded-md overflow-hidden text-left px-4 py-4;
    transition: all 0.15s ease;
  }

  .dropdown-item-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    @apply rounded-md;
    @apply bg-kong-text-primary/5;
    color: theme(colors.kong.text-primary);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: scale(0.9);
  }

  .dropdown-item-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .dropdown-item-title {
    font-size: 15px;
    font-weight: 600;
    color: theme(colors.kong.text-primary);
  }

  .dropdown-item:hover .dropdown-item-title {
    color: theme(colors.kong.primary);
  }

  .dropdown-item-description {
    font-size: 13px;
    color: theme(colors.kong.text-secondary);
    line-height: 1.5;
  }

  .dropdown-item:hover {
    @apply bg-kong-text-primary/5;
  }

  .dropdown-item:hover .dropdown-item-icon {
    transform: scale(1.1);
    @apply bg-kong-text-primary/10;
    color: theme(colors.kong.primary);
  }

  .dropdown-item:hover .dropdown-item-content {
    transform: none;
  }

  /* Add a subtle arrow/pointer to the dropdown */
  .dropdown-menu::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 40px;
    width: 8px;
    height: 8px;
    transform: rotate(45deg);
    @apply bg-kong-bg-dark/95;
    @apply border-l border-t border-kong-border;
  }

  /* Update mobile menu to include dropdown items */
  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
  }

  /* Add a invisible bridge between nav link and dropdown */
  .nav-dropdown::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    height: 8px;
    background: transparent;
  }

  .dropdown-item.disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .dropdown-item.disabled:hover {
    background: transparent;
  }

  .dropdown-item.disabled:hover .dropdown-item-icon {
    transform: none;
    @apply bg-kong-text-primary/5;
  }

  .dropdown-item-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .coming-soon-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    background: theme(colors.kong.primary / 15%);
    color: theme(colors.kong.primary);
    letter-spacing: 0.3px;
  }

  .mobile-nav-btn.disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .mobile-nav-btn-content {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  /* Make the coming-soon-badge smaller in mobile view */
  .mobile-nav-btn .coming-soon-badge {
    font-size: 10px;
    padding: 1px 4px;
  }

  .sidebar-portal {
    position: fixed;
    inset: 0;
    z-index: 100;
    isolation: isolate;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .center-section {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 767px) {
    .nav-container {
      position: relative; /* For absolute positioning of center-section */
    }

    .left-section {
      gap: 0;
    }

    .logo-wide {
      height: 24px;
    }

    .mobile-icon-btn {
      height: 34px;
      width: 34px;
      padding: 0;
    }

    .wallet-btn {
      height: 34px;
      padding: 0 12px;
    }

    /* Hide the wallet button text on very small screens */
    @media (max-width: 360px) {
      .wallet-btn span {
        display: none;
      }
      
      .wallet-btn {
        padding: 0;
        width: 34px;
        justify-content: center;
      }
    }

    .mobile-wallet-btn {
      width: 34px;
      padding: 0;
      justify-content: center;
    }

    .mobile-wallet-btn span {
      display: none;
    }
  }

  .mobile-menu {
    @apply fixed inset-0 z-50;
  }

  .mobile-menu-overlay {
    @apply fixed inset-0 bg-black/50 backdrop-blur-sm;
  }

  .mobile-menu-content {
    @apply fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col;
    @apply bg-kong-bg-dark border-r border-kong-border;
  }

  .mobile-menu-header {
    @apply flex items-center justify-between p-5 border-b border-kong-border;
  }

  .mobile-close-btn {
    @apply w-8 h-8 flex items-center justify-center rounded-lg;
    @apply text-kong-text-secondary hover:text-kong-text-primary;
    @apply bg-kong-text-primary/5 hover:bg-kong-text-primary/10;
    @apply transition-colors duration-200;
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
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2;
    letter-spacing: 0.5px;
  }

  .mobile-nav-group {
    @apply mb-3;
  }

  .mobile-nav-group-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2;
  }

  .mobile-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg;
    @apply text-kong-text-secondary hover:text-kong-text-primary;
    @apply transition-colors duration-200;
    font-size: 14px;
    font-weight: 500;
  }

  .mobile-nav-btn.active {
    @apply text-kong-text-primary bg-kong-primary/10;
  }

  .mobile-nav-btn-icon {
    @apply flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg;
    @apply bg-kong-text-primary/5;
  }

  .mobile-nav-btn-content {
    @apply flex items-center justify-between flex-1;
  }

  .mobile-menu-footer {
    @apply p-4 border-t border-kong-border;
  }

  .mobile-wallet-btn {
    @apply w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg;
    @apply bg-kong-primary/15 hover:bg-kong-primary/20;
    @apply text-kong-text-primary font-semibold;
    @apply border border-kong-primary/30 hover:border-kong-primary/40;
    @apply transition-all duration-200;
  }

  .coming-soon-badge {
    @apply text-[10px] font-medium px-2 py-0.5 rounded;
    @apply bg-kong-primary/20 text-kong-primary;
  }
</style>
