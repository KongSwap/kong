<script lang="ts">
  import Button from "$lib/components/common/Button.svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { fade } from "svelte/transition";

  export let activeTab: "swap" | "earn" | "stats";
  export let sidebarOpen: boolean;
  export let isMobile: boolean;
  export let onTabChange: (tab: "swap" | "earn" | "stats") => void;
  export let onConnect: () => void;
  export let onOpenSettings: () => void;

  let isSpinning = false;
  let navOpen = false;
  const tabs = ["swap", "earn"] as const;
  const titles = {
    swap: {
      desktop: "/titles/swap_title.webp",
      mobile: "/titles/swap_title.webp",
    },
    earn: {
      desktop: "/titles/swap_title.webp",
      mobile: "/titles/swap_title.webp",
    },
    stats: {
      desktop: "/titles/stats_title.webp",
      mobile: "/titles/stats_title.webp",
    },
  };

  $: titleImage = isMobile
    ? titles[activeTab].mobile
    : titles[activeTab].desktop;

  function handleNavClose() {
    navOpen = false;
  }
</script>

<nav class="navbar">
  <div class="navbar-grid">
    <div class="nav-section left">
      {#if isMobile}
        <button
          class="menu-button"
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
            class="menu-icon"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      {/if}
      {#if !isMobile}
        <div class="nav-buttons">
          {#each tabs as tab}
            <Button
              text={tab.toUpperCase()}
              variant="blue"
              size="medium"
              state={activeTab === tab ? "selected" : "default"}
              onClick={() => onTabChange(tab)}
            />
          {/each}
        </div>
      {/if}
    </div>

    <div class="nav-section center">
      <button 
        class="title-button"
        on:click={() => {
          onTabChange('swap');
          goto('/swap');
        }}
      >
        <img
          src={titleImage}
          alt={activeTab}
          class="title-image glow-effect"
        />
      </button>
    </div>

    <div class="nav-section right">
      {#if !isMobile}
        <button
          class="settings-button"
          class:spinning={isSpinning}
          aria-label="Settings"
          on:mouseenter={() => (isSpinning = true)}
          on:mouseleave={() => (isSpinning = false)}
          on:click={onOpenSettings}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="settings-icon"
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
            />
          </svg>
        </button>

        <div class="nav-buttons">
          <Button
            text="STATS"
            variant="blue"
            size="medium"
            state={activeTab === "stats" ? "selected" : "default"}
            onClick={() => onTabChange("stats")}
          />

          <Button
            text={$auth.isConnected
              ? "Wallet"
              : "Connect"}
            variant="yellow"
            size="medium"
            state={sidebarOpen ? "selected" : "default"}
            onClick={onConnect}
          />
        </div>
      {/if}
    </div>
  </div>
</nav>

{#if navOpen && isMobile}
  <div
    class="mobile-menu"
    transition:fade={{ duration: 150 }}
  >
    <button
      class="close-button"
      on:click={handleNavClose}
    >
      ✕
    </button>

    <h2 class="menu-title">
      Navigation
    </h2>
    {#each [...tabs, "stats"] as tab}
      <Button
        text={tab.toUpperCase()}
        variant="blue"
        state={activeTab === tab ? "selected" : "default"}
        onClick={() => {
          onTabChange(tab as "swap" | "earn" | "stats");
          handleNavClose();
        }}
      />
    {/each}
    <Button
      text={$auth.isConnected
        ? "Wallet"
        : "Connect"}
      variant="yellow"
      state={sidebarOpen ? "selected" : "default"}
      onClick={() => {
        onConnect();
        handleNavClose();
      }}
    />

    <button
      class="settings-button-mobile"
      class:spinning={isSpinning}
      aria-label="Settings"
      on:mouseenter={() => (isSpinning = true)}
      on:mouseleave={() => (isSpinning = false)}
      on:click={() => {
        onOpenSettings();
        handleNavClose();
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="settings-icon"
      >
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
          />
        </svg>
      </button>
    </div>
{/if}

<style lang="postcss">
  .navbar {
    width: 100%;
    z-index: 50;
    padding: 1rem 0.25rem;
    max-width: 72rem;
    margin: 0 auto;
    transition: all 0.3s ease-in-out;
  }

  .navbar-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1rem;
  }

  .nav-section {
    display: flex;
    align-items: center;
  }

  .left {
    grid-column: span 2;
  }

  .center {
    grid-column: span 8;
    justify-content: center;
  }

  .right {
    grid-column: span 2;
    justify-content: flex-end;
  }

  @media (min-width: 768px) {
    .left {
      grid-column: span 3;
    }
    .center {
      grid-column: span 6;
    }
    .right {
      grid-column: span 3;
    }
  }

  .nav-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .menu-button {
    height: 38px;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease-in-out;
    background-color: rgba(31, 41, 55, 0.2);
    border-radius: 0.5rem;
    margin-left: 0.69rem;
  }

  .menu-icon {
    color: white;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
  }

  .menu-button:hover {
    transform: scale(1.05);
    background-color: rgba(31, 41, 55, 0.3);
    color: #38bdf8;
  }

  .menu-button:active {
    transform: scale(0.95);
  }

  .title-button {
    transition: all 0.3s ease-in-out;
  }

  .title-button:hover {
    opacity: 0.9;
    transform: scale(1.05);
  }

  .title-button:active {
    transform: scale(0.95);
  }

  .title-image {
    max-height: 3.5rem;
    object-fit: contain;
    filter: brightness(100%);
    transition: all 0.3s ease-in-out;
  }

  .title-image:hover {
    filter: brightness(110%);
  }

  @media (min-width: 768px) {
    .title-image {
      max-height: 4rem;
    }
  }

  .settings-button {
    height: 38px;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease-in-out;
    border-radius: 0.5rem;
    margin-top: 8px;
    margin-right: 12px;
  }

  .settings-button:hover {
    transform: scale(1.05);
    background-color: rgba(31, 41, 55, 0.3);
    color: #38bdf8;
  }

  .settings-button:active {
    transform: scale(0.95);
  }

  .settings-icon {
    color: white;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
  }

  .mobile-menu {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    z-index: 100;
  }

  .close-button {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    color: white;
    font-size: 1.5rem;
    transition: color 0.2s ease-in-out;
  }

  .close-button:hover {
    color: #d1d5db;
  }

  .menu-title {
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 2px solid #7dd3fc;
    padding-bottom: 0.5rem;
  }

  .settings-button-mobile {
    height: 38px;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease-in-out;
    color: white;
    margin-top: 1rem;
  }

  .settings-button-mobile:hover {
    transform: scale(1.05);
    color: #38bdf8;
  }

  .glow-effect {
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.3))
            drop-shadow(0 0 4px rgba(255, 255, 255, 0.2));
  }
</style>
