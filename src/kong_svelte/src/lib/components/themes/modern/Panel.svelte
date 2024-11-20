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
    class="glass-panel {variant} {type} {className}"
    style="width: {formattedWidth}; height: {formattedHeight};"
>
    <div class="glass-container min-w-full" class:auto-size={isAutoSize}>
        <div class="glass-content">
            <slot>{content}</slot>
        </div>
        <div class="panel-light"></div>
    </div>
</div>

<style lang="postcss">
  .glass-panel {
    @apply rounded-xl backdrop-blur-lg border border-white/10 shadow-lg 
           relative overflow-hidden;
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.92),
      rgba(0, 0, 0, 0.85)
    );
    transition: all 0.2s ease-out;
    isolation: isolate;
    position: relative;
  }

  .glass-panel.green {
    @apply border-emerald-500/20;
    background: linear-gradient(
      135deg,
      rgba(4, 120, 87, 0.97),
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
    @apply border-amber-500/30;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.97),
      rgba(194, 65, 12, 0.92)
    );
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(251, 191, 36, 0.15);
  }

  .glass-panel.main {
    min-width: min-content;
    width: 100%;
    @apply border-opacity-40;
  }

  .glass-panel.secondary {
    @apply border-opacity-20;
  }

  .glass-content {
    @apply relative h-full overflow-y-auto;
    padding: 1rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    @apply text-amber-50;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
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
      rgba(251, 191, 36, 0.2) 0%,
      transparent 50%
    );
  }

  /* Add glass container styles to match pixel panel container */
  .glass-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .glass-container.auto-size {
    width: fit-content;
    height: fit-content;
  }
</style>
