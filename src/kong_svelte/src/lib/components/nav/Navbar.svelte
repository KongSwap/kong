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
    ChevronDown,
    Gamepad as Joystick,
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
  import { swapModeService } from "$lib/services/settings/swapModeService";

  let showSettings = false;
  let isMobile = false;
  let activeTab: "swap" | "predict" | "earn" | "stats" | "launch" = "swap";
  let navOpen = false;
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown: 'swap' | 'earn' | 'stats' | 'launch' | 'predict' | null = null;
  
  // Filter tabs based on DFX_NETWORK
  const allTabs = ["swap", "predict", "earn", "stats", "launch"] as const;
  $: tabs =
    process.env.DFX_NETWORK !== "ic"
      ? allTabs
      : allTabs.filter((tab) => tab !== "predict");

  const launchOptions = [
    {
      label: 'Launchpad',
      description: 'View and manage launchpad tokens',
      path: '/launch',
      icon: Coins,
      comingSoon: false
    },
    {
      label: 'Create Miner',
      description: 'Launch your own miner on Kong',
      path: '/launch/create-miner',
      icon: PiggyBank,
      comingSoon: false
    },
    {
      label: 'My Canisters',
      description: 'Manage your deployed canisters',
      path: '/launch/my-canisters',
      icon: Joystick,
      comingSoon: false
    }
  ];

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

  function showDropdown(type: 'swap' | 'earn' | 'stats' | 'launch' | 'predict') {
    clearTimeout(closeTimeout);
    activeDropdown = type;
  }

  function hideDropdown() {
    closeTimeout = setTimeout(() => {
      activeDropdown = null;
    }, 50);
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
    if (path.startsWith('/swap')) {
      activeTab = 'swap';
    } else if (path.startsWith('/earn') || path.startsWith('/pools')) {
      activeTab = 'earn';
    } else if (path.startsWith('/stats')) {
      activeTab = 'stats';
    } else if (path.startsWith('/predict')) {
      activeTab = 'predict';
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
      }, 50);
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

<div class="relative top-0 left-0 z-50 w-full pt-2 mb-4">
  <div class="flex items-center justify-between h-16 px-6 mx-auto">
    <div class="flex items-center gap-10">
      {#if isMobile}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center"
          on:click={() => (navOpen = !navOpen)}
        >
          <Menu size={20} color={$themeStore === "dark" ? "white" : "black"} />
        </button>
      {:else}
        <button class="flex items-center transition-opacity hover:opacity-90" on:click={() => goto("/swap")}>
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
            {#if tab === 'launch'}
              <div 
                class="nav-dropdown"
                on:mouseenter={() => showDropdown('launch')}
                on:mouseleave={hideDropdown}
              >
                <button
                  class="nav-link {$page.url.pathname.startsWith('/launch') ? 'active' : ''}"
                  on:click={() => goto('/launch')}
                >
                  {tab.toUpperCase()}
                  <ChevronDown size={16} />
                </button>
                
                {#if activeDropdown === 'launch'}
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 50 }}>
                    <div class="px-5 pb-3 mb-2 text-xs font-semibold tracking-wider border-b text-kong-text-secondary border-kong-border">LAUNCH OPTIONS</div>
                    {#each launchOptions as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-50 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        class:active={$page.url.pathname === option.path}
                        on:click={() => {
                          if (!option.comingSoon) {
                            hideDropdown();
                            goto(option.path);
                          }
                        }}
                        class:disabled={option.comingSoon}
                      >
                        <div class="flex items-center justify-center flex-shrink-0 transition-all ease-out transform rounded-md duration-50 w-11 h-11 bg-kong-text-primary/5 text-kong-text-primary group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">
                              {option.label}
                            </span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm leading-normal text-kong-text-secondary">{option.description}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if tab === 'earn'}
              <div 
                class="nav-dropdown"
                on:mouseenter={() => showDropdown('earn')}
                on:mouseleave={hideDropdown}
              >
                <button
                  class="nav-link {activeTab === tab ? 'active' : ''}"
                  on:click={() => goto('/pools')}
                >
                  {tab.toUpperCase()}
                  <ChevronDown size={16} />
                </button>
                
                {#if activeDropdown === 'earn'}
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 50 }}>
                    <div class="px-5 pb-3 mb-2 text-xs font-semibold tracking-wider border-b text-kong-text-secondary border-kong-border">EARN OPTIONS</div>
                    {#each earnOptions as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-50 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        class:active={$page.url.pathname === option.path}
                        on:click={async () => {
                          if (!option.comingSoon) {
                            hideDropdown();
                            await goto(option.path);
                            onTabChange('earn');
                          }
                        }}
                        class:disabled={option.comingSoon}
                      >
                        {console.log('Earn option:', option.path, 'Current path:', $page.url.pathname, 'Active:', $page.url.pathname === option.path)}
                        <div class="flex items-center justify-center flex-shrink-0 transition-all ease-out transform rounded-md duration-50 w-11 h-11 bg-kong-text-primary/5 text-kong-text-primary group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">
                              {option.label}
                            </span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm leading-normal text-kong-text-secondary">{option.description}</span>
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
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 50 }}>
                    <div class="px-5 pb-3 mb-2 text-xs font-semibold tracking-wider border-b text-kong-text-secondary border-kong-border">SWAP OPTIONS</div>
                    {#each swapOptions as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-50 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        class:active={$page.url.pathname === option.path}
                        on:click={() => handleSwapOptionClick(option)}
                        class:disabled={option.comingSoon}
                      >
                        <div class="flex items-center justify-center flex-shrink-0 transition-all ease-out transform rounded-md duration-50 w-11 h-11 bg-kong-text-primary/5 text-kong-text-primary group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">
                              {option.label}
                            </span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm leading-normal text-kong-text-secondary">{option.description}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if tab === 'stats'}
              <div 
                class="nav-dropdown"
                on:mouseenter={() => showDropdown('stats')}
                on:mouseleave={hideDropdown}
              >
                <button
                  class="nav-link {activeTab === tab ? 'active' : ''}"
                  on:click={() => goto('/stats')}
                >
                  {tab.toUpperCase()}
                  <ChevronDown size={16} />
                </button>
                
                {#if activeDropdown === 'stats'}
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 50 }}>
                    <div class="px-5 pb-3 mb-2 text-xs font-semibold tracking-wider border-b text-kong-text-secondary border-kong-border">STATS OPTIONS</div>
                    {#each dataOptions as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-50 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        class:active={$page.url.pathname === option.path}
                        on:click={async () => {
                          if (!option.comingSoon) {
                            hideDropdown();
                            await goto(option.path);
                            onTabChange('stats');
                          }
                        }}
                        class:disabled={option.comingSoon}
                      >
                        <div class="flex items-center justify-center flex-shrink-0 transition-all ease-out transform rounded-md duration-50 w-11 h-11 bg-kong-text-primary/5 text-kong-text-primary group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">
                              {option.label}
                            </span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm leading-normal text-kong-text-secondary">{option.description}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if tab === 'predict'}
              <div 
                class="nav-dropdown"
                on:mouseenter={() => showDropdown('predict')}
                on:mouseleave={hideDropdown}
              >
                <button
                  class="nav-link {activeTab === tab ? 'active' : ''}"
                  on:click={() => goto('/predict')}
                >
                  {tab.toUpperCase()}
                  <ChevronDown size={16} />
                </button>
                
                {#if activeDropdown === 'predict'}
                  <div class="absolute top-full left-[-20px] min-w-[480px] p-3 bg-kong-bg-dark/70 backdrop-blur-md border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 50 }}>
                    <div class="px-5 pb-3 mb-2 text-xs font-semibold tracking-wider border-b text-kong-text-secondary border-kong-border">PREDICT OPTIONS</div>
                    {#each [
                      {
                        label: "Prediction Markets",
                        description: "Trade on future outcomes",
                        path: "/predict",
                        icon: TrendingUpDown,
                        comingSoon: false,
                      },
                    ] as option}
                      <button
                        class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-50 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
                        class:active={$page.url.pathname === option.path}
                        on:click={() => {
                          hideDropdown();
                          goto(option.path);
                        }}
                        class:disabled={option.comingSoon}
                      >
                        <div class="flex items-center justify-center flex-shrink-0 transition-all ease-out transform rounded-md duration-50 w-11 h-11 bg-kong-text-primary/5 text-kong-text-primary group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
                          <svelte:component this={option.icon} size={20} />
                        </div>
                        <div class="flex flex-col gap-1 pt-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">
                              {option.label}
                            </span>
                            {#if option.comingSoon}
                              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
                            {/if}
                          </div>
                          <span class="text-sm leading-normal text-kong-text-secondary">{option.description}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </nav>
      {/if}
    </div>

    {#if isMobile}
      <div class="absolute flex items-center justify-center -translate-x-1/2 left-1/2">
        <button class="flex items-center transition-opacity hover:opacity-90" on:click={() => goto("/")}>
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
          class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-50 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
          on:click={handleOpenSettings}
          use:tooltip={{ text: "Settings", direction: "bottom" }}
        >
          <SettingsIcon size={18} />
        </button>

        <button
          class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
          on:click={handleOpenSearch}
          use:tooltip={{ text: "Search", direction: "bottom" }}
        >
          <Search size={18} />
        </button>
        
        {#if $auth.isConnected}
          {#if process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging"}
            <button
              class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-50 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
              on:click={claimTokens}
              use:tooltip={{ text: "Claim test tokens", direction: "bottom" }}
            >
              <Droplet size={18} />
            </button>
          {/if}

          <button
            class="h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-50 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
            on:click={() => copyToClipboard(auth.pnp?.account?.owner)}
            use:tooltip={{ text: "Copy Principal ID", direction: "bottom" }}
          >
            <Copy size={18} />
            <span>PID</span>
          </button>
        {/if}

        <button
          class="h-[34px] px-3.5 flex items-center gap-1.5 rounded-md text-sm font-semibold text-kong-text-primary/95 bg-kong-primary/40 border border-kong-primary/80 transition-all duration-50 hover:bg-kong-primary/60 hover:border-kong-primary/90"
          class:selected={$sidebarStore.isOpen}
          on:click={handleConnect}
        >
          <Wallet size={18} />
          <span>{$auth.isConnected ? "Wallet" : "Connect"}</span>
        </button>
      {:else}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center rounded-md text-kong-text-primary bg-kong-primary/15 border border-kong-primary/30 transition-all duration-50 hover:bg-kong-primary/20 hover:border-kong-primary/40"
          class:selected={$sidebarStore.isOpen}
          on:click={handleOpenSearch}
        >
          <Search size={18} />
        </button>
        
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
  <div class="mobile-menu" transition:fade={{ duration: 50 }}>
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
          {#each tabs as tab}
            {#if tab === 'launch'}
              <div class="mobile-nav-group">
                <div class="mobile-nav-group-title">LAUNCH</div>
                {#each launchOptions as option}
                  <MobileMenuItem
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      if (!option.comingSoon) {
                        navOpen = false;
                        goto(option.path);
                      }
                    }}
                    isActive={$page.url.pathname === option.path}
                    iconBackground="bg-kong-text-primary/5"
                    comingSoon={option.comingSoon}
                  />
                {/each}
              </div>
            {:else if tab === 'earn'}
              <div class="mobile-nav-group">
                <div class="mobile-nav-group-title">EARN</div>
                {#each earnOptions as option}
                  <MobileMenuItem
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      if (!option.comingSoon) {
                        onTabChange('earn');
                        goto(option.path);
                        navOpen = false;
                      }
                    }}
                    isActive={activeTab === 'earn' && option.path === '/pools'}
                    iconBackground="bg-kong-text-primary/5"
                    comingSoon={option.comingSoon}
                  />
                {/each}
              </div>
            {:else if tab === 'swap'}
              <div class="mb-0 mobile-nav-group">
                <div class="mobile-nav-group-title">SWAP</div>
                {#each swapOptions as option}
                  <MobileMenuItem
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      if (!option.comingSoon) {
                        handleSwapOptionClick(option);
                        navOpen = false;
                      }
                    }}
                    isActive={activeTab === 'swap' && $page.url.pathname === option.path}
                    iconBackground="bg-kong-text-primary/5"
                    comingSoon={option.comingSoon}
                  />
                {/each}
              </div>
            {:else if tab === 'stats'}
              <div class="mobile-nav-group">
                <div class="mobile-nav-group-title">STATS</div>
                {#each dataOptions as option}
                  <MobileMenuItem
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      if (!option.comingSoon) {
                        onTabChange('stats');
                        goto(option.path);
                        navOpen = false;
                      }
                    }}
                    isActive={activeTab === 'stats' && $page.url.pathname === option.path}
                    iconBackground="bg-kong-text-primary/5"
                    comingSoon={option.comingSoon}
                  />
                {/each}
              </div>
            {:else if tab === 'predict'}
              <div class="mobile-nav-group">
                <div class="mobile-nav-group-title">PREDICT</div>
                {#each [
                  {
                    label: "Prediction Markets",
                    description: "Trade on future outcomes",
                    path: "/predict",
                    icon: TrendingUpDown,
                    comingSoon: false,
                  },
                ] as option}
                  <MobileMenuItem
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      hideDropdown();
                      goto(option.path);
                      navOpen = false;
                    }}
                    isActive={activeTab === 'predict' && $page.url.pathname === option.path}
                    iconBackground="bg-kong-text-primary/5"
                    comingSoon={option.comingSoon}
                  />
                {/each}
              </div>
            {/if}
          {/each}
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

  .mobile-nav-group {
    @apply mb-4;
  }

  .mobile-nav-group-title {
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
    @apply transition-all duration-200 max-h-8 w-auto;
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

  /* Dropdown positioning fix */
  .nav-dropdown {
    @apply relative;
  }
</style>
