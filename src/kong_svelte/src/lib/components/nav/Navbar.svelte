<script lang="ts">
  import Button from './Button.svelte';
  import Sidebar from './Sidebar.svelte';
  import { onMount } from 'svelte';
  
  let activeTab: 'swap' | 'stats' = 'swap';
  let sidebarOpen = false;
  let isMobile = false;
  let combinedButtonText = 'SWAP';

  const walletProviders = [
    {
      name: 'Internet Identity',
      icon: `<div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FF6B6B, #4ECDC4); border-radius: 12px;"></div>`,
      description: 'Connect with Internet Identity',
      isPopular: true
    },
    {
      name: 'Plug',
      icon: `<div style="width: 64px; height: 64px; background: linear-gradient(135deg, #A8E6CF, #3D84A8); border-radius: 12px;"></div>`,
      description: 'Connect with Plug wallet',
      isPopular: true
    }
  ];

  function handleTabChange(tab: 'swap' | 'stats') {
    activeTab = tab;
  }

  function handleConnect() {
    sidebarOpen = !sidebarOpen;
  }

  function handleWalletSelect(provider: string) {
    console.log(`Selected wallet: ${provider}`);
    // Implement wallet connection logic here
    sidebarOpen = false;
  }

  function handleCombinedButton() {
    activeTab = activeTab === 'swap' ? 'stats' : 'swap';
    combinedButtonText = activeTab.toUpperCase();
  }

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });
</script>

<nav class="fixed top-0 left-0 right-0 z-50">
  <div class="retro-container">
    <div class="buttons">
      <div class="left-buttons">
        {#if isMobile}
          <Button 
            text={combinedButtonText}
            active={true}
            onClick={handleCombinedButton}
            variant="primary"
            size="medium"
          />
        {:else}
          <Button 
            text="SWAP" 
            active={activeTab === 'swap'} 
            onClick={() => handleTabChange('swap')}
            variant="primary"
            size="medium"
          />
          <Button 
            text="STATS" 
            active={activeTab === 'stats'} 
            onClick={() => handleTabChange('stats')}
            variant="primary"
            size="medium"
          />
        {/if}
      </div>
      <div class="right-buttons">
        <Button
          text="CONNECT"
          active={sidebarOpen}
          onClick={handleConnect}
          variant="secondary"
          size="medium"
        />
      </div>
    </div>
  </div>
</nav>

<Sidebar 
  {walletProviders} 
  {sidebarOpen} 
  onClose={() => sidebarOpen = false} 
  onWalletSelect={handleWalletSelect} 
/>

<style>
  nav {
    width: 100%;
    padding: 16px;
  }

  .retro-container {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
  }

  .buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .left-buttons {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .right-buttons {
    display: flex;
    align-items: center;
  }

  @media (max-width: 768px) {
    nav {
      padding: 12px;
    }

    .buttons {
      gap: 8px;
    }

    .left-buttons {
      gap: 8px;
    }
  }
</style>
