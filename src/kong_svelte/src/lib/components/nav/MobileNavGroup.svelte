<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  export let title: string;
  export let options: Array<{
    label: string;
    description?: string;
    path: string;
    icon: any;
    comingSoon?: boolean;
  }>;
  export let activeTab: string;
  export let onTabChange: (tab: string) => void;
  export let onClose: () => void;

  const handleOptionClick = async (option: typeof options[number]) => {
    if (!option.comingSoon) {
      onTabChange(title.toLowerCase());
      await goto(option.path);
      onClose();
    }
  };
</script>

<div class="mobile-nav-group">
  <div class="mobile-nav-group-title">{title}</div>
  {#each options as option}
    <button
      class="mobile-nav-btn {activeTab === title.toLowerCase() && $page.url.pathname === option.path ? 'active' : ''}"
      on:click={() => handleOptionClick(option)}
      class:disabled={option.comingSoon}
    >
      <div class="mobile-nav-btn-icon">
        <svelte:component this={option.icon} size={18} />
      </div>
      <div class="mobile-nav-btn-content">
        <span>{option.label}</span>
        {#if option.comingSoon}
          <span class="coming-soon-badge">Soon</span>
        {/if}
      </div>
    </button>
  {/each}
</div>

<style lang="postcss" scoped>
  .mobile-nav-group {
    @apply mb-3;
  }

  .mobile-nav-group-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2;
  }

  .mobile-nav-btn {
    @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-200 text-sm font-medium;
  }

  .mobile-nav-btn.active {
    @apply text-kong-text-primary bg-kong-primary/10;
  }

  .mobile-nav-btn-icon {
    @apply flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-kong-text-primary/5;
  }

  .mobile-nav-btn-content {
    @apply flex items-center justify-between flex-1;
  }

  .coming-soon-badge {
    @apply text-[10px] font-medium px-2 py-0.5 rounded bg-kong-primary/20 text-kong-primary;
  }
</style> 