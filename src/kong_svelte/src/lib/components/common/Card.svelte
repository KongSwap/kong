<script lang="ts">
  export let onClick: (() => void) | undefined = undefined;
  export let isHighlighted = false;
  export let className = "";
</script>

<button
  class="w-full text-left bg-kong-bg-secondary rounded-kong-roundness border border-kong-border transition-all duration-200 overflow-hidden hover:bg-kong-bg-tertiary {isHighlighted
    ? 'bg-gradient-to-br from-[rgba(0,149,235,0.05)] to-[rgba(0,149,235,0.02)] shadow-[inset_0_1px_1px_rgba(0,149,235,0.1)]'
    : ''} {className}"
  onclick={onClick}
  disabled={!onClick}
>
  <slot />
</button>
