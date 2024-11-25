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
  class="panel {variant} {type} {className} {roundedBorders ? '' : 'no-rounded'}"
  style="width: {formattedWidth}; height: {formattedHeight};"
>
  <div class="panel-container min-w-full" class:auto-size={isAutoSize}>
      <div class="panel-content">
          <slot>{content}</slot>
      </div>
  </div>
</div>

<style lang="postcss">
.panel {
  @apply relative overflow-hidden;
  background: #1a1b23;
  border: 1px solid #2a2d3d;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  color: white;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel:not(.no-rounded) {
  border-radius: 12px;
}

.panel.no-rounded {
  border: none;
  border-radius: 0;
}

/* Variant styles */
.panel.green {
  border-color: rgba(32, 201, 151, 0.15);
}

.panel.yellow {
  border-color: rgba(255, 207, 0, 0.15);
}

.panel.blue {
  border-color: rgba(0, 122, 255, 0.15);
}

/* Type styles */
.panel.main {
  background: #1a1b23;
  border-color: #2a2d3d;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1);
}

.panel.secondary {
  background: #15161c;
  border-color: rgba(42, 45, 61, 0.3);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.08);
}

.panel-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 1.25rem;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #2a2d3d transparent;
}

/* Scrollbar styles */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: #15161c;
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background-color: #2a2d3d;
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background-color: #3a3e52;
}

@media (max-width: 768px) {
  .panel-container {
    padding: 1rem;
  }
}
</style>
