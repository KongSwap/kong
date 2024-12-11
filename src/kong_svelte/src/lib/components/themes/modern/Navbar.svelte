<script lang="ts">
  import Button from "$lib/components/common/Button.svelte";
  import { t } from "$lib/services/translations";
  import { auth } from "$lib/services/auth";
  import { fade, slide } from "svelte/transition";
    import { goto } from "$app/navigation";

  export let activeTab: "swap" | "earn" | "stats";
  export let sidebarOpen: boolean;
  export let isMobile: boolean;
  export let onTabChange: (tab: "swap" | "earn" | "stats") => void;
  export let onConnect: () => void;
  export let onOpenSettings: () => void;

  let isSpinning = false;
  let navOpen = false;
  const tabs = ["swap", "earn", "stats"] as const;

  function handleNavClose() {
    navOpen = false;
  }

  function handleSettingsClick() {
    onOpenSettings();
    if (isMobile) {
      handleNavClose();
    }
  }
</script>

<div class="nav-container-wrapper">
  <div class="nav-container">
    {#if isMobile}
      <div class="left-section">
        <button
          class="mobile-icon-btn"
          on:click={() => (navOpen = !navOpen)}
          aria-label="Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="6" x2="20" y2="6"></line>
            <line x1="4" y1="18" x2="20" y2="18"></line>
          </svg>
        </button>
      </div>
    {:else}
      <div class="left-section">
        <nav class="nav-tabs">
          {#each tabs as tab}
            <button
              aria-label={tab.toUpperCase()}
              data-sveltekit-preload-data
              class="nav-link {activeTab === tab ? 'active' : ''}"
              on:click={() => { 
                onTabChange(tab)
                goto(`/${tab}`);
              }}
            >
              {tab.toUpperCase()}
            </button>
          {/each}
        </nav>
      </div>
    {/if}

    <div class="center-section">
      <button class="logo-link" on:click={() => goto("/")}>
        <img
          src="/titles/logo-white-wide.png"
          alt="Kong Logo"
          class="logo-wide shiny-logo"
        />
      </button>
    </div>

    {#if isMobile}
      <div class="right-section">
        <button
          class="mobile-icon-btn"
          on:click={onConnect}
          aria-label="Wallet"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M20 12v4H6a2 2 0 0 0-2 2c0 1.1.9 2 2 2h12v-4" />
            <path d="M20 8v8" />
          </svg>
        </button>
      </div>
    {:else}
      <div class="right-section">
        <button
          class="nav-link settings-btn"
          class:spinning={isSpinning}
          on:click={handleSettingsClick}
          aria-label="Settings"
        >
          <div class="btn-content uppercase">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
              />
            </svg>
            <span class="settings-text">Settings</span>
          </div>
        </button>

        <button
          aria-label="Wallet"
          class="nav-link wallet-btn"
          class:selected={sidebarOpen}
          on:click|preventDefault={onConnect}
        >
          <div class="btn-content">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
              <path d="M20 12v4H6a2 2 0 0 0-2 2c0 1.1.9 2 2 2h12v-4" />
              <path d="M20 8v8" />
            </svg>
            <span class="wallet-text uppercase">
              {$auth.isConnected
                ? $t("common.openDrawer")
                : $t("common.connect")}
            </span>
          </div>
        </button>
      </div>
    {/if}
  </div>
</div>

{#if navOpen && isMobile}
  <div class="mobile-menu" transition:fade={{ duration: 200 }}>
    <div class="mobile-menu-overlay" on:click={handleNavClose} />
    <div
      class="mobile-menu-content"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div class="mobile-menu-header">
        <h2 class="mobile-menu-title pr-2 max-w-[200px]">
          <img
            src="/titles/logo-white-wide.png"
            alt="Kong Logo"
            class="logo-wide shiny-logo"
          />
        </h2>
        <button
          class="mobile-close-btn"
          on:click={handleNavClose}
          aria-label="Close menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <nav class="mobile-nav">
        {#each tabs as tab}
          <button
            aria-label={tab}
            class="mobile-nav-btn {activeTab === tab ? 'active' : ''}"
            on:click={() => {
              onTabChange(tab);
              goto(`/${tab}`);
              handleNavClose();
            }}
          >
            {tab.toUpperCase()}
          </button>
        {/each}

        <button
          class="mobile-nav-btn"
          on:click={() => {
            onOpenSettings();
            handleNavClose();
          }}
        >
          SETTINGS
        </button>
      </nav>

      <div class="mobile-menu-footer">
        <Button
          text={$auth.isConnected ? $t("common.openDrawer") : $t("common.connect")}
          variant="yellow"
          size="medium"
          state={sidebarOpen ? "selected" : "default"}
          onClick={() => {
            onConnect();
            handleNavClose();
          }}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  @font-face {
    font-family: "Space Grotesk";
    src: url("/fonts/Alumni-Sans-Latin.woff2") format("woff2");
    font-weight: normal;
    font-style: normal;
  }

  .nav-container-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 20px 0;
  }

  @media (max-width: 818px) {
    .nav-container-wrapper {
      padding: 15px 0;
    }
  }

  .nav-container {
    width: 100%;
    max-width: 1200px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.5rem;
    position: relative;
  }

  .nav-container {
    padding: 0 1rem;
  }

  /* Section Layout */
  .left-section,
  .right-section {
    flex: 0 0 auto;
    width: 80px;
    display: flex;
    align-items: center;
  }
  .left-section {
    justify-content: flex-start;
  }
  .center-section {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 1rem;
  }
  .right-section {
    justify-content: flex-end;
    gap: 0.5rem;
  }

  /* Navigation */
  .nav-tabs {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .nav-link {
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    border-radius: 0.75rem;
    letter-spacing: 0.05em;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.15);
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-link:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
  }

  .nav-link.active,
  .nav-link.selected {
    color: white;
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
  }

  /* Button Content Layout */
  .btn-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  /* Settings Button */
  .settings-btn {
    padding: 0.75rem 1.25rem;
    min-width: 120px;
    width: auto;
    background: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .settings-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
  }

  .settings-text {
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* Wallet Button */
  .wallet-btn {
    min-width: 120px;
    background: rgba(88, 101, 242, 0.2);
    border-color: rgba(88, 101, 242, 0.3);
  }

  .wallet-btn:hover {
    background: rgba(88, 101, 242, 0.3);
    border-color: rgba(88, 101, 242, 0.4);
    box-shadow: 0 0 12px rgba(88, 101, 242, 0.2);
  }

  .wallet-btn.selected {
    background: rgba(88, 101, 242, 0.4);
    border-color: rgba(88, 101, 242, 0.5);
    box-shadow: 0 0 16px rgba(88, 101, 242, 0.25);
  }

  .wallet-text {
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* Right Section Layout */
  .right-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Mobile Adjustments */
  @media (max-width: 818px) {
    .nav-link {
      height: 36px;
    }

    .settings-btn {
      padding: 0.5rem;
      min-width: 36px;
      width: 36px;
    }

    .settings-text {
      display: none;
    }

    .wallet-btn {
      min-width: 100px;
    }

    .left-section,
    .right-section {
      width: 60px;
    }

    .center-section {
      padding: 0 0.5rem;
    }

    .logo-link {
      max-width: 280px;
    }

    .logo-wide {
      height: 2rem;
      max-width: 100%;
      object-fit: contain;
      -webkit-backface-visibility: hidden;
      -webkit-transform: translateZ(0);
    }
  }

  /* Logo */
  .logo-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    position: relative;
    z-index: 2;
    margin: 0 auto;
  }

  .logo-wide {
    height: 3rem;
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
    transition: all 0.3s ease;
    position: relative;
  }

  .logo-wide:hover {
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4))
      drop-shadow(0 0 12px rgba(88, 101, 242, 0.3));
    transform: scale(1.01);
  }

  @keyframes shine {
    0% {
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
    }
    50% {
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4))
        drop-shadow(0 0 12px rgba(88, 101, 242, 0.3));
    }
    100% {
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
    }
  }

  .shiny-logo {
    animation: shine 4s infinite;
  }

  /* Mobile Icons */
  .mobile-icon-btn {
    padding: 0.75rem;
    color: white;
    border-radius: 0.75rem;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .mobile-icon-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .mobile-icon-btn:active {
    transform: translateY(0);
  }

  /* Mobile Menu */
  .mobile-menu {
    position: fixed;
    inset: 0;
    z-index: 100;
  }

  .mobile-menu-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
  }

  .mobile-menu-content {
    position: absolute;
    top: 0;
    left: 0;
    width: 80%;
    max-width: 320px;
    height: 100%;
    background: rgba(15, 23, 42, 0.98);
    backdrop-filter: blur(24px);
    border-right: 1px solid rgba(51, 65, 85, 0.4);
    display: flex;
    flex-direction: column;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
  }

  /* Mobile Menu Styles */
  .mobile-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
  }

  .mobile-menu-title {
    font-size: 1.75rem;
    color: white;
    margin: 0;
    background: linear-gradient(135deg, #94a3b8 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .mobile-close-btn {
    padding: 0.5rem;
    color: rgba(226, 232, 240, 0.8);
    border-radius: 0.5rem;
    transition: all 0.2s;
    background: rgba(51, 65, 85, 0.4);
    border: 1px solid rgba(71, 85, 105, 0.4);
  }

  .mobile-close-btn:hover {
    color: white;
    background: rgba(71, 85, 105, 0.6);
    box-shadow: 0 0 12px rgba(51, 65, 85, 0.3);
  }

  .mobile-nav {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .mobile-nav-btn {
    width: 100%;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: rgba(226, 232, 240, 0.8);
    font-size: 1.125rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    border-radius: 0.75rem;
    background: rgba(51, 65, 85, 0.3);
    border: 1px solid rgba(71, 85, 105, 0.4);
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.4);
    transform: scale(0);
    animation: ripple 0.6s linear;
    pointer-events: none;
    width: 200px;
    height: 200px;
    margin-left: -100px;
    margin-top: -100px;
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 0.8;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }

  .mobile-nav-btn:active {
    transform: scale(0.98);
  }

  .mobile-nav-btn.active {
    color: white;
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow: 0 0 16px rgba(59, 130, 246, 0.15);
  }

  .mobile-nav-btn:hover {
    color: white;
    background: rgba(71, 85, 105, 0.4);
    box-shadow: 0 0 12px rgba(51, 65, 85, 0.2);
  }

  .mobile-nav-arrow {
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .mobile-nav-btn:hover .mobile-nav-arrow {
    opacity: 1;
  }

  .mobile-menu-footer {
    padding: 1.5rem;
    border-top: 1px solid rgba(51, 65, 85, 0.4);
    background: rgba(15, 23, 42, 0.4);
  }

  :global(.nav-panel) {
    padding: 0 !important;
  }

  @media (max-width: 1024px) {
    .logo-wide {
        height: 2.25rem;
        max-width: 100%;
        object-fit: contain;
        -webkit-backface-visibility: hidden;
        -webkit-transform: translateZ(0);
    }
  }

  @media (max-width: 818px) {
    .logo-link {
        max-width: 100%;
        padding: 0 0.5rem;
    }
    
    .logo-wide {
        height: min(2.5rem, 8vw);  /* Dynamic size: either 2.5rem or 8% of viewport width, whichever is smaller */
        width: auto;
        max-width: min(280px, 70vw);  /* Dynamic width: either 280px or 70% of viewport width, whichever is smaller */
        object-fit: contain;
        -webkit-backface-visibility: hidden;
        -webkit-transform: translateZ(0);
    }
  }
</style>
