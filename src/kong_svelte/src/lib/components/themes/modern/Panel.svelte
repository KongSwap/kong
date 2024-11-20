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
    class="modern-panel {variant} {type} {className}"
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
    background: #0f172a;
    border: 1px solid rgba(74, 222, 128, 0.3);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease-out;
    color: white;
  }

  .modern-panel.green {
    border-color: rgba(74, 222, 128, 0.3);
  }

  .modern-panel.blue {
    border-color: rgba(59, 130, 246, 0.3);
  }

  .modern-panel.yellow {
    border-color: rgba(245, 158, 11, 0.3);
  }

  .modern-panel.main {
    @apply backdrop-blur-sm;
    background: rgba(15, 23, 42, 0.95);
  }

  .modern-panel.secondary {
    background: rgba(15, 23, 42, 0.8);
  }

  .panel-container {
    @apply relative h-full;
  }

  .panel-content {
    @apply relative p-4 h-full;
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
    background: rgba(15, 23, 42, 0.5);
    border-radius: 3px;
  }

  :global(.modern-panel *::-webkit-scrollbar-thumb) {
    background: rgba(74, 222, 128, 0.3);
    border-radius: 3px;
  }

  :global(.modern-panel *::-webkit-scrollbar-thumb:hover) {
    background: rgba(74, 222, 128, 0.5);
  }
</style>
