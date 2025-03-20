<script lang="ts">
  export let label: string;
  export let icon: any;
  export let onClick: () => void;
  export let isActive = false;
  export let iconBackground = "bg-kong-text-primary/5";
  export let badgeCount = 0;
</script>

<button
  class="mobile-nav-btn"
  class:active={isActive}
  on:click={onClick}
>
  <div class="mobile-nav-btn-icon {iconBackground} relative">
    <svelte:component this={icon} size={18} />
    {#if badgeCount > 0}
      <div class="badge">{badgeCount}</div>
    {/if}
  </div>
  <div class="mobile-nav-btn-content">
    <span>{label}</span>
  </div>
</button>

<style lang="postcss" scoped>
  .mobile-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-200 text-sm font-medium;
  }

  .mobile-nav-btn.active {
    @apply text-kong-text-primary bg-kong-primary/10;
  }

  .mobile-nav-btn-icon {
    @apply flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg;
  }

  .mobile-nav-btn-content {
    @apply flex items-center justify-between flex-1;
  }
  
  .badge {
    @apply absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-kong-accent-red text-white text-[10px] font-medium flex items-center justify-center;
  }
</style> 