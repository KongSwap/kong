<script lang="ts">
  export let label: string;
  export let icon: any;
  export let onClick: () => void;
  export let isActive = false;
  export let iconBackground = "bg-kong-text-primary/5";
  export let comingSoon = false;
  export let description = "";
</script>

<button
  class="mobile-nav-btn"
  class:active={isActive}
  class:disabled={comingSoon}
  on:click={onClick}
>
  <div class="mobile-nav-btn-icon {iconBackground}">
    <svelte:component this={icon} size={18} />
  </div>
  <div class="mobile-nav-btn-content">
    <div class="flex flex-col items-start">
      <span>{label}</span>
    </div>
    {#if comingSoon}
      <span class="coming-soon-badge">Soon</span>
    {/if}
  </div>
</button>

<style lang="postcss" scoped>
  .mobile-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-200 text-sm font-medium;
  }

  .mobile-nav-btn.active {
    @apply text-kong-text-primary bg-kong-primary/10;
  }

  .mobile-nav-btn.disabled {
    @apply opacity-70 cursor-not-allowed;
  }

  .mobile-nav-btn-icon {
    @apply flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg;
  }

  .mobile-nav-btn-content {
    @apply flex items-center justify-between flex-1;
  }

  .coming-soon-badge {
    @apply text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide;
  }
</style> 
