<!-- Panel.svelte -->
<script lang="ts">
    export let variant: 'green' | 'yellow' | 'red' = 'green';
    export let type: 'main' | 'second' | 's' = 'main';
    export let width: number | string | 'auto' = 300; // Allow string values like '100%' or 'auto'
    export let height: number | string | 'auto' = 200; // Allow string values like '100vh' or 'auto'
    export let content: string = '';
    export let className: string = ''; // Allow custom classes
  
    function getImagePath(part: string): string {
      if (type === 's') {
        if (['ml', 'mr', 'center'].includes(part)) {
          return `/pxcomponents/panel-${variant}-main-${part}.svg`;
        }
        return `/pxcomponents/panel-s-${variant}-${part}.svg`;
      }
      
      return `/pxcomponents/panel-${variant}-${type}-${part}.svg`;
    }
  
    // Format dimension value
    function formatDimension(value: number | string): string {
      if (value === 'auto') return 'auto';
      if (typeof value === 'number') return `${value}px`;
      return value;
    }
  
    $: useMainPanelCenter = type === 's';
    $: formattedWidth = formatDimension(width);
    $: formattedHeight = formatDimension(height);
  </script>
  
  <div 
    class="panel {className}"
    style="width: {formattedWidth}; height: {formattedHeight};"
  >
    <div class="panel-container" class:auto-size={width === 'auto' || height === 'auto'}>
      <!-- Top -->
      <div class="panel-row top">
        <img src={getImagePath('tl')} alt="" class="corner top-left" />
        <div class="edge horizontal top-middle" style="background-image: url({getImagePath('tm')})"></div>
        <img src={getImagePath('tr')} alt="" class="corner top-right" />
      </div>
  
      <!-- Middle -->
      <div class="panel-row middle">
        <div class="edge vertical middle-left" style="background-image: url({getImagePath('ml')})"></div>
        <div 
          class="center-content" 
          style="background-image: url({getImagePath('center')})"
          class:main-panel-center={useMainPanelCenter}
        >
          <slot>{content}</slot>
        </div>
        <div class="edge vertical middle-right" style="background-image: url({getImagePath('mr')})"></div>
      </div>
  
      <!-- Bottom -->
      <div class="panel-row bottom">
        <img src={getImagePath('bl')} alt="" class="corner bottom-left" />
        <div class="edge horizontal bottom-middle" style="background-image: url({getImagePath('bm')})"></div>
        <img src={getImagePath('br')} alt="" class="corner bottom-right" />
      </div>
    </div>
  </div>
  
  <style>
    .panel {
      position: relative;
      image-rendering: pixelated;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      max-width: 100vw;
      max-height: 100vh;
    }
  
    .panel-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .panel-container.auto-size {
      width: fit-content;
      height: fit-content;
    }
  
    .panel-row {
      display: flex;
      align-items: stretch;
      min-height: 0;
    }
  
    .panel-row.middle {
      flex: 1;
      min-height: 0;
    }
  
    .corner {
      width: 56px;
      height: 32px;
      flex-shrink: 0;
      display: block;
    }
  
    .edge.horizontal {
      height: 32px;
      flex: 1;
      background-repeat: repeat-x;
      background-position: center;
      background-size: auto 100%;
    }
  
    .edge.vertical {
      width: 32px;
      flex-shrink: 0;
      background-repeat: repeat-y;
      background-position: center;
      background-size: 100% auto;
    }
  
    .center-content {
      flex: 1;
      background-repeat: repeat;
      background-size: auto;
      color: white;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      min-height: 0;
    }
  
    @media (max-width: 768px) {
      .corner {
        width: 48px;
        height: 24px;
      }
  
      .edge.horizontal {
        height: 24px;
      }
  
      .edge.vertical {
        width: 24px;
      }

      .center-content {
        padding: 12px;
      }
    }
  </style>
