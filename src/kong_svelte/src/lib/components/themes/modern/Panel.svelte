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

<style>
.modern-panel {
  position: relative;
  overflow: visible;
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(32px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: white;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
}

.modern-panel.no-rounded {
  border-radius: 0;
  border: none !important;
}

.modern-panel.green {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(32, 201, 151, 0.12);
  box-shadow: 0 0 20px rgba(32, 201, 151, 0.05);
}

.modern-panel.green.no-rounded {
  border: none;
}

.modern-panel.yellow {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 207, 0, 0.12);
  box-shadow: 0 0 20px rgba(255, 207, 0, 0.05);
}

.modern-panel.yellow.no-rounded {
  border: none;
}

.modern-panel.blue {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(0, 122, 255, 0.12);
  box-shadow: 0 0 20px rgba(0, 122, 255, 0.05);
}

.modern-panel.blue.no-rounded {
  border: none;
}

.modern-panel.main {
  backdrop-filter: blur(48px);
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
}

.modern-panel.secondary {
  background: linear-gradient(180deg, rgba(18, 20, 32, 0.98) 0%, rgba(12, 14, 24, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
}

.panel {
  position: relative;
  backdrop-filter: blur(32px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 20px;
}

.panel:not(.no-rounded) {
  border-radius: 16px;
  overflow: hidden;
}

/* Premium edge highlight */
.panel:not(.no-rounded)::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.02) 100%
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
  inset: 0;
  border-radius: 16px;
  background: radial-gradient(
    circle at 50% 0%,
    rgba(255, 255, 255, 0.03) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* Glass effect for content */
.panel > * {
  position: relative;
  z-index: 1;
}

/* Custom scrollbar styles */
.modern-panel *::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.modern-panel *::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 2px;
}

.modern-panel *::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.modern-panel *::-webkit-scrollbar-thumb:hover {
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
  min-width: 100%;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
