<!-- Panel.svelte -->
<script lang="ts">
  import { fade, slide, type TransitionConfig } from 'svelte/transition';

  export let variant: "transparent" | "solid" = "transparent";
  export let type: "main" | "secondary" = "main";
  export let width: string = "auto";
  export let height: string = "auto";
  export let content: string = '';
  export let className: string = '';
  export let zIndex: number = 10;
  export let roundedBorders: boolean = true;
  export let unpadded: boolean = false;
  export let animated: boolean = false;
  export let isSwapPanel: boolean = false;
  export let isSidebar: boolean = false;
  
  // Transition props
  export let transition: 'fade' | 'slide' | null = null;
  export let transitionParams: TransitionConfig = {};

  // Default transition parameters
  const defaultSlideParams = { duration: 300, delay: 200, axis: 'x' };
  const defaultFadeParams = { duration: 200 };

  $: params = {
    ...(transition === 'slide' ? defaultSlideParams : defaultFadeParams),
    ...transitionParams
  };
</script>

{#if transition === 'slide'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundedBorders ? '' : '!rounded-none'} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:slide={params}
  >
    <slot>{content}</slot>
  </div>
{:else if transition === 'fade'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundedBorders ? '' : '!rounded-none'} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:fade={params}
  >
    <slot>{content}</slot>
  </div>
{:else}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundedBorders ? '' : '!rounded-none'} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
  >
    <slot>{content}</slot>
  </div>
{/if}

<style lang="postcss" scoped>
.panel {
  @apply relative text-kong-text-primary flex flex-col min-h-0 rounded-lg;
}

.panel.animated {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel.solid {
  @apply bg-kong-bg-dark border border-kong-border;
  @apply shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.32)];
  @apply dark:border-white/[0.02];
  @apply light:bg-kong-bg-dark light:border-kong-border;
}

.panel.solid.main {
  @apply border-kong-border dark:border-white/[0.025];
  @apply shadow-xl dark:shadow-[0_12px_36px_rgba(0,0,0,0.4)];
  @apply light:bg-kong-bg-dark light:border-kong-border;
}

.panel.transparent {
  @apply bg-kong-bg-dark/40;
  backdrop-filter: blur(12px);
  @apply border border-kong-border/50;
  @apply shadow-sm dark:shadow-[0_4px_12px_rgba(0,0,0,0.16)];
  @apply light:bg-kong-bg-dark/90 light:border-kong-border;
}


/* Premium edge highlight for solid variant */
.panel.solid:not(.no-rounded)::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  @apply bg-gradient-to-br from-kong-text-primary/[0.04] via-kong-text-primary/[0.02] to-kong-text-primary/[0.01];
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* Inner glow effect for solid variant */
.panel.solid::after {
  content: '';
  position: absolute;
  inset: 0;
  @apply bg-gradient-radial from-kong-text-primary/[0.01] to-transparent;
  pointer-events: none;
}

/* Enhanced glow effect for plain-black theme */
:global(:root.plain-black) .panel.solid {
  box-shadow: none;
  @apply border-white/30 border-2;
}

:global(:root.plain-black) .panel.solid.main {
  box-shadow: none;
  @apply border-white/50 border-2;
}

/* Thinner border for sidebar panel */
:global(:root.plain-black) .panel.solid.sidebar-panel,
:global(:root.plain-black) .panel.solid.main.sidebar-panel {
  @apply border-white/20 border;
}

:global(:root.plain-black) .panel.solid:not(.no-rounded)::before {
  display: none;
}

:global(:root.plain-black) .panel.solid::after {
  display: none;
}

:global(:root.plain-black) .panel.transparent {
  box-shadow: none;
  @apply border-white/0 border;
  background: linear-gradient(135deg, rgba(40, 40, 40, 0.25) 0%, rgba(20, 20, 20, 0.15) 100%);
  backdrop-filter: blur(8px);
}

:global(:root.plain-black) .panel.transparent:hover,
:global(:root.plain-black) .panel.transparent:has(.panel:hover) {
  box-shadow: none;
  @apply border-white/10 border;
  background: linear-gradient(135deg, rgba(50, 50, 50, 0.3) 0%, rgba(25, 25, 25, 0.2) 100%);
}

/* Add a subtle gradient overlay for transparent panels in plain-black theme */
:global(:root.plain-black) .panel.transparent::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

/* Special gradient for swap panel */
:global(:root.plain-black) .panel.transparent.swap-panel::before {
  background: linear-gradient(to right bottom, rgba(255, 255, 255, 0.03), transparent);
}
</style>