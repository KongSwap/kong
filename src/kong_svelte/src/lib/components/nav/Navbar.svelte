<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { onMount } from "svelte";
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
    Trophy,
    Bell,
    Joystick,
    ChevronDown,
  } from "lucide-svelte";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { themeStore } from "$lib/stores/themeStore";
  import NavOption from "./NavOption.svelte";
  import MobileNavGroup from "./MobileNavGroup.svelte";
  import MobileMenuItem from "./MobileMenuItem.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import { userTokens } from "$lib/stores/userTokens";
  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import { writable } from "svelte/store";
  import NavbarButton from "./NavbarButton.svelte";
  import WalletProvider from "$lib/components/wallet/WalletProvider.svelte";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";

  // Computed directly where needed using $themeStore
  let isWin98Theme = $derived(browser && $themeStore === "win98light");

  // Update logo when theme changes
  $effect(() => {
    if (browser && $themeStore) {
      // Small delay to ensure CSS variables are updated
      setTimeout(updateLogoSrc, 50);
    }
  });

  // Create a writable store for the logo source
  const logoSrcStore = writable("/titles/logo-white-wide.png");

  // Update the logo when theme changes
  function updateLogoSrc() {
    if (browser) {
      const cssLogoPath = getComputedStyle(document.documentElement)
        .getPropertyValue("--logo-path")
        .trim();
      logoSrcStore.set(cssLogoPath || "/titles/logo-white-wide.png");
    }
  }

  let isMobile = $state(false);
  let activeTab = $state<"swap" | "predict" | "earn" | "stats">("swap");
  let navOpen = $state(false);
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown = $state<"swap" | "earn" | "stats" | null>(null);
  let showWalletSidebar = $state(false);
  let showWalletProvider = $state(false);
  let walletSidebarActiveTab = $state<"notifications" | "chat" | "wallet">(
    "notifications",
  );

  // Toggle wallet sidebar
  function toggleWalletSidebar(
    tab: "notifications" | "chat" | "wallet" = "notifications",
  ) {
    walletSidebarActiveTab = tab;
    showWalletSidebar = !showWalletSidebar;
  }

  // Close wallet sidebar
  function closeWalletSidebar() {
    showWalletSidebar = false;
  }

  function closeWalletProvider() {
    showWalletProvider = false;
  }

  // Filter tabs based on DFX_NETWORK
  const allTabs = ["swap", "predict", "earn", "stats"] as const;
  const tabs = process.env.DFX_NETWORK !== "ic" ? allTabs : allTabs;

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
    {
      label: "Leaderboards",
      description: "View trading leaderboards",
      path: "/stats/leaderboard",
      icon: Trophy,
      comingSoon: false,
    },
  ];

  function handleConnect() {
    // If user is not authenticated, show the wallet provider
    if (!$auth.isConnected) {
      showWalletProvider = true;
      return;
    }

    // Otherwise, show the wallet sidebar
    // If there are unread notifications, open the notifications tab first
    // Otherwise, open the wallet tab
    const activeTab =
      $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }

  function checkMobile() {
    isMobile = window.innerWidth < 768;
  }

  onMount(() => {
    // Initially set logo src
    updateLogoSrc();

    // Subscribe to theme changes
    const unsubscribe = themeStore.subscribe(() => {
      // Add a small delay to ensure CSS variables are updated
      setTimeout(updateLogoSrc, 50);
    });

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      unsubscribe();
      if (browser) {
        window.removeEventListener("resize", checkMobile);
      }
    };
  });

  function onTabChange(tab: "swap" | "earn" | "stats" | "predict") {
    activeTab = tab;
  }

  async function claimTokens() {
    await faucetClaim();
    await loadBalances($userTokens.tokens, $auth.account.owner, true);
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
      label: "Airdrop Claims",
      description: "Claim your airdrop tokens",
      path: "/airdrop-claims",
      icon: Award,
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

  $effect(() => {
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
  });

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
          <Menu
            size={20}
            color={browser &&
            getThemeById($themeStore)?.colors?.logoInvert === 1
              ? "black"
              : "white"}
          />
        </button>
      {:else}
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          on:click={() => goto("/swap")}
        >
          <img
            src={$logoSrcStore}
            alt="Kong Logo"
            class="h-[30px] transition-all duration-200 navbar-logo"
            class:light-logo={browser &&
              getThemeById($themeStore)?.colors?.logoInvert === 1}
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
      <div
        class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
      >
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          on:click={() => goto("/")}
        >
          <img
            src={$logoSrcStore}
            alt="Kong Logo"
            class="h-6 transition-all duration-200 navbar-logo"
            class:light-logo={browser &&
              getThemeById($themeStore)?.colors?.logoInvert === 1}
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
        <NavbarButton
          icon={SettingsIcon}
          onClick={() => goto("/settings")}
          tooltipText="Settings"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
        />

        <NavbarButton
          icon={Search}
          onClick={handleOpenSearch}
          tooltipText="Search"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
        />

        {#if $auth.isConnected}
          {#if process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging"}
            <NavbarButton
              icon={Droplet}
              onClick={claimTokens}
              tooltipText="Claim test tokens"
              useThemeBorder={isWin98Theme}
              customBgColor={browser &&
                getThemeById($themeStore)?.colors?.buttonBg}
              customHoverBgColor={browser &&
                getThemeById($themeStore)?.colors?.buttonHoverBg}
              customTextColor={browser &&
                getThemeById($themeStore)?.colors?.buttonText}
              customBorderStyle={browser &&
                getThemeById($themeStore)?.colors?.buttonBorder}
              customBorderColor={browser &&
                getThemeById($themeStore)?.colors?.buttonBorderColor}
              customShadow={browser &&
                getThemeById($themeStore)?.colors?.buttonShadow}
            />
          {/if}

          <NavbarButton
            icon={Copy}
            label="PID"
            onClick={() => copyToClipboard($auth?.account?.owner)}
            tooltipText="Copy Principal ID"
            useThemeBorder={isWin98Theme}
            customBgColor={browser &&
              getThemeById($themeStore)?.colors?.buttonBg}
            customHoverBgColor={browser &&
              getThemeById($themeStore)?.colors?.buttonHoverBg}
            customTextColor={browser &&
              getThemeById($themeStore)?.colors?.buttonText}
            customBorderStyle={browser &&
              getThemeById($themeStore)?.colors?.buttonBorder}
            customBorderColor={browser &&
              getThemeById($themeStore)?.colors?.buttonBorderColor}
            customShadow={browser &&
              getThemeById($themeStore)?.colors?.buttonShadow}
          />
        {/if}

        <NavbarButton
          icon={Wallet}
          label={$auth.isConnected ? null : "Connect"}
          onClick={handleConnect}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          useThemeBorder={isWin98Theme}
          customBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorderColor}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
        />
      {:else}
        <NavbarButton
          icon={Search}
          onClick={handleOpenSearch}
          variant="mobile"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
        />

        <NavbarButton
          icon={Wallet}
          onClick={handleConnect}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="mobile"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
        />
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
          src={$logoSrcStore}
          alt="Kong Logo"
          class="logo-wide navbar-logo"
          class:light-logo={browser &&
            getThemeById($themeStore)?.colors?.logoInvert === 1}
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
        </div>

        <div class="mobile-nav-section">
          <div class="mobile-nav-section-title">ACCOUNT</div>
          <MobileMenuItem
            label="Settings"
            icon={SettingsIcon}
            onClick={() => {
              goto("/settings");
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
                copyToClipboard($auth?.account?.owner);
                navOpen = false;
              }}
              iconBackground="bg-kong-text-primary/10"
            />
          {/if}

          <MobileMenuItem
            label="Notifications"
            icon={Bell}
            onClick={() => {
              toggleWalletSidebar("notifications");
              navOpen = false;
            }}
            iconBackground="bg-kong-text-primary/10"
            badgeCount={$notificationsStore.unreadCount}
          />
        </div>
      </nav>

      <div class="mobile-menu-footer">
        <NavbarButton
          icon={Wallet}
          label={$auth.isConnected ? "Wallet" : "Connect Wallet"}
          onClick={() => {
            handleConnect();
            navOpen = false;
          }}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          iconSize={20}
          class="mobile-wallet-btn"
          useThemeBorder={isWin98Theme}
          customBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorderColor}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
        />
      </div>
    </div>
  </div>
{/if}

<WalletSidebar
  isOpen={showWalletSidebar}
  activeTab={walletSidebarActiveTab}
  onClose={closeWalletSidebar}
/>
{#if browser}
  <WalletProvider
    isOpen={showWalletProvider}
    onClose={closeWalletProvider}
    onLogin={() => {
      // Handle login if needed
    }}
  />
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

  /* Logo styles */
  .light-logo {
    @apply invert brightness-[var(--logo-brightness,0.8)] transition-all duration-200;
  }

  .mobile-menu-header .logo-wide {
    @apply transition-all duration-200 max-h-8 w-auto;
  }

  .mobile-menu-header .logo-wide.light-logo {
    @apply invert brightness-[var(--logo-brightness,0.2)];
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
