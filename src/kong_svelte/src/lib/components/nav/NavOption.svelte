<script lang="ts">
  import { fade } from "svelte/transition";
  import { ChevronDown } from "lucide-svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { keyboardNavigation } from "$lib/actions/keyboardNavigation";

  // Define props using runes
  let { 
    label, 
    options, 
    isActive, 
    activeDropdown, 
    onShowDropdown, 
    onHideDropdown, 
    onTabChange, 
    defaultPath 
  } = $props<{
    label: string;
    options: Array<{
      label: string;
      description: string;
      path: string;
      icon: import('svelte').ComponentType;
      comingSoon?: boolean;
    }>;
    isActive: boolean;
    activeDropdown: string | null;
    onShowDropdown: (type: string) => void;
    onHideDropdown: () => void;
    onTabChange: (tab: string) => void;
    defaultPath: string;
  }>();

  // State for keyboard navigation
  let focusedIndex = $state(-1);
  let dropdownElement = $state<HTMLElement>();
  let buttonElement = $state<HTMLElement>();
  let dropdownPosition = $state({ top: 0, left: 0 });

  // Handle click on a dropdown option
  const handleOptionClick = async (option: typeof options[number]) => {
    if (!option.comingSoon) {
      onHideDropdown();
      onTabChange(label.toLowerCase());
      await goto(option.path);
    }
  };

  // Handle keyboard navigation
  function handleKeyboardNavigate(index: number) {
    focusedIndex = index;
  }

  function handleKeyboardSelect(index: number) {
    if (index >= 0 && index < options.length) {
      handleOptionClick(options[index]);
    }
  }

  function handleEscape() {
    onHideDropdown();
    focusedIndex = -1;
  }

  // Reset focus when dropdown closes
  $effect(() => {
    if (!activeDropdown) {
      focusedIndex = -1;
    }
  });
  
  // Calculate dropdown position when it opens
  $effect(() => {
    if (activeDropdown === label.toLowerCase() && buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + window.scrollY,
        left: rect.left - 20 + window.scrollX // Adjust for the original -20px offset
      };
    }
  });
</script>

<div 
  class="nav-dropdown"
  onmouseenter={() => onShowDropdown(label.toLowerCase())}
  onmouseleave={onHideDropdown}
  role="menuitem"
  aria-haspopup="true"
  aria-expanded={activeDropdown === label.toLowerCase()}
>
  <button
    bind:this={buttonElement}
    class="nav-link {isActive ? 'active' : ''}"
    onclick={() => goto(defaultPath)}
    aria-label="{label} navigation menu"
    aria-current={isActive ? 'page' : undefined}
  >
    {label}
    <ChevronDown 
      size={16} 
      class="transition-transform duration-200 {activeDropdown === label.toLowerCase() ? 'rotate-180' : ''}"
      aria-hidden="true"
    />
  </button>
  
  {#if activeDropdown === label.toLowerCase()}
    <div 
      bind:this={dropdownElement}
      class="dropdown-menu"
      style="--dropdown-top: {dropdownPosition.top}px; --dropdown-left: {dropdownPosition.left}px;"
      transition:fade={{ duration: 150 }}
      role="menu"
      aria-label="{label} options"
      use:keyboardNavigation={{
        items: options,
        focusedIndex,
        onNavigate: handleKeyboardNavigate,
        onSelect: handleKeyboardSelect,
        onEscape: handleEscape
      }}
      tabindex="-1"
    >
      <div class="dropdown-header">
        {label} OPTIONS
      </div>
      {#each options as option, index}
        <button
          class="dropdown-option"
          class:active={$page.url.pathname === option.path}
          class:disabled={option.comingSoon}
          class:focused={focusedIndex === index}
          onclick={() => handleOptionClick(option)}
          disabled={option.comingSoon}
          role="menuitem"
          aria-label="{option.label} - {option.description}"
          tabindex={focusedIndex === index ? 0 : -1}
        >
          <div class="option-icon">
            <svelte:component this={option.icon} size={20} aria-hidden="true" />
          </div>
          <div class="option-content">
            <div class="option-title">
              <span class="option-label">
                {option.label}
              </span>
              {#if option.comingSoon}
                <span class="coming-soon-badge" aria-label="Coming soon">Coming Soon</span>
              {/if}
            </div>
            <span class="option-description">{option.description}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss" scoped>
.nav-dropdown {
  @apply relative z-[110]; /* High z-index to ensure dropdowns appear above all page content */
}

.nav-dropdown .nav-link {
  @apply flex items-center gap-1;
}

.nav-dropdown::after {
  @apply content-[''] absolute top-full left-0 w-full h-2 bg-transparent;
}

.nav-link {
  @apply relative h-16 px-5 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-kong-primary focus:ring-offset-2 rounded;
}

.nav-link:hover {
  @apply text-kong-text-primary;
}

.nav-link.active {
  @apply text-kong-primary;
}

.dropdown-menu {
  @apply fixed min-w-[500px] p-3 bg-kong-bg-primary border border-kong-border shadow-lg z-[9999] focus:outline-none; /* Fixed positioning with very high z-index to escape all stacking contexts */
  border-radius: var(--panel-roundness, 0.75rem);
  top: var(--dropdown-top, auto);
  left: var(--dropdown-left, auto);
}

.dropdown-header {
  @apply px-5 pb-3 text-xs font-semibold tracking-wider text-kong-text-secondary border-b border-kong-border mb-2;
}

.dropdown-option {
  @apply w-full grid grid-cols-[80px_1fr] items-center text-left relative overflow-hidden px-4 py-4 transition-all duration-150 hover:bg-kong-text-primary/5 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:bg-kong-text-primary/10;
  border-radius: var(--panel-roundness, 0.75rem);
}

.dropdown-option:hover .option-icon {
  @apply scale-110 bg-kong-text-primary/10 text-kong-primary;
}

.dropdown-option:hover .option-label {
  @apply text-kong-primary;
}

.dropdown-option.focused {
  @apply bg-kong-text-primary/10 ring-2 ring-kong-primary;
}

.dropdown-option.active {
  @apply bg-kong-primary/10;
}

.option-icon {
  @apply flex-shrink-0 w-11 h-11 flex items-center justify-center bg-kong-text-primary/5 text-kong-text-primary transition-all duration-300 ease-out transform;
  border-radius: var(--panel-roundness, 0.75rem);
}

.option-content {
  @apply flex flex-col gap-1 pt-0.5;
}

.option-title {
  @apply flex items-center gap-2;
}

.option-label {
  @apply text-[15px] font-semibold text-kong-text-primary;
}

.option-description {
  @apply text-sm text-kong-text-secondary leading-normal;
}

.coming-soon-badge {
  @apply text-[11px] font-medium px-1.5 py-0.5 rounded bg-kong-primary/15 text-kong-primary tracking-wide;
}
</style> 