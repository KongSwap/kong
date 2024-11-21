<script lang="ts">
    import { browser } from "$app/environment";

    export let variant: "green" | "yellow" | "blue" = "green";
    export let type: "main" | "secondary" = "main";
    export let width: string = "auto";
    export let height: string = "auto"; 
    export let content: string = '';
    export let className: string = '';
    export let zIndex: number = 10;

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
    class="panel modern-panel {variant} {type} {className}"
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
  }

  .modern-panel.green {
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(32, 201, 151, 0.15);
    box-shadow: 
      0 24px 48px -12px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(32, 201, 151, 0.08);
  }

  .modern-panel.blue {
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(59, 130, 246, 0.15);
    box-shadow: 
      0 24px 48px -12px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(59, 130, 246, 0.08);
  }

  .modern-panel.yellow {
    background: linear-gradient(180deg, rgba(20, 22, 36, 0.98) 0%, rgba(14, 16, 26, 0.98) 100%);
    border: 1px solid rgba(250, 204, 21, 0.15);
    box-shadow: 
      0 24px 48px -12px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(250, 204, 21, 0.08);
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
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 16px 32px -8px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .panel {
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 16px;
    position: relative;
    backdrop-filter: blur(20px);
    transition: all 0.3s ease;

  }

  /* Premium edge highlight */
  .panel::before {
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

  /* Hover effect */
  .panel:hover {
    transform: translateY(-1px);
    box-shadow: 
      0 6px 28px -1px rgba(0, 0, 0, 0.35),
      0 0 1px 0 rgba(255, 255, 255, 0.09);
  }

  .panel:hover::before {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 100%
    );
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
    min-height: 100px;
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
</style>
