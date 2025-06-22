<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import BaseNavItem from './BaseNavItem.svelte';

  let {
    title,
    options,
    activeTab,
    onTabChange,
    onClose
  } = $props<{
    title: string;
    options: Array<{
      label: string;
      description?: string;
      path: string;
      icon: any;
      comingSoon?: boolean;
    }>;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onClose: () => void;
  }>();

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
    <BaseNavItem
      label={option.label}
      icon={option.icon}
      isActive={$page.url.pathname === option.path}
      comingSoon={option.comingSoon}
      onClick={() => handleOptionClick(option)}
    />
  {/each}
</div>

<style lang="postcss">
  .mobile-nav-group {
    @apply mb-3;
  }

  .mobile-nav-group-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2;
  }
</style> 