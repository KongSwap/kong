<script lang="ts">
  interface Props {
    onClick?: (() => void) | undefined;
    isHighlighted?: boolean;
    className?: string;
    hasHeader?: boolean;
    isPadded?: boolean;
    [key: string]: any;
  }
  
  let { 
    onClick = undefined,
    isHighlighted = false,
    className = "",
    hasHeader = false,
    isPadded = false,
    ...restProps
  }: Props = $props();
</script>

{#if onClick}
  <button
    class="w-full text-left hover:shadow bg-kong-bg-secondary rounded-kong-roundness border border-kong-border/60 transition-all duration-200 overflow-hidden {isHighlighted
      ? 'bg-gradient-to-br from-[rgba(0,149,235,0.05)] to-[rgba(0,149,235,0.02)] shadow-[inset_0_1px_1px_rgba(0,149,235,0.1)]'
      : ''} {isPadded ? 'p-4' : ''} {className}"
    onclick={onClick}
    {...restProps}
  >
    {#if hasHeader}
      <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-kong-border/30">
        <slot name="header" />
      </div>
    {/if}
    <slot />
  </button>
{:else}
  <div
    class="w-full hover:shadow text-left bg-kong-bg-secondary rounded-kong-roundness border border-kong-border/60 transition-all duration-200 overflow-hidden {isHighlighted
      ? 'bg-gradient-to-br from-[rgba(0,149,235,0.05)] to-[rgba(0,149,235,0.02)] shadow-[inset_0_1px_1px_rgba(0,149,235,0.1)]'
      : ''} {className} {isPadded ? 'p-4' : ''}"
    {...restProps}
  >
    {#if hasHeader}
      <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-kong-border/30">
        <slot name="header" />
      </div>
    {/if}
    <slot />
  </div>
{/if}
