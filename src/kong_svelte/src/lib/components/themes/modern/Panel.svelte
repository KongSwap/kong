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
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 24px 48px -12px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(24px);
    transition: all 0.2s ease-out;
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
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(32, 201, 151, 0.15);
  }

  .modern-panel.green.no-rounded {
    border: none;
  }

  .modern-panel.yellow {
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(255, 207, 0, 0.15);
  }

  .modern-panel.yellow.no-rounded {
    border: none;
  }

  .modern-panel.blue {
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(0, 122, 255, 0.15);
  }

  .modern-panel.blue.no-rounded {
    border: none;
  }

  .modern-panel.main {
    @apply backdrop-blur-2xl;
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 24px 48px -12px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .modern-panel.secondary {
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0);
    box-shadow: 
      0 16px 32px -8px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .panel {
    position: relative;
    backdrop-filter: blur(20px);
    transition: all 0.3s ease;
    padding: 16px;
  }

  .panel:not(.no-rounded) {
    border: 1px solid rgba(255, 255, 255, 0.07);
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
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 50%,
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 16px;
    background: radial-gradient(
      circle at 50% 0%,
      rgba(255, 255, 255, 0.03) 0%,
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
    width: 6px;
    height: 6px;
  }

  :global(.modern-panel *::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  :global(.modern-panel *::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  :global(.modern-panel *::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Glass panel styling */
  .modern-panel.glass-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
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
