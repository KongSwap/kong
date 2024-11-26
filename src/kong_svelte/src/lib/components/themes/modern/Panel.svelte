<script lang="ts">
  import { browser } from "$app/environment";

  export let variant: "green" | "yellow" | "blue" = "green";
  export let type: "main" | "secondary" = "main";
  export let width: string = "auto";
  export let height: string = "auto"; 
  export let content: string = '';
  export let className: string = '';
  export let zIndex: number = 10;
  export let roundedBorders: boolean = true;

  function formatDimension(value: number | string): string {
      return value === 'auto' ? 'auto' : typeof value === 'number' ? `${value}px` : value;
  }

  $: formattedWidth = formatDimension(width);
  $: formattedHeight = formatDimension(height);
  $: isAutoSize = width === 'auto' || height === 'auto';
  $: if(browser) {
      document.getElementById('panel')?.style.setProperty('z-index', zIndex.toString());
  }
</script>

<div 
  id="panel"
  class="panel modern-panel {variant} {type} {className} {roundedBorders ? '' : 'no-rounded'}"
  style="width: {formattedWidth}; height: {formattedHeight};"
>
  <div class="panel-container min-w-full" class:auto-size={isAutoSize}>
      <div class="panel-content">
          <slot>{content}</slot>
      </div>
      <div class="panel-accent"></div>
  </div>
</div>

<style lang="postcss">
.modern-panel {
  @apply relative rounded-xl overflow-hidden;
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 
    0 32px 64px -16px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(32px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: white;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.modern-panel.no-rounded {
  @apply rounded-none;
  border: none !important;
  border-radius: 0 !important;
}

.modern-panel.green {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(32, 201, 151, 0.12);
}

.modern-panel.green.no-rounded {
  border: none;
}

.modern-panel.yellow {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 207, 0, 0.12);
}

.modern-panel.yellow.no-rounded {
  border: none;
}

.modern-panel.blue {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(0, 122, 255, 0.12);
}

.modern-panel.blue.no-rounded {
  border: none;
}

.modern-panel.main {
  @apply backdrop-blur-3xl;
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 32px 64px -16px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.modern-panel.secondary {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0);
  box-shadow: 
    0 24px 48px -12px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.panel {
  position: relative;
  backdrop-filter: blur(32px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 20px;
}

.panel:not(.no-rounded) {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
}

/* Premium edge highlight */
.panel:not(.no-rounded)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 2px;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.03) 50%,
    rgba(255, 255, 255, 0.01) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* Inner glow effect */
.panel::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 16px;
  background: radial-gradient(
    circle at 50% 0%,
    rgba(255, 255, 255, 0.02) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* Glass effect for content */
:global(.panel > *) {
  position: relative;
  z-index: 1;
}

.auto-size {
}

/* Custom scrollbar styles */
:global(.modern-panel *::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

:global(.modern-panel *::-webkit-scrollbar-track) {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 2px;
}

:global(.modern-panel *::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

:global(.modern-panel *::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.12);
}

/* Glass panel styling */
.modern-panel.glass-panel {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(32px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
