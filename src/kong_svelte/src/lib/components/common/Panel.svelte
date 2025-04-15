<!-- Panel.svelte -->
<script lang="ts">
  import { fade, slide, type TransitionConfig } from 'svelte/transition';
  import { themeStore } from '../../stores/themeStore';
  import { getThemeById } from '../../themes/themeRegistry';

  let {
    variant = "transparent",
    type = "main",
    width = "auto",
    height = "auto",
    content = '',
    className = '',
    zIndex = 10,
    roundedBorders = true,
    // New roundness prop using Tailwind classes, can be overridden by prop
    roundness = null,
    unpadded = false,
    animated = false,
    isSwapPanel = false,
    isSidebar = false,
    interactive = false,
    
    // Transition props
    transition = null,
    transitionParams = {},
    
    children
  } = $props<{
    variant?: "transparent" | "solid";
    type?: "main" | "secondary";
    width?: string;
    height?: string;
    content?: string;
    className?: string;
    zIndex?: number;
    roundedBorders?: boolean;
    roundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full" | null;
    unpadded?: boolean;
    animated?: boolean;
    isSwapPanel?: boolean;
    isSidebar?: boolean;
    interactive?: boolean;
    transition?: 'fade' | 'slide' | null;
    transitionParams?: TransitionConfig;
    children?: () => any;
  }>();

  // Default transition parameters
  const defaultSlideParams = { duration: 300, delay: 200, axis: 'x' };
  const defaultFadeParams = { duration: 200 };

  // Store the current theme's panel roundness or use default
  let themeRoundness = $state("rounded-lg");
  
  // Computed values
  let params = $derived({
    ...(transition === 'slide' ? defaultSlideParams : defaultFadeParams),
    ...transitionParams
  });
  
  // Compute the roundness class based on props and theme
  let roundnessClass = $derived(!roundedBorders 
    ? 'rounded-none' 
    : roundness || themeRoundness);
    
  // Compute the interactive class based on interactive prop
  let interactiveClass = $derived(interactive ? 'interactive' : '');
  
  // Subscribe to theme changes
  $effect(() => {
    const unsubscribe = themeStore.subscribe(themeId => {
      const theme = getThemeById(themeId);
      themeRoundness = theme.colors.panelRoundness || "rounded-lg";
    });
    
    return unsubscribe;
  });
</script>

{#if transition === 'slide'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundnessClass} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''} {interactiveClass}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:slide={params}
    on:click
    on:keydown
  >
    {#if children}
      {@render children()}
    {:else}
      {content}
    {/if}
  </div>
{:else if transition === 'fade'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundnessClass} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''} {interactiveClass}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:fade={params}
    on:click
    on:keydown
  >
    {#if children}
      {@render children()}
    {:else}
      {content}
    {/if}
  </div>
{:else}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundnessClass} {animated ? 'animated' : ''} {isSwapPanel ? 'swap-panel' : ''} {isSidebar ? 'sidebar-panel' : ''} {interactiveClass}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    on:click
    on:keydown
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
  @apply relative text-kong-text-primary flex flex-col min-h-0;
}

.panel.animated {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Base solid panel styling - uses theme variables */
.panel.solid {
  @apply bg-kong-bg-dark border border-kong-border;
  @apply shadow;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

/* Main panel styling - slightly different for primary panels */
.panel.solid.main {
  @apply border-kong-border;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

/* Sidebar panel specific style */
.panel.solid.sidebar-panel,
.panel.solid.main.sidebar-panel {
  @apply border-kong-border/80;
  border-width: 1px;
}

/* Transparent panel styling */
.panel.transparent {
  @apply bg-kong-bg-dark/85;
  backdrop-filter: blur(12px);
  @apply border border-kong-border/50;
  @apply shadow-sm;
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

/* Hover effect for transparent panels */
.panel.transparent:hover,
.panel.transparent:has(.panel:hover) {
  @apply border-kong-border/70;
  @apply bg-kong-bg-dark/90;
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
  border-radius: inherit;
}

/* Inner glow effect - uses theme text color */
.panel.solid::after {
  content: '';
  position: absolute;
  inset: 0;
  @apply bg-gradient-radial from-kong-text-primary/[0.01] to-transparent;
  pointer-events: none;
}

/* Special styling for swap panels */
.panel.transparent.swap-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(to right bottom, rgba(255, 255, 255, 0.03), transparent);
  pointer-events: none;
}
</style>