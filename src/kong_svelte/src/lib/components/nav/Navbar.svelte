<script lang="ts">
  import Button from '../common/Button.svelte';
  import Sidebar from './Sidebar.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  let activeTab: 'swap' | 'pool' | 'stats' = 'swap';
  let sidebarOpen = false;
  let isMobile = false;
  let isSpinning = false;

  const titles = {
    swap: {
      desktop: '/titles/titleKingKongSwap.png',
      mobile: '/titles/titleKingKongSwap.png'
    },
    pool: {
      desktop: '/titles/titleKingKongStats.png',
      mobile: '/titles/titleKingKongStats.png'
    },
    stats: {
      desktop: '/titles/stats_title.webp',
      mobile: '/titles/stats_title.webp'
    }
  };

  function handleTabChange(tab: 'swap' | 'pool' | 'stats') {
    activeTab = tab;
    goto(`/${tab}`);
  }

  function handleConnect() {
    sidebarOpen = !sidebarOpen;
  }

  function handleResize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
    }
  }

  onMount(() => {
    const path = $page.url.pathname;
    activeTab = path === '/stats' ? 'stats' : path === '/pool' ? 'pool' : 'swap';
    handleResize();
    
    if (browser) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  });

  $: {
    const path = $page.url.pathname;
    activeTab = path === '/stats' ? 'stats' : path === '/pool' ? 'pool' : 'swap';
  }

  $: titleImage = isMobile 
    ? titles[activeTab].mobile 
    : titles[activeTab].desktop;
</script>

<nav class="absolute top-0 max-w-6xl w-full z-50 md:px-10">
  <div class="grid grid-cols-12">
    <div class="left-nav col-span-3 items-center">
      <Button 
        text="SWAP"
        variant="blue"
        state={activeTab === 'swap' ? 'selected' : 'default'}
        onClick={() => handleTabChange('swap')}
      />
      <Button 
        text="POOL"
        variant="blue"
        state={activeTab === 'pool' ? 'selected' : 'default'}
        onClick={() => handleTabChange('pool')}
      />
      <Button 
        text="STATS"
        variant="blue"
        state={activeTab === 'stats' ? 'selected' : 'default'}
        onClick={() => handleTabChange('stats')}
      />
    </div>

    <div class="col-span-6 flex justify-center items-end">
        <img src={titleImage} alt={activeTab} class=" w-3/4" />
    </div>

    <div class="col-span-3 flex justify-end items-center">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button 
        class="settings-button" 
        class:spinning={isSpinning}
        on:mouseenter={() => isSpinning = true}
        on:mouseleave={() => isSpinning = false}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
        </svg>
      </button>
      <Button
        text="CONNECT"
        variant="yellow"
        state={sidebarOpen ? 'selected' : 'default'}
        onClick={handleConnect}
      />
    </div>
  </div>
</nav>

<Sidebar 
  {sidebarOpen}
  onClose={() => sidebarOpen = false}
/>

<style>
  nav {
    width: 100%;
    padding: 12px 0;
  }

  .nav-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    position: relative;
    padding: 0 16px;
  }

  .left-nav, .right-nav {
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 2;
  }

  .title-section {
    z-index: 1;
    pointer-events: none;
  }

  .title-image {
    width: 100%;
    max-width: 690px;
    height: 100%;
    object-fit: contain;
    margin-top: 128px;
  }

  .settings-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
  }

  .settings-button.spinning {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .mobile-nav {
    height: auto;
    background: none;
    border: none;
    padding: 0 16px 24px;
    display: flex;
    justify-content: center;
  }

  .mobile-nav-content {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
    height: 100%;
    padding: 0 8px;
  }

  :global(.mobile-panel) {
    backdrop-filter: blur(8px);
  }

  @media (max-width: 768px) {
    nav {
      padding: 8px 0;
    }

    .nav-content {
      flex-wrap: wrap;
      padding: 0 8px;
    }

    .left-nav, .right-nav {
      gap: 8px;
    }

    .title-wrapper {
      height: 100px;
      margin-top: 8px;
    }

    .title-image {
      max-width: 100%;
    }
  }
</style>
