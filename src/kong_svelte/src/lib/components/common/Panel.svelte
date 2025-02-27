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
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundedBorders ? '' : 'no-rounded'} {animated ? 'animated' : ''}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:slide={params}
  >
    <slot>{content}</slot>
  </div>
{:else if transition === 'fade'}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundedBorders ? '' : 'no-rounded'} {animated ? 'animated' : ''}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
    transition:fade={params}
  >
    <slot>{content}</slot>
  </div>
{:else}
  <div 
    class="panel {unpadded ? '' : 'p-4'} {variant} {type} {className} {roundedBorders ? '' : 'no-rounded'} {animated ? 'animated' : ''}"
    style="width: {width}; height: {height}; z-index: {zIndex};"
  >
    <slot>{content}</slot>
  </div>
{/if}

<style lang="postcss">
.panel {
  @apply relative text-kong-text-primary flex flex-col min-h-0;
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
  @apply bg-kong-bg-dark/60;
  backdrop-filter: blur(22px);
  @apply border border-kong-border/50;
  @apply shadow-sm dark:shadow-[0_4px_12px_rgba(0,0,0,0.16)];
  @apply light:bg-kong-bg-dark/95 light:border-kong-border;
}

.panel:not(.no-rounded) {
  @apply rounded-xl;
}

.panel.no-rounded {
  @apply border-0;
}

/* Premium edge highlight for solid variant */
.panel.solid:not(.no-rounded)::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  @apply rounded-lg;
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
  @apply rounded-lg;
  @apply bg-gradient-radial from-kong-text-primary/[0.01] to-transparent;
  pointer-events: none;
}

/* Hover effects for transparent variant */
.panel.transparent:hover,
.panel.transparent:has(.panel:hover) {
  @apply bg-kong-bg-dark/60;
  @apply border-kong-border/80;
  @apply shadow-md dark:shadow-[0_8px_24px_rgba(0,0,0,0.2)];
  @apply light:bg-kong-bg-dark/95;
}
</style>