<script lang="ts">
  /**
   * Desktop Navigation Component
   * Focused component for desktop navigation UI
   */
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { NavTabId } from "$lib/config/navigation";
  import { NAVIGATION_ITEMS, getActiveTabFromPath } from "$lib/config/navigation";
  import { navigationState } from "$lib/state/navigation.state.svelte";
  import NavOption from "./NavOption.svelte";

  // Props
  let { 
    onLogoClick = () => goto("/"),
    class: className = ""
  } = $props();

  // State
  let activeTab = $derived(getActiveTabFromPath(page.url.pathname) || "swap");
  let navigationItems = $derived(NAVIGATION_ITEMS);
  
  // Desktop navigation items with proper typing
  let desktopNavItems = $derived(
    navigationItems.map((item) => {
      if (item.type === "dropdown") {
        return {
          type: "dropdown" as const,
          label: item.label,
          tabId: item.id,
          options: item.options.map((opt) => ({ ...opt, comingSoon: false })),
          defaultPath: item.path,
        };
      } else {
        return {
          type: "link" as const,
          label: item.label,
          tabId: item.id,
          defaultPath: item.path,
        };
      }
    }).filter(Boolean)
  );

  // Dropdown timeout management
  let closeTimeout: ReturnType<typeof setTimeout>;

  function handleDropdownShow(tabId: NavTabId): void {
    clearTimeout(closeTimeout);
    navigationState.showDropdown(tabId);
  }

  function handleDropdownHide(): void {
    closeTimeout = setTimeout(() => navigationState.hideDropdown(), 150);
  }

  // Cleanup on unmount
  $effect(() => {
    return () => {
      clearTimeout(closeTimeout);
    };
  });
</script>

<nav class="desktop-navbar {className}" role="navigation" aria-label="Main navigation">
  <!-- Logo -->
  <button
    class="logo-button"
    onclick={() => onLogoClick()}
    aria-label="Kong Logo - Go to homepage"
  >
    <div class="kong-logo-mask" aria-hidden="true"></div>
  </button>

  <!-- Navigation Items -->
  <div class="nav-items" role="menubar">
    {#each desktopNavItems as navItem (navItem.tabId)}
      {#if navItem.type === "dropdown"}
        <NavOption
          label={navItem.label}
          options={navItem.options}
          isActive={activeTab === navItem.tabId}
          activeDropdown={navigationState.activeDropdown === navItem.tabId ? navItem.tabId : null}
          onShowDropdown={() => handleDropdownShow(navItem.tabId)}
          onHideDropdown={handleDropdownHide}
          onTabChange={(tab) => (activeTab = tab as NavTabId)}
          defaultPath={navItem.defaultPath}
        />
      {:else if navItem.type === "link"}
        <button
          class="nav-link"
          class:active={activeTab === navItem.tabId}
          onclick={() => goto(navItem.defaultPath)}
          role="menuitem"
          aria-current={activeTab === navItem.tabId ? "page" : undefined}
        >
          {navItem.label}
        </button>
      {/if}
    {/each}
  </div>
</nav>

<style lang="postcss">
  .desktop-navbar {
    @apply flex items-center gap-4;
  }

  .logo-button {
    @apply flex items-center hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-kong-primary focus:ring-offset-2 rounded;
  }

  .kong-logo-mask {
    @apply h-[36px] w-[36px];
    background-color: rgb(var(--text-primary));
    -webkit-mask-image: url('/images/kongface-white.svg');
    mask-image: url('/images/kongface-white.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    transition: background-color 0.2s ease;
  }

  .nav-items {
    @apply flex items-center gap-0.5;
  }

  .nav-link {
    @apply relative h-16 px-5 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200 hover:text-kong-text-primary focus:outline-none focus:text-kong-primary rounded;
  }

  .nav-link.active {
    @apply text-kong-primary;
  }

  /* Focus management for accessibility */
  .nav-link:focus-visible {
    @apply ring-2 ring-kong-primary ring-offset-2;
  }
</style>