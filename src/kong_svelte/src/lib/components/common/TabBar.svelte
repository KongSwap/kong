<script lang="ts">
  import Badge from "./Badge.svelte";
  import type { UITab, UITabAction } from "$lib/types/ui";

  // Props
  type Props = {
    tabs: UITab<any>[];
    activeTab: any;
    onTabChange: (tab: any) => void;
    actions?: UITabAction[];
    class?: string;
  };

  let {
    tabs,
    activeTab,
    onTabChange,
    actions = [],
    class: className = ""
  }: Props = $props();
</script>

<div class="tab-bar {className}">
  <!-- Tabs -->
  {#each tabs as tab}
    <button
      class="tab-button"
      class:active={activeTab === tab.id}
      class:disabled={tab.disabled}
      onclick={() => !tab.disabled && onTabChange(tab.id)}
      disabled={tab.disabled}
      aria-label={tab.label}
      aria-selected={activeTab === tab.id}
    >
      {#if tab.icon}
        {@const Icon = tab.icon}
        <Icon size={16} />
      {/if}
      <span class="tab-label">{tab.label}</span>
      {#if tab.badge}
        <Badge variant="red" size="xs">{tab.badge}</Badge>
      {/if}
    </button>
  {/each}

  <!-- Actions -->
  {#if actions.length > 0}
    <div class="tab-actions">
      {#each actions as action}
        {@const Icon = action.icon}
        <button
          class="action-button"
          class:danger={action.variant === "danger"}
          onclick={action.onClick}
          aria-label={action.tooltip}
          title={action.tooltip}
        >
          <Icon size={16} />
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .tab-bar {
    @apply flex border-b border-kong-border bg-kong-bg-primary;
  }

  .tab-button {
    @apply flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2;
    @apply text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5;
    @apply transition-colors relative;
  }

  .tab-button.active {
    @apply text-kong-primary border-b-2 border-kong-primary bg-kong-text-primary/5;
  }

  .tab-button.disabled {
    @apply opacity-50 cursor-not-allowed hover:bg-transparent hover:text-kong-text-secondary;
  }

  .tab-label {
    @apply hidden sm:block;
  }

  .tab-actions {
    @apply flex;
  }

  .action-button {
    @apply px-4 py-3.5 text-sm font-medium flex items-center justify-center;
    @apply text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5;
    @apply transition-colors;
  }

  .action-button.danger {
    @apply hover:text-kong-error hover:bg-kong-error/5;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .tab-button:not(.active) {
      @apply px-3;
    }
    
    .action-button {
      @apply px-3;
    }
  }
</style>