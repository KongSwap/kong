<!-- Panel.svelte -->
<script lang="ts">
    import { browser } from "$app/environment";
    import { assetCache } from "$lib/services/assetCache";
    import { onMount } from "svelte";

  export let variant: "green" | "yellow" = "green";
  export let type: "main" | "secondary" = "main";
  export let width: string = "auto";
  export let height: string = "auto"; 
  export let content: string = '';
  export let className: string = ''; // Allow custom classes
  export let zIndex: number = 1000;

  // State for cached URLs
  let cachedUrls: Record<string, string> = {};

  // Precompute all image paths based on variant and type
  const imageParts = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];
  let imagePaths: Record<string, string> = {};

  $: {
      const prefix = type === 'secondary' ? `panel-s-${variant}` : `panel-${variant}-${type}`;
      imagePaths = {
          tl: `/pxcomponents/${prefix}-tl.svg`,
          tm: `/pxcomponents/${prefix}-tm.svg`,
          tr: `/pxcomponents/${prefix}-tr.svg`,
          // For secondary panels, use empty strings for middle parts since they don't exist
          ml: type === 'secondary' ? '' : `/pxcomponents/panel-${variant}-main-ml.svg`,
          mr: type === 'secondary' ? '' : `/pxcomponents/panel-${variant}-main-mr.svg`,
          bl: `/pxcomponents/${prefix}-bl.svg`,
          bm: `/pxcomponents/${prefix}-bm.svg`,
          br: `/pxcomponents/${prefix}-br.svg`
      };
      updateCachedUrls();
  }

  async function updateCachedUrls() {
    try {
      const promises = Object.entries(imagePaths).map(async ([part, path]) => {
        const url = await assetCache.getAsset(path);
        return [part, url];
      });
      
      const results = await Promise.all(promises);
      cachedUrls = Object.fromEntries(results);
    } catch (error) {
      console.error('Error updating cached URLs:', error);
    }
  }

  // Format dimension value
  function formatDimension(value: number | string): string {
      return value === 'auto' ? 'auto' : typeof value === 'number' ? `${value}px` : value;
  }

  $: formattedWidth = formatDimension(width);
  $: formattedHeight = formatDimension(height);
  $: isAutoSize = width === 'auto' || height === 'auto';
  $: useMainPanelCenter = type === 'secondary';
  $: if(browser) {
     // set z-index of the panel
     document.getElementById('panel')?.style.setProperty('z-index', zIndex.toString());
  }

  onMount(() => {
    updateCachedUrls();
  });
</script>

<div 
  class="panel {variant} {type} {className}"
  style="width: {formattedWidth}; height: {formattedHeight};"
>
  <div class="panel-container min-w-full" class:auto-size={isAutoSize}>
      <!-- Top -->
      <div class="panel-row top">
          <img src={cachedUrls.tl} alt="" class="corner top-left" loading="eager" decoding="sync" />
          <div class="edge horizontal top-middle" style="background-image: url({cachedUrls.tm}); image-rendering: pixelated;"></div>
          <img src={cachedUrls.tr} alt="" class="corner top-right" loading="eager" decoding="sync" />
      </div>

      <!-- Middle -->
      <div class="panel-row middle">
          <div class="edge vertical middle-left" style="background-image: url({cachedUrls.ml}); image-rendering: pixelated;"></div>
          <div class="center-content bg-[#64AD3B] {useMainPanelCenter ? 'main-panel-center' : ''}" style="margin: -10px;">
              <slot>{content}</slot>
          </div>
          <div class="edge vertical middle-right" style="background-image: url({cachedUrls.mr}); image-rendering: pixelated;"></div>
      </div>

      <!-- Bottom -->
      <div class="panel-row bottom">
          <img src={cachedUrls.bl} alt="" class="corner bottom-left" loading="eager" decoding="sync" />
          <div class="edge horizontal bottom-middle" style="background-image: url({cachedUrls.bm}); image-rendering: pixelated;"></div>
          <img src={cachedUrls.br} alt="" class="corner bottom-right" loading="eager" decoding="sync" />
      </div>  
  </div>
</div>

<style lang="postcss">
  .panel {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    height: auto;
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
    color: white;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    min-height: 0;
    overflow: visible;
    padding-bottom: 10px;
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
  }

  .panel.main {
    min-width: min-content;
    width: 100%;
  }
</style>
