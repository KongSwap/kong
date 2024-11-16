<!-- Panel.svelte -->
<script lang="ts">
    import { browser } from "$app/environment";
    import { themeStore } from '$lib/stores/themeStore';

  export let variant: "green" | "yellow" | "blue" = "green";
  export let type: "main" | "secondary" = "main";
  export let width: string = "auto";
  export let height: string = "auto"; 
  export let content: string = '';
  export let className: string = ''; // Allow custom classes
  export let zIndex: number = 1000;

  // Precompute all image paths based on variant and type
  const imageParts = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];
  let imagePaths: Record<string, string> = {};

  $: {
      const prefix = type === 's' ? `panel-s-${variant}` : `panel-${variant}-${type}`;
      imagePaths = {
          tl: `/pxcomponents/${prefix}-tl.svg`,
          tm: `/pxcomponents/${prefix}-tm.svg`,
          tr: `/pxcomponents/${prefix}-tr.svg`,
          ml: type === 's' && ['ml', 'mr', 'center'].includes('ml') ? `/pxcomponents/panel-${variant}-main-ml.svg` : `/pxcomponents/${prefix}-ml.svg`,
          mr: type === 's' && ['ml', 'mr', 'center'].includes('mr') ? `/pxcomponents/panel-${variant}-main-mr.svg` : `/pxcomponents/${prefix}-mr.svg`,
          bl: `/pxcomponents/${prefix}-bl.svg`,
          bm: `/pxcomponents/${prefix}-bm.svg`,
          br: `/pxcomponents/${prefix}-br.svg`
      };
  }

  // Format dimension value
  function formatDimension(value: number | string): string {
      return value === 'auto' ? 'auto' : typeof value === 'number' ? `${value}px` : value;
  }

  $: formattedWidth = formatDimension(width);
  $: formattedHeight = formatDimension(height);
  $: isAutoSize = width === 'auto' || height === 'auto';
  $: useMainPanelCenter = type === 's';
  $: if(browser) {
     // set z-index of the panel
     document.getElementById('panel')?.style.setProperty('z-index', zIndex.toString());
  }
</script>

{#if $themeStore === 'pixel'}
  <div 
    class="panel {variant} {type} {className}"
    style="width: {formattedWidth}; height: {formattedHeight};"
  >
    <div class="panel-container min-w-full" class:auto-size={isAutoSize}>
        <!-- Top -->
        <div class="panel-row top">
            <img src={imagePaths.tl} alt="" class="corner top-left" />
            <div class="edge horizontal top-middle" style="background-image: url({imagePaths.tm})"></div>
            <img src={imagePaths.tr} alt="" class="corner top-right" />
        </div>

        <!-- Middle -->
        <div class="panel-row middle">
            <div class="edge vertical middle-left" style="background-image: url({imagePaths.ml})"></div>
            <div class="center-content bg-[#64AD3B] {useMainPanelCenter ? 'main-panel-center' : ''}" style="margin: -10px;">
                <slot>{content}</slot>
            </div>
            <div class="edge vertical middle-right" style="background-image: url({imagePaths.mr})"></div>
        </div>

        <!-- Bottom -->
        <div class="panel-row bottom">
            <img src={imagePaths.bl} alt="" class="corner bottom-left" />
            <div class="edge horizontal bottom-middle" style="background-image: url({imagePaths.bm})"></div>
            <img src={imagePaths.br} alt="" class="corner bottom-right" />
        </div>  
    </div>
  </div>
{:else}
  <div 
    class="glass-panel {variant} {type} {className}"
    style="width: {formattedWidth}; height: {formattedHeight};"
  >
    <div class="glass-content" style="margin: -10px;">
      <slot>{content}</slot>
    </div>
    <div class="panel-light"></div>
  </div>
{/if}

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

  .glass-panel {
    @apply rounded-xl backdrop-blur-lg border border-white/10 shadow-lg 
           relative overflow-hidden;
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.92),
      rgba(0, 0, 0, 0.85)
    );
    min-height: 0;
    transition: all 0.2s ease-out;
    isolation: isolate;
  }

  .glass-panel:hover {
    transform: translateY(-1px);
  }

  .glass-panel.green {
    @apply border-emerald-500/30;
    background: linear-gradient(
      135deg,
      rgba(6, 78, 59, 0.97),
      rgba(6, 78, 59, 0.92)
    );
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(16, 185, 129, 0.1);
  }

  .glass-panel.blue {
    @apply border-blue-500/30;
    background: linear-gradient(
      135deg,
      rgba(30, 58, 138, 0.97),
      rgba(30, 58, 138, 0.92)
    );
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(59, 130, 246, 0.1);
  }

  .glass-panel.yellow {
    @apply border-yellow-500/30;
    background: linear-gradient(
      135deg,
      rgba(120, 53, 15, 0.97),
      rgba(120, 53, 15, 0.92)
    );
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(234, 179, 8, 0.1);
  }

  .glass-panel.main {
    @apply border-opacity-40;
  }

  .glass-panel.secondary {
    @apply border-opacity-20;
  }

  .glass-content {
    @apply p-6 relative h-full overflow-y-auto;
    mask-image: linear-gradient(to bottom, 
      transparent 0%,
      black 5%,
      black 95%,
      transparent 100%
    );
  }

  .glass-content::before {
    content: '';
    @apply absolute inset-0 rounded-lg pointer-events-none;
    background: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0) 100%
    );
    z-index: 1;
  }

  .glass-content::after {
    content: '';
    @apply absolute inset-0 pointer-events-none;
    background: 
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 70%),
      radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.08), transparent 70%);
    z-index: 2;
  }

  /* Scrollbar styling */
  .glass-content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .glass-content::-webkit-scrollbar-track {
    @apply bg-black/20 rounded-full;
  }

  .glass-content::-webkit-scrollbar-thumb {
    @apply bg-white/10 rounded-full;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .glass-content::-webkit-scrollbar-thumb:hover {
    @apply bg-white/20;
  }

  /* Corner accents */
  .glass-panel::before,
  .glass-panel::after {
    content: '';
    @apply absolute w-24 h-24 opacity-20;
    background: radial-gradient(circle, currentColor 0%, transparent 70%);
    z-index: 0;
  }

  .glass-panel::before {
    @apply -top-12 -left-12;
  }

  .glass-panel::after {
    @apply -bottom-12 -right-12;
  }

  /* Color-specific text styles */
  .glass-panel.green :global(*) {
    @apply text-emerald-50;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .glass-panel.blue :global(*) {
    @apply text-blue-50;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .glass-panel.yellow :global(*) {
    @apply text-yellow-50;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* Panel light effect */
  .panel-light {
    @apply absolute inset-0 pointer-events-none opacity-50;
    background: 
      radial-gradient(
        circle at 0% 0%,
        rgba(255, 255, 255, 0.1) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 100% 100%,
        rgba(255, 255, 255, 0.05) 0%,
        transparent 50%
      );
    filter: blur(20px);
    mix-blend-mode: overlay;
  }

  .glass-panel.green .panel-light {
    background: radial-gradient(
      circle at 0% 0%,
      rgba(16, 185, 129, 0.15) 0%,
      transparent 50%
    );
  }

  .glass-panel.blue .panel-light {
    background: radial-gradient(
      circle at 0% 0%,
      rgba(59, 130, 246, 0.15) 0%,
      transparent 50%
    );
  }

  .glass-panel.yellow .panel-light {
    background: radial-gradient(
      circle at 0% 0%,
      rgba(234, 179, 8, 0.15) 0%,
      transparent 50%
    );
  }
</style>
