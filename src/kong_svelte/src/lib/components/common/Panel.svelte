<!-- Panel.svelte -->
<script lang="ts">
  export let variant: "transparent" | "solid" = "transparent";
  export let type: "main" | "secondary" = "main";
  export let width: string = "auto";
  export let height: string = "auto";
  export let content: string = '';
  export let className: string = '';
  export let zIndex: number = 10;
  export let roundedBorders: boolean = true;
</script>

<div 
  class="panel p-4 {variant} {type} {className} {roundedBorders ? '' : 'no-rounded'}"
  style="width: {width}; height: {height}; z-index: {zIndex};"
>
  <slot>{content}</slot>
</div>

<style lang="postcss">
.panel {
  @apply relative overflow-y-auto text-kong-text-primary flex flex-col min-h-0;
  -webkit-overflow-scrolling: touch; /* For smooth scrolling on iOS */
  backdrop-filter: blur(32px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel.solid {
  @apply bg-kong-bg-dark border border-kong-border;
  box-shadow: 0 8px 32px rgb(0 0 0 / 0.12);
  @apply dark:shadow-[0_8px_32px_rgba(0,0,0,0.32)];
  @apply dark:border-white/[0.02];
  @apply light:bg-white light:border-gray-800/20;
}

.panel.solid.main {
  @apply border-kong-border dark:border-white/[0.025];
  box-shadow: 0 12px 36px rgb(0 0 0 / 0.15);
  @apply dark:shadow-[0_12px_36px_rgba(0,0,0,0.4)];
  @apply light:bg-white light:border-gray-800/20;
}

.panel.transparent {
  background: rgb(var(--bg-dark) / 0.4);
  backdrop-filter: blur(16px);
  @apply border border-kong-border/30;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.01);
  @apply dark:shadow-[0_4px_12px_rgba(0,0,0,0.16)];
  @apply light:bg-white/70 light:border-gray-800/20;
}

.panel:not(.no-rounded) {
  @apply rounded-2xl;
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
  @apply rounded-2xl;
  background: linear-gradient(
    135deg,
    rgb(var(--text-primary) / 0.04) 0%,
    rgb(var(--text-primary) / 0.02) 50%,
    rgb(var(--text-primary) / 0.01) 100%
  );
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
  @apply rounded-2xl;
  background: radial-gradient(
    circle at 50% 0%,
    rgb(var(--text-primary) / 0.01) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* Hover effects for transparent variant */
.panel.transparent:hover,
.panel.transparent:has(.panel:hover) {
  background: rgb(var(--bg-dark) / 0.3);
  @apply border-kong-border/70;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.05);
  @apply dark:shadow-[0_8px_24px_rgba(0,0,0,0.2)];
  @apply light:bg-white/70;
}
</style>
