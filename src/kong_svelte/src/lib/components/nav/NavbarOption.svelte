<script lang="ts">
  import { fade } from "svelte/transition";
  import { ChevronDown } from "lucide-svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  // Simplified props - thread navItem
  let { 
    navItem,
    isActive,
  } = $props<{
    navItem: {
      type: 'dropdown' | 'link';
      label: string;
      tabId: string;
      defaultPath: string;
      options?: Array<{
        label: string;
        description: string;
        path: string;
        icon: any;
        comingSoon?: boolean;
      }>;
    };
    isActive: boolean;
  }>();

  let activeDropdown = $state<string | null>(null);

  // Determine if this is a dropdown or link
  const isDropdown = $derived(navItem.type === "dropdown" && navItem.options && navItem.options.length > 0);
  
  // Handle timeout internally for dropdowns
  let closeTimeout: ReturnType<typeof setTimeout>;
  
  const showDropdown = () => {
    if (!isDropdown) return;
    clearTimeout(closeTimeout);
    activeDropdown = navItem.tabId;
  };

  const hideDropdown = () => {
    if (!isDropdown) return;
    closeTimeout = setTimeout(() => {
      activeDropdown = null;
    }, 150);
  };

  // Handle click on the main button
  const handleMainClick = async () => {
    await goto(navItem.defaultPath);
  };

  // Handle click on a dropdown option
  const handleOptionClick = async (option: NonNullable<typeof navItem.options>[number]) => {
    if (!option.comingSoon) {
      hideDropdown();
      await goto(option.path);
    }
  };
</script>

<div 
  class="nav-dropdown"
  class:is-dropdown={isDropdown}
  role="group"
  onmouseenter={showDropdown}
  onmouseleave={hideDropdown}
>
  <button
    class="nav-link {isActive ? 'active' : ''}"
    onclick={handleMainClick}
  >
    {navItem.label}
    {#if isDropdown}
      <ChevronDown size={16} />
    {/if}
  </button>
  
  {#if isDropdown && activeDropdown === navItem.tabId && navItem.options}
    <div class="absolute top-full left-[-20px] min-w-[500px] p-3 bg-kong-bg-dark border border-kong-border rounded-md shadow-lg z-[61]" transition:fade={{ duration: 150 }}>
      <div class="px-5 pb-3 text-xs font-semibold tracking-wider text-kong-text-secondary border-b border-kong-border mb-2">{navItem.label} OPTIONS</div>
      {#each navItem.options as option}
        <button
          class="w-full grid grid-cols-[80px_1fr] items-center text-left relative rounded-md overflow-hidden px-4 py-4 transition-all duration-150 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed group"
          class:active={$page.url.pathname === option.path}
          onclick={() => handleOptionClick(option)}
          class:disabled={option.comingSoon}
        >
          <div class="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-md bg-kong-text-primary/5 text-kong-text-primary transition-all duration-300 ease-out transform group-hover:scale-110 group-hover:bg-kong-text-primary/10 group-hover:text-kong-primary">
            <svelte:component this={option.icon} size={20} />
          </div>
          <div class="flex flex-col gap-1 pt-0.5">
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-semibold text-kong-text-primary group-hover:text-kong-primary">
                {option.label}
              </span>
              {#if option.comingSoon}
                <span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide">Coming Soon</span>
              {/if}
            </div>
            <span class="text-sm text-kong-text-secondary leading-normal">{option.description}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss" scoped>
.nav-dropdown {
  @apply relative z-[60];
}

.nav-dropdown .nav-link {
  @apply flex items-center gap-1;
}

.nav-dropdown::after {
  @apply content-[''] absolute top-full left-0 w-full h-2 bg-transparent;
}

.nav-link {
  @apply relative h-12 px-4 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200;
}

.nav-link:hover {
  @apply text-kong-text-primary;
}

.nav-link.active {
  @apply text-kong-primary;
}
</style> 