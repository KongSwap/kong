<script lang="ts">
  /**
   * BaseNavItem component
   * Shared navigation item component for mobile menus and navigation groups
   */
  let {
    label,               // Button label text
    icon,                // Icon component to display
    onClick,             // Click handler function
    isActive = false,    // Whether the item is currently active
    iconBackground = "bg-kong-text-primary/5", // Background color for the icon
    badgeCount = 0,      // Number to display in badge (if > 0)
    comingSoon = false,  // Whether to show "Soon" badge
    class: className = "", // Additional CSS classes
    children = () => null,  // Slot content as a render function
  } = $props();
</script>

<button
  class="base-nav-btn {className}"
  class:active={isActive}
  class:disabled={comingSoon}
  onclick={onClick}
>
  <div class="base-nav-btn-icon {iconBackground} relative">
    {@render icon({ size: 18 })}
    {#if badgeCount > 0}
      <div class="badge">{badgeCount}</div>
    {/if}
  </div>
  <div class="base-nav-btn-content">
    <span>{label}</span>
    {#if comingSoon}
      <span class="coming-soon-badge">Soon</span>
    {/if}
    {@render children()}
  </div>
</button>

<style lang="postcss">
  .base-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-200 text-sm font-medium;
  }

  .base-nav-btn.active {
    @apply text-kong-text-primary bg-kong-primary/10;
  }

  .base-nav-btn.disabled {
    @apply opacity-70 pointer-events-none;
  }

  .base-nav-btn-icon {
    @apply flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg;
  }

  .base-nav-btn-content {
    @apply flex items-center justify-between flex-1;
  }
  
  .badge {
    @apply absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-kong-error text-white text-[10px] font-medium flex items-center justify-center;
  }

  .coming-soon-badge {
    @apply text-[10px] font-medium px-2 py-0.5 rounded bg-kong-primary/20 text-kong-primary;
  }
</style> 