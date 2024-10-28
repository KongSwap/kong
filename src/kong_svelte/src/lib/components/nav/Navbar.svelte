<script lang="ts">
  import Button from '../common/Button.svelte';
  import Sidebar from './Sidebar.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  let activeTab: 'swap' | 'stats' = 'swap';
  let sidebarOpen = false;
  let isMobile = false;

  const titles = {
    swap: {
      desktop: '/titles/titleKingKongSwap.png',
      mobile: '/titles/titleKingKongSwap.png'
    },
    stats: {
      desktop: '/titles/titleKingKongStats.png',
      mobile: '/titles/titleKingKongStats.png'
    }
  };

  function handleTabChange(tab: 'swap' | 'stats') {
    activeTab = tab;
    goto(tab === 'swap' ? '/' : '/stats');
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
    activeTab = $page.url.pathname === '/stats' ? 'stats' : 'swap';
    handleResize();
    
    if (browser) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  });

  $: {
    activeTab = $page.url.pathname === '/stats' ? 'stats' : 'swap';
  }

  $: titleImage = isMobile 
    ? titles[activeTab].mobile 
    : titles[activeTab].desktop;
</script>

<nav class="fixed top-0 left-0 right-0 z-50">
  <div class="retro-container">
    <div class="buttons" class:is-mobile={isMobile}>
      <div class="left-buttons" class:mobile-buttons={isMobile}>
        <Button 
          text="SWAP"
          variant="blue"
          state={activeTab === 'swap' ? 'selected' : 'default'}
          onClick={() => handleTabChange('swap')}
        />
        <Button 
          text="STATS"
          variant="blue" 
          state={activeTab === 'stats' ? 'selected' : 'default'}
          onClick={() => handleTabChange('stats')}
        />
      </div>

      {#if !isMobile}
        <div class="title-container">
          <div class="title-wrapper">
            <img src={titleImage} alt={activeTab === 'swap' ? 'Swap' : 'Stats'} class="title-image" />
          </div>
        </div>
      {/if}

      <div class="right-buttons">
        <Button
          text="CONNECT"
          variant="yellow"
          state={sidebarOpen ? 'selected' : 'default'}
          onClick={handleConnect}
        />
      </div>
    </div>

    {#if isMobile}
      <div class="mobile-title-container">
        <div class="title-wrapper">
          <img src={titleImage} alt={activeTab === 'swap' ? 'Swap' : 'Stats'} class="title-image" />
        </div>
      </div>
    {/if}
  </div>
</nav>

<Sidebar 
  {sidebarOpen}
  onClose={() => sidebarOpen = false}
/>

<style>
  nav {
    width: 100%;
    padding: 12px 40px;
  }

  .retro-container {
    max-width: 1400px;
    margin: 0 auto;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .buttons {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    gap: 16px;
  }

  .buttons.is-mobile {
    padding: 0 8px;
  }

  .left-buttons {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-shrink: 0;
    margin-top: 8px;
  }

  .mobile-buttons {
    gap: 8px;
  }

  .right-buttons {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
    margin-top: 8px;
  }

  .title-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    max-width: 600px;
    z-index: -1;
  }

  .title-wrapper {
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .title-image {
    width: 100%;
    max-width: 500px;
    height: 100%;
    object-fit: contain;
  }

  .mobile-title-container {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 16px;
  }

  @media (max-width: 768px) {
    nav {
      padding: 8px 8px 16px;
    }

    .buttons {
      justify-content: space-between;
    }

    .left-buttons {
      margin-left: 4px;
    }

    .right-buttons {
      margin-right: 4px;
    }

    .title-wrapper {
      height: 100px;
      margin-top: 8px;
    }

    .mobile-title-container {
      padding: 0;
    }

    .title-image {
      max-width: 100%;
    }
  }
</style>
