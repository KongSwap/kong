<!-- Panel.svelte -->
<script lang="ts">
  import { fade, slide, type TransitionConfig } from 'svelte/transition';
  import { themeStore } from '../../stores/themeStore';
  import { getThemeById } from '../../themes/themeRegistry';
  import {panelRoundness, transparentPanel } from '../../stores/derivedThemeStore';

  let {
    variant = transparentPanel ? "transparent" : "solid",
    type = "main",
    width = "auto",
    height = "auto",
    content = '',
    className = '',
    zIndex = 10,
    // New roundness prop using Tailwind classes, can be overridden by prop
    unpadded = false,
    animated = false,
    isSwapPanel = false,
    isSidebar = false,
    interactive = false,
    shadow = "shadow-none",
    roundness,
    // Transition props
    transition = null,
    transitionParams = {},
    
    children,
    onclick
  } = $props<{
    variant?: "transparent" | "solid";
    type?: "main" | "secondary";
    width?: string;
    height?: string;
    content?: string;
    className?: string;
    zIndex?: number;
    unpadded?: boolean;
    roundness?: string;
    animated?: boolean;
    isSwapPanel?: boolean;
    shadow?: string;
    isSidebar?: boolean;
    interactive?: boolean;
    transition?: 'fade' | 'slide' | null;
    transitionParams?: TransitionConfig;
    children?: () => any;
    onclick?: () => void;
  }>();

  // Make roundness reactive to theme changes
  let effectiveRoundness = $derived(roundness ?? "rounded-kong-roundness");

  // Default transition parameters
  const defaultSlideParams = { duration: 300, delay: 200, axis: 'x' };
  const defaultFadeParams = { duration: 200 };

  // Computed values
  let params = $derived({
    ...(transition === 'slide' ? defaultSlideParams : defaultFadeParams),
    ...transitionParams
  });
    
  // Compute the interactive class based on interactive prop
  let interactiveClass = $derived(interactive ? 'interactive' : '');
  
  // Subscribe to theme changes
  $effect(() => {
    const unsubscribe = themeStore.subscribe(themeId => {
      const theme = getThemeById(themeId);
    });
    
    return unsubscribe;
  });
</script>

{#if transition === 'slide'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {shadow} {type} !{effectiveRoundness} {className} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''} {interactiveClass}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:slide={params}
    onclick={onclick}
  >
    {#if children}
      {@render children()}
    {:else}
      {content}
    {/if}
  </div>
{:else if transition === 'fade'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {shadow} {type} !{effectiveRoundness} {className} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''} {interactiveClass}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:fade={params}
    onclick={onclick}
  >
    {#if children}
      {@render children()}
    {:else}
      {content}
    {/if}
  </div>
{:else}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {shadow} {type} !{effectiveRoundness} {className} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''} {interactiveClass}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    onclick={onclick}
  >
    {#if children}
      {@render children()}
    {:else}
      {content}
    {/if}
  </div>
{/if}

<style lang="postcss" scoped>
.panel {
  @apply relative text-kong-text-primary flex flex-col min-h-0 overflow-hidden;
}

.panel.animated {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Base solid panel styling - uses theme variables */
.panel.solid {
  @apply bg-kong-bg-secondary border border-kong-border/70;
}

/* Main panel styling - slightly different for primary panels */
.panel.solid.main {
  @apply border-kong-border/70;
}

/* Sidebar panel specific style */
.panel.solid.sidebar-panel,
.panel.solid.main.sidebar-panel {
  @apply border-kong-border/80;
  border-width: 1px;
}

/* Transparent panel styling */
.panel.transparent {
  @apply bg-kong-bg-secondary/90 backdrop-blur-md;
  @apply border border-kong-border/50;
}

/* Interactive panel styles */
.panel.interactive {
  @apply cursor-pointer transition-all hover:scale-[1.02];
}

.panel.interactive.solid {
  @apply hover:border-kong-primary/60;
}

.panel.interactive.transparent {
  @apply hover:border-kong-primary/60;
}

/* Active state for interactive panels */
.panel.interactive.active {
  @apply border-kong-primary bg-kong-primary-hover text-kong-text-on-primary;
}

/* Premium edge highlight for solid variant - uses theme text color */
.panel.solid:not(.rounded-none)::before {
  content: '';
  position: absolute;
  inset: 0;
  @apply bg-gradient-to-br from-kong-text-primary/[0.04] via-kong-text-primary/[0.02] to-kong-text-primary/[0.01];
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* Inner glow effect - uses theme text color */
.panel.solid::after {
  content: '';
  position: absolute;
  inset: 0;
  @apply bg-gradient-radial from-kong-text-primary/[0.01] to-transparent;
  pointer-events: none;
}

</style>