<script lang="ts">
  import { tokenInfo } from '../stores/token-info';
  import Login from './Login.svelte';

  export let isConnected: boolean = false;
  export let onDisconnect: () => void;
  export let currentPage: string = 'info';
  export let onLoginSuccess: () => void;
  export let pnp: any;

  let showMenu = false;
  
  $: pages = [
    { id: 'info', name: 'Info', icon: 'fa-info-circle' },
    { id: 'leaderboard', name: 'Leaderboard', icon: 'fa-trophy' },
    { id: 'buy', name: `Buy ${$tokenInfo.ticker}`, icon: 'fa-shopping-cart' },
    { id: 'wallet', name: 'My Wallet', icon: 'fa-wallet' }
  ];

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function handleClickOutside(event: MouseEvent) {
    const nav = document.querySelector('.navigation');
    const menuBtn = document.querySelector('.menu-toggle');
    const logo = document.querySelector('.logo');
    if (showMenu && nav && menuBtn && logo && 
        !nav.contains(event.target as Node) && 
        !menuBtn.contains(event.target as Node) &&
        !logo.contains(event.target as Node)) {
      showMenu = false;
    }
  }

  $: navItems = pages.map(page => ({
    ...page,
    isDisabled: (page.id === 'wallet' || page.id === 'buy') && !isConnected
  }));
</script>

<svelte:window on:click={handleClickOutside}/>

<!-- Mobile Navigation -->
<header class="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-white/10 md:hidden">
  <div class="px-4 mx-auto max-w-7xl">
    <div class="flex items-center justify-between py-2">
      <div class="w-10">
        <button class="text-white text-2xl p-2 z-[101]" on:click={toggleMenu}>
          <i class="fas {showMenu ? 'fa-times' : 'fa-bars'}"></i>
        </button>
      </div>

      <div class="text-xl font-bold text-green-500">
        <h1>{$tokenInfo.name}</h1>
      </div>

      <div>
        {#if isConnected}
          <button class="bg-red-500/10 text-red-500 border border-red-500/20 p-2 rounded-lg z-[101]" on:click={onDisconnect}>
            <i class="fas fa-sign-out-alt"></i>
          </button>
        {/if}
      </div>
    </div>

    <nav class="{showMenu ? 'flex' : 'hidden'} flex-col fixed top-16 left-0 right-0 bottom-0 bg-gray-900 p-4 overflow-y-auto shadow-lg z-[100]">
      {#if !isConnected}
        <div class="p-2 mb-4">
          <Login {onLoginSuccess} {pnp} />
        </div>
      {/if}
      {#each navItems as page}
        <a 
          href="#{page.id}" 
          draggable="false"
          class="flex items-center gap-2 p-4 rounded-xl text-lg text-gray-400 hover:text-green-500 hover:bg-white/5 {currentPage === page.id ? 'text-green-500 bg-white/5' : ''} {page.isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}"
          on:click|preventDefault={(e) => {
            if (page.isDisabled) return;
            window.location.hash = page.id;
            showMenu = false;
          }}
        >
          <i class="fas {page.icon}" draggable="false"></i>
          {page.name}
          {#if page.isDisabled}
            <span class="text-sm opacity-70" draggable="false">🔒</span>
          {/if}
        </a>
      {/each}
    </nav>
  </div>
</header>

<!-- Desktop Navigation -->
<header class="fixed top-0 left-0 right-0 z-50 hidden bg-gray-900 border-b border-white/10 md:block">
  <div class="px-4 py-3 mx-auto max-w-7xl">
    <nav class="flex items-center gap-8">
      <div class="flex-none">
        <h1 class="text-2xl font-bold text-green-500">{$tokenInfo.name}</h1>
      </div>
      
      <div class="flex justify-center flex-1 gap-4">
        {#each navItems as page}
          <a 
            href="#{page.id}" 
            draggable="false"
            class="flex items-center gap-2 px-4 py-3 rounded-lg text-gray-400 hover:text-green-500 hover:bg-white/5 {currentPage === page.id ? 'text-green-500 bg-white/5' : ''} {page.isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}"
            on:click|preventDefault={(e) => {
              if (page.isDisabled) return;
              window.location.hash = page.id;
            }}
          >
            <i class="fas {page.icon}" draggable="false"></i>
            <span class="whitespace-nowrap">{page.name}</span>
            {#if page.isDisabled}
              <span class="text-sm opacity-70" draggable="false">🔒</span>
            {/if}
          </a>
        {/each}
      </div>

      <div class="flex-none">
        {#if isConnected}
          <button class="flex items-center gap-2 px-4 py-2 text-red-500 border rounded-lg bg-red-500/10 border-red-500/20 hover:bg-red-500/20" on:click={onDisconnect}>
            <i class="fas fa-sign-out-alt"></i>
            <span class="hidden md:inline">Disconnect</span>
          </button>
        {:else}
          <Login {onLoginSuccess} {pnp} />
        {/if}
      </div>
    </nav>
  </div>
</header>
