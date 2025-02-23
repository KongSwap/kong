<script lang="ts">
  import '../app.css';
  import { auth, getLedgerActorForBalanceChecks, getSubAccountBalance, getKongActor } from '$lib/services/auth';
  import { onMount } from "svelte";
  import Login from "$lib/components/Login.svelte";
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  // Static data - moved outside component for better performance
  const REFRESH_INTERVAL = 30000;
  const TOAST_DURATION = 2000;
  
  // Use types from our global namespace
  type Activity = Launchpad.Activity;
  type SystemActivity = Launchpad.SystemActivity;
  type TickerActivity = Launchpad.TickerActivity;

  // Type guards
  const isSystemActivity = (activity: Activity): activity is SystemActivity => {
    return activity.type !== 'ticker';
  };

  const isTickerActivity = (activity: Activity): activity is TickerActivity => {
    return activity.type === 'ticker';
  };

  // Updated navigation items with original icons and Explore as default
  const navItems = [
    { href: '/create', label: 'CREATE CANISTER', icon: '⬡', color: 'from-cyan-400 to-blue-500', description: 'Create new canisters' },
    { href: '/canisters', label: 'MY CANISTERS', icon: '◈', color: 'from-blue-400 to-cyan-500', description: 'View and manage your canisters' },
    { href: '/interact', label: 'INTERACT', icon: '◈', color: 'from-blue-400 to-cyan-500', description: 'Interact with canisters' },
    { href: '/subnets', label: 'SUBNETS', icon: '◈', color: 'from-blue-400 to-cyan-500', description: 'View and manage subnets' },
    // Existing items commented out but preserved
    // { href: '/explore', label: 'EXPLORE', icon: '◈', color: 'from-cyan-400 to-blue-500', description: 'Browse tokens across chains' },
    // { href: '/token', label: 'LAUNCH', icon: '⬡', color: 'from-blue-400 to-cyan-500', description: 'Create new tokens' },
    // { href: '/miner', label: 'MINE', icon: '⟡', color: 'from-cyan-400 to-blue-500', description: 'Manage mining operations' },
    // { href: '/portfolio', label: 'ASSETS', icon: '◉', color: 'from-blue-400 to-cyan-500', description: 'View your holdings' },
    // { href: '/', label: 'INFO', icon: '⌘', color: 'from-blue-400 to-cyan-500', description: 'Protocol information' },
    // { href: '/debug', label: 'SYSTEM', icon: '⌬', color: 'from-red-400 to-orange-500', description: 'System settings' }
  ];

  let selectedActivity: Activity | null = null;
  let showActivityModal = false;
  let currentPath = '/create';

  const principalIds = [
    "2vxsx-fae",
    "3fwop-7iaaa",
    "5h74c-raaaa",
    "uqb6p-kiaaa",
    "jg7ba-7iaaa",
  ].map(id => id.slice(0, 8) + "...");

  const recentActivities: SystemActivity[] = Array.from({ length: 15 }, (_, i) => {
    const activities: SystemActivity[] = [
      {
        type: 'launch',
        token: ["PEPE", "WOJAK", "DOGE", "SHIB", "BONK"][i % 5],
        action: 'LAUNCH:',
        principal: principalIds[i % principalIds.length],
        details: `Supply: ${(Math.random() * 1000000).toFixed(0)}`,
        time: `${Math.floor(Math.random() * 59 + 1)}m`,
        color: 'text-green-400',
        hash: `0x${Math.random().toString(16).slice(2, 10)}`
      },
      {
        type: 'miner',
        token: ["COPIUM", "WAGMI", "NGMI", "FOMO"][i % 4],
        action: 'MINER:',
        principal: principalIds[i % principalIds.length],
        details: `${['Basic', 'Normal', 'Premium'][Math.floor(Math.random() * 3)]} Miner`,
        power: `${(Math.random() * 1000).toFixed(0)}H/s`,
        time: `${Math.floor(Math.random() * 59 + 1)}m`,
        color: 'text-blue-400',
        hash: `0x${Math.random().toString(16).slice(2, 10)}`
      },
      {
        type: 'change',
        token: ["WOJAK", "CHAD", "SOYJAK"][i % 3],
        action: 'UPGRADE:',
        principal: principalIds[i % principalIds.length],
        details: `To ${['Basic', 'Normal', 'Premium'][Math.floor(Math.random() * 3)]}`,
        boost: `+${Math.floor(Math.random() * 50) + 10}% Power`,
        time: `${Math.floor(Math.random() * 59 + 1)}m`,
        color: 'text-purple-400',
        hash: `0x${Math.random().toString(16).slice(2, 10)}`
      },
      {
        type: 'topup',
        token: ["PEPE", "WOJAK", "DOGE"][i % 3],
        action: 'TOP UP:',
        principal: principalIds[i % principalIds.length],
        details: `${(Math.random() * 10).toFixed(1)}T kCYCLES`,
        boost: `${(Math.random() * 48 + 2).toFixed(0)}h Extension`,
        minerType: `${['Basic', 'Normal', 'Premium'][Math.floor(Math.random() * 3)]} Miner`,
        time: `${Math.floor(Math.random() * 59 + 1)}m`,
        color: 'text-yellow-400',
        hash: `0x${Math.random().toString(16).slice(2, 10)}`
      }
    ];
    return activities[i % activities.length];
  });

  const handleActivityClick = (activity: Activity) => {
    selectedActivity = activity;
    showActivityModal = true;
  };

  // State management
  let currentTime = new Date();
  let icpBalance = "0.0000";
  let kongBalance = "0.0000";
  let isLoadingBalance = false;
  let showWalletModal = false;
  let showToast = false;
  let toastMessage = '';
  let toastTimeout: ReturnType<typeof setTimeout>;
  let balanceInterval: ReturnType<typeof setInterval>;
  let isMobileMenuOpen = false;

  // Reactive time formatting
  $: formattedTime = currentTime.toTimeString().slice(0, 8);

  // Optimized functions
  const toggleWalletModal = () => showWalletModal = !showWalletModal;
  const toggleMobileMenu = () => {
    isMobileMenuOpen = !isMobileMenuOpen;
  };

  const showNotification = (message: string) => {
    clearTimeout(toastTimeout);
    toastMessage = message;
    showToast = true;
    toastTimeout = setTimeout(() => showToast = false, TOAST_DURATION);
  };

  const fetchICPBalance = async () => {
    if (!$auth.isConnected || !$auth.account?.owner) return;
    
    try {
      isLoadingBalance = true;
      const ledger = await getLedgerActorForBalanceChecks();
      const balance = await ledger.icrc1_balance_of({
        owner: $auth.account.owner,
        subaccount: []
      });
      icpBalance = (Number(balance) / 100_000_000).toFixed(4);
    } catch (error) {
      console.error('Failed to fetch ICP balance:', error);
      icpBalance = "Error";
    } finally {
      isLoadingBalance = false;
    }
  };

  const fetchKongBalance = async () => {
    if (!$auth.isConnected || !$auth.account?.owner) return;
    
    try {
      isLoadingBalance = true;
      const kongActor = await getKongActor({ anonymous: true });
      const balance = await kongActor.icrc1_balance_of({
        owner: $auth.account.owner,
        subaccount: []
      });
      kongBalance = (Number(balance) / 100_000_000).toFixed(4);
    } catch (error) {
      console.error('Failed to fetch KONG balance:', error);
      kongBalance = "Error";
    } finally {
      isLoadingBalance = false;
    }
  };

  const updateBalances = async () => {
    if (!$auth.isConnected) return;
    if ($auth.account?.owner) {
      await getSubAccountBalance($auth.account.owner);
      await fetchKongBalance();
      await fetchICPBalance();
    }
  };

  // Lifecycle management
  onMount(() => {
    // Update time every second
    const timeInterval = setInterval(() => currentTime = new Date(), 1000);
    
    // Set up balance refresh interval for subaccount only
    balanceInterval = setInterval(updateBalances, REFRESH_INTERVAL);

    // Get current path
    currentPath = window.location.pathname;

    // Cleanup
    return () => {
      clearInterval(timeInterval);
      clearInterval(balanceInterval);
      clearTimeout(toastTimeout);
    };
  });

  // Watch auth state changes
  $: if ($auth.isConnected) updateBalances();

  // Updated ticker activities with proper typing
  const tickerActivities: TickerActivity[] = Array.from({ length: 15 }, (_, i) => {
    const priceChange = (Math.random() * 40 - 20).toFixed(2);
    const volume = (Math.random() * 1000000).toFixed(0);
    const time = `${Math.floor(Math.random() * 59 + 1)}m`;
    
    const tokens = [
      "PEPE", "WOJAK", "COPIUM", "NGMI", "APE",
      "CHAD", "SOYJAK", "WAGMI", "BONK", "DOGE",
      "SHIB", "TENDIES", "FOMO", "GUH", "RUGPULL"
    ];
    
    return {
      type: 'ticker',
      token: tokens[i % tokens.length],
      priceChange,
      volume,
      time,
      color: parseFloat(priceChange) >= 0 ? 'text-green-400' : 'text-red-400'
    };
  });

  // Helper function to check if a nav item is active
  const isActive = (href: string) => currentPath === href;

  // Update currentPath when the page store changes
  $: currentPath = $page.url.pathname;

  // Helper function to handle navigation
  const navigate = async (href: string) => {
    await goto(href);
  };
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<!-- Main Grid Layout -->
<div class="grid grid-rows-[72px_1fr_32px] h-[100dvh] overflow-hidden">
  <!-- Top Navigation Bar -->
  <header class="border-b bg-black/90 border-cyan-500/30 col-span-full">
    <div class="fixed top-0 left-0 right-0 z-50 flex items-center border-b h-[72px] bg-black/90 border-blue-500/30 backdrop-blur-md">
      <div class="relative flex items-center justify-between w-full max-w-full px-5 mx-auto">
        <!-- Mobile Menu Button -->
        <button 
          class="flex items-center px-3 py-2 border md:hidden border-blue-500/30 bg-blue-500/5"
          on:click={toggleMobileMenu}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Logo centered on mobile, left-aligned on desktop -->
        <div class="absolute transform -translate-x-1/2 left-1/2 md:static md:transform-none md:left-0">
          <div class="relative flex items-center">
            <span class="text-xl font-bold tracking-[0.2em] text-transparent bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-500 bg-clip-text whitespace-nowrap">
              KONGPAD
            </span>
          </div>
        </div>

        <!-- Right side buttons -->
        <div class="flex items-center gap-3">
          {#if $auth.isConnected && $auth.account}
            <!-- Desktop wallet info -->
            <div class="items-center hidden gap-3 md:flex">
              <button 
                class="px-4 py-2.5 text-sm border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                on:click={fetchICPBalance}
              >
                <div class="flex items-center gap-2">
                  <span class="text-blue-300/70">ICP:</span>
                  <span class="font-mono text-blue-300">{icpBalance}</span>
                </div>
              </button>
              <button 
                class="px-4 py-2.5 text-sm border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                on:click={fetchKongBalance}
              >
                <div class="flex items-center gap-2">
                  <span class="text-blue-300/70">KONG:</span>
                  <span class="font-mono text-blue-300">{kongBalance}</span>
                </div>
              </button>
              <button 
                class="px-4 py-2.5 text-sm border cursor-pointer border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                on:click={() => {
                  navigator.clipboard.writeText($auth.account?.owner?.toString() || '');
                  showNotification('ADDRESS COPIED!');
                }}
              >
                <span class="inline-block w-1.5 h-1.5 mr-2 bg-blue-400 animate-pulse"></span>
                <span class="font-mono text-blue-300">{$auth.account?.owner?.toString().slice(0,10)}...</span>
              </button>
            </div>
          {:else}
            <button 
              on:click={toggleWalletModal}
              class="px-4 py-2.5 text-sm border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors"
            >
              <span class="inline-block w-1.5 h-1.5 bg-red-400 animate-pulse"></span>
              <span class="text-red-400">CONNECT</span>
            </button>
          {/if}

          <div class="items-center hidden gap-2 text-sm md:flex">
            <span class="text-blue-300/70">[</span>
            <span class="font-mono text-blue-400">{formattedTime}</span>
            <span class="text-blue-300/70">]</span>
          </div>
        </div>
      </div>

      <!-- Sharp decorative elements -->
      <div class="absolute bottom-0 left-0 w-full">
        <div class="w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-blue-500/10 to-transparent"></div>
        <div class="w-full h-[1px] mt-[1px] bg-gradient-to-r from-blue-500/20 via-blue-500/5 to-transparent"></div>
      </div>

      <!-- Corner accents -->
      <div class="absolute top-0 left-0 w-16 h-[1px] bg-blue-500/30"></div>
      <div class="absolute top-0 right-0 w-16 h-[1px] bg-blue-500/30"></div>
      <div class="absolute top-0 left-0 w-[1px] h-16 bg-blue-500/30"></div>
      <div class="absolute top-0 right-0 w-[1px] h-16 bg-blue-500/30"></div>
    </div>
  </header>

  <!-- Main Content Area -->
  <div class="grid md:grid-cols-[192px_1fr] gap-0 h-full overflow-hidden">
    <!-- Sidebar - Hidden on Mobile -->
    <nav class="hidden w-48 overflow-hidden border-r md:block bg-black/90 border-cyan-500/30">
      <div class="relative h-full">
        <!-- Add thick border overlay -->
        <div class="absolute top-0 right-0 w-[3px] h-full bg-black/90"></div>
        <div class="absolute top-0 right-0 w-[2px] h-full bg-blue-500/20"></div>

        <!-- Updated Background Effects -->
        <div class="absolute inset-0">
          <!-- Improved border handling with gradient overlays -->
          <div class="absolute inset-0">
            <!-- Right border glow effect -->
            <div class="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-transparent via-blue-500/30 to-transparent"></div>
            <!-- Softer right border -->
            <div class="absolute top-0 right-[1px] w-[1px] h-full bg-gradient-to-b from-transparent via-blue-500/20 to-transparent"></div>
            <!-- Additional blur effect to smooth intersection -->
            <div class="absolute top-0 right-0 w-[3px] h-full backdrop-blur-[1px]"></div>
          </div>
        </div>

        <!-- Navigation Items -->
        <div class="relative py-4">
          {#each navItems as item}
            <a
              href={item.href}
              on:click|preventDefault={() => navigate(item.href)}
              class="relative flex items-center w-full h-12 px-4 mb-1 overflow-hidden group"
              class:active={$page.url.pathname === item.href}
            >
              <!-- Background layers -->
              <div class="absolute inset-0 transition-all duration-300 opacity-0 bg-gradient-to-r from-blue-500/10 to-transparent group-hover:opacity-100"></div>
              
              <!-- Left border accent -->
              <div class="absolute left-0 w-[2px] h-full transition-all duration-300 opacity-0 bg-gradient-to-b from-transparent via-blue-400 to-transparent group-hover:opacity-100"></div>
              
              <!-- Sharp corner accents -->
              <div class="absolute top-0 left-0 w-2 h-[1px] transition-all duration-300 opacity-0 bg-blue-400 group-hover:opacity-100"></div>
              <div class="absolute bottom-0 left-0 w-2 h-[1px] transition-all duration-300 opacity-0 bg-blue-400 group-hover:opacity-100"></div>
              
              <!-- Content -->
              <div class="relative flex items-center w-full">
                <span class="flex items-center justify-center w-8 text-lg transition-all duration-300 {$page.url.pathname === item.href ? 'text-blue-400' : 'text-blue-500/70'} group-hover:text-blue-400">
                  {item.icon}
                </span>
                <span class="ml-2 text-sm tracking-wider transition-all duration-300 {$page.url.pathname === item.href ? 'text-blue-300' : 'text-blue-400/70'} group-hover:text-blue-300">
                  {item.label}
                </span>
              </div>

              <!-- Active state indicators -->
              {#if $page.url.pathname === item.href}
                <div class="absolute left-0 w-[2px] h-full bg-blue-400"></div>
                <div class="absolute top-0 left-0 w-2 h-[1px] bg-blue-400"></div>
                <div class="absolute bottom-0 left-0 w-2 h-[1px] bg-blue-400"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent"></div>
              {/if}
            </a>
          {/each}
        </div>

        <!-- Bottom decorative elements -->
        <div class="absolute bottom-0 left-0 w-full">
          <div class="w-full h-[1px] bg-gradient-to-r from-blue-500/30 to-transparent"></div>
          <div class="w-full h-[1px] mt-[1px] bg-gradient-to-r from-blue-500/20 to-transparent"></div>
        </div>
      </div>
    </nav>

    <!-- Content Area -->
    <main class="flex flex-col w-full overflow-hidden">
      <!-- Progress Bar Section (if needed) -->
      {#if $page.url.pathname === '/token'}
        <div class="border-b bg-black/90 border-cyan-500/30">
          <slot name="progress" />
        </div>
      {/if}

      <!-- Main Content -->
      <div class="flex-1 overflow-hidden">
        <div class="relative h-full overflow-y-auto border-l border-r border-blue-500/30 bg-black/90 backdrop-blur-md">
          <div class="relative h-full">
            <!-- Sharp corner accents -->
            <div class="absolute top-0 left-0 w-16 h-[2px] bg-blue-500/50"></div>
            <div class="absolute top-0 right-0 w-16 h-[2px] bg-blue-500/50"></div>
            <div class="absolute top-0 left-0 w-[2px] h-16 bg-blue-500/50"></div>
            <div class="absolute top-0 right-0 w-[2px] h-16 bg-blue-500/50"></div>
            
            <!-- Diagonal corner accents -->
            <div class="absolute top-0 left-16 w-8 h-[2px] bg-blue-500/30 transform -skew-x-45"></div>
            <div class="absolute top-0 right-16 w-8 h-[2px] bg-blue-500/30 transform skew-x-45"></div>
            <div class="absolute top-16 left-0 w-[2px] h-8 bg-blue-500/30 transform -skew-y-45"></div>
            <div class="absolute top-16 right-0 w-[2px] h-8 bg-blue-500/30 transform skew-y-45"></div>
            
            <!-- Inner corner glows -->
            <div class="absolute top-0 left-0 w-4 h-4 bg-blue-500/5"></div>
            <div class="absolute top-0 right-0 w-4 h-4 bg-blue-500/5"></div>
            
            <!-- Content -->
            <div class="relative h-full overflow-y-auto">
              <slot />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Bottom Ticker/Analytics -->
  <div class="h-8 border-t bg-black/90 border-cyan-500/30">
    <!-- Enhanced Token Launch Ticker -->
    <div class="fixed bottom-0 left-0 right-0 h-8 border-t bg-black/90 border-blue-500/30 backdrop-blur-md z-[9999] overflow-hidden">
      <div class="flex items-center h-full px-4 space-x-12 animate-scroll">
        {#each tickerActivities as activity}
          <button 
            class="flex items-center space-x-4 text-sm whitespace-nowrap group"
            role="button"
            on:click={() => handleActivityClick(activity)}
            on:keydown={(e) => e.key === 'Enter' && handleActivityClick(activity)}
          >
            <div class="flex items-center space-x-2">
              <span class="transition-colors duration-300 text-blue-300/70">{activity.token}</span>
              <span class={activity.color}>
                {parseFloat(activity.priceChange) >= 0 ? '+' : ''}{activity.priceChange}%
              </span>
              <span class="w-1.5 h-1.5 bg-blue-500/50 group-hover:bg-blue-500 animate-pulse"></span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-blue-400/50 group-hover:text-blue-300/80">VOL:{activity.volume}</span>
            </div>
            <div class="flex items-center space-x-2 text-blue-400/50">
              <span class="text-blue-500/50">│</span>
              <span class="group-hover:text-blue-300/80">{activity.time}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Mobile Menu Overlay -->
  {#if isMobileMenuOpen}
    <div class="fixed inset-0 z-50 md:hidden">
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/90 backdrop-blur-md"
        role="button"
        tabindex="0"
        on:click={toggleMobileMenu}
        on:keydown={(e) => e.key === 'Enter' && toggleMobileMenu()}
      ></div>
      
      <!-- Fullscreen Menu Panel -->
      <div class="absolute inset-0 flex flex-col bg-black border border-blue-500/30">
        <!-- Main Content Area -->
        <div class="flex-1 overflow-auto">
          <div class="pt-16">
            <!-- Wallet Info Section -->
            {#if $auth.isConnected && $auth.account}
              <div class="px-4 py-3 border-b border-blue-500/30">
                <div class="space-y-2">
                  <button 
                    class="w-full px-3 py-2 text-sm border border-blue-500/30 bg-blue-500/5"
                    on:click={fetchKongBalance}
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-blue-300/70">KONG:</span>
                      <span class="font-mono text-blue-300">{kongBalance}</span>
                    </div>
                  </button>
                  <button 
                    class="w-full px-3 py-2 text-sm border border-blue-500/30 bg-blue-500/5"
                    on:click={fetchICPBalance}
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-blue-300/70">ICP:</span>
                      <span class="font-mono text-blue-300">{icpBalance}</span>
                    </div>
                  </button>
                  <button 
                    class="w-full px-3 py-2 text-sm border border-blue-500/30 bg-blue-500/5"
                    on:click={() => {
                      navigator.clipboard.writeText($auth.account?.owner?.toString() || '');
                      showNotification('ADDRESS COPIED!');
                      toggleMobileMenu();
                    }}
                  >
                    <span class="inline-block w-1.5 h-1.5 mr-2 bg-blue-400"></span>
                    <span class="font-mono text-blue-300">{$auth.account?.owner?.toString().slice(0,10)}...</span>
                  </button>
                </div>
              </div>
            {/if}

            <!-- Navigation Items -->
            <div class="px-4 py-3 space-y-4">
              {#each navItems as item}
                <a
                  href={item.href}
                  class="flex items-center justify-between w-full px-6 py-4 text-lg border border-blue-500/30 bg-blue-500/5"
                  class:active={$page.url.pathname === item.href}
                  on:click={toggleMobileMenu}
                >
                  <span class="text-xl text-blue-500">{item.icon}</span>
                  <span class="text-blue-400">{item.label}</span>
                  <div class="w-4"></div> <!-- Spacer for visual balance -->
                </a>
              {/each}
            </div>
          </div>
        </div>

        <!-- Fixed Bottom Section -->
        <div class="px-4 py-3 space-y-3 border-t border-blue-500/30">
          {#if $auth.isConnected}
            <button 
              class="w-full px-6 py-4 text-lg border border-red-500/30 bg-red-500/5"
              on:click={() => {
                showWalletModal = false;
                toggleMobileMenu();
              }}
            >
              <span class="text-red-400">DISCONNECT</span>
            </button>
          {/if}
          <button 
            class="w-full px-6 py-4 text-lg border border-blue-500/30 bg-blue-500/5"
            on:click={toggleMobileMenu}
          >
            <span class="text-blue-400">CLOSE</span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Wallet Modal -->
  {#if showWalletModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <Login 
        on:close={toggleWalletModal} 
        on:login={() => {
          showWalletModal = false;
          showNotification('WALLET CONNECTED!');
        }} 
      />
    </div>
  {/if}

  <!-- Updated Toast Notification with sharp corners -->
  {#if showToast}
    <div 
      class="fixed top-4 right-4 px-4 py-2 text-sm border rounded-none bg-blue-500/10 border-blue-500/30 text-blue-300 backdrop-blur-md transition-opacity duration-300 z-[9999]"
      style="opacity: {showToast ? '1' : '0'}"
    >
      {toastMessage}
    </div>
  {/if}

  <!-- Add the Activity Modal -->
  {#if showActivityModal && selectedActivity}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div class="w-full max-w-md p-4 border bg-black/90 border-blue-500/30">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 bg-blue-400 animate-pulse"></span>
            {#if isSystemActivity(selectedActivity)}
              <span class="text-lg {selectedActivity.color}">{selectedActivity.action}</span>
            {:else}
              <span class="text-lg {selectedActivity.color}">Price Change: {selectedActivity.priceChange}%</span>
            {/if}
          </div>
          <button 
            class="px-2 py-1 text-sm border border-blue-500/30 bg-blue-500/5"
            on:click={() => showActivityModal = false}
          >
            CLOSE
          </button>
        </div>

        <!-- Content -->
        <div class="space-y-3">
          {#if isSystemActivity(selectedActivity)}
            <div class="p-3 border border-blue-500/30 bg-blue-500/5">
              <div class="flex items-center justify-between">
                <span class="text-blue-300/70">USER</span>
                <span class="font-mono text-blue-300">{selectedActivity.principal}</span>
              </div>
            </div>

            <div class="p-3 border border-blue-500/30 bg-blue-500/5">
              <div class="flex items-center justify-between">
                <span class="text-blue-300/70">TX HASH</span>
                <span class="font-mono text-blue-300">{selectedActivity.hash}</span>
              </div>
            </div>

            {#if selectedActivity.type === 'miner' && selectedActivity.power}
              <div class="p-3 border border-blue-500/30 bg-blue-500/5">
                <div class="flex items-center justify-between">
                  <span class="text-blue-300/70">HASH POWER</span>
                  <span class="font-mono text-blue-300">{selectedActivity.power}</span>
                </div>
              </div>
            {/if}

            {#if selectedActivity.boost}
              <div class="p-3 border border-blue-500/30 bg-blue-500/5">
                <div class="flex items-center justify-between">
                  <span class="text-blue-300/70">POWER BOOST</span>
                  <span class="font-mono text-blue-300">{selectedActivity.boost}</span>
                </div>
              </div>
            {/if}

            {#if selectedActivity.minerType}
              <div class="p-3 border border-blue-500/30 bg-blue-500/5">
                <div class="flex items-center justify-between">
                  <span class="text-blue-300/70">MINER TYPE</span>
                  <span class="font-mono text-blue-300">{selectedActivity.minerType}</span>
                </div>
              </div>
            {/if}
          {:else}
            <div class="p-3 border border-blue-500/30 bg-blue-500/5">
              <div class="flex items-center justify-between">
                <span class="text-blue-300/70">VOLUME</span>
                <span class="font-mono text-blue-300">{selectedActivity.volume}</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
