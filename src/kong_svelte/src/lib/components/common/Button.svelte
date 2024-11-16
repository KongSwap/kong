<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { tooltip } from '$lib/actions/tooltip';
  import { themeStore } from '$lib/stores/themeStore';

  export let variant: 'blue' | 'green' | 'yellow' = 'blue';
  export let size: 'small' | 'medium' | 'big' = 'big';
  export let state: 'default' | 'disabled' | 'pressed' | 'selected' = 'default';
  export let text: string = '';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;
  export let className: string = '';
  export let width: number | string | 'auto' = 'auto';
  export let tooltipText: string | null = null;

  $: {
    if (size === 'small' && variant === 'blue') {
      size = 'medium';
      console.warn('Small size is not available for blue buttons, falling back to medium');
    }
  }

  const prefixMap = {
    small: 'btnsmall',
    medium: 'btn',
    big: 'bigbtn'
  };

  const middlePartMap = {
    small: 'mid',
    medium: 'mid',
    big: 'mid'
  };

  function getImagePath(part: string): string {
    const prefix = prefixMap[size];
    const middlePart = part === 'middle' ? middlePartMap[size] : part;
    return `/pxcomponents/${prefix}-${variant}-${state}-${middlePart}.svg`;
  }

  function formatDimension(value: number | string): string {
    if (value === 'auto') return 'auto';
    if (typeof value === 'number') return `${value}px`;
    return value;
  }

  let isPressed = false;
  let isHovered = false;
  
  const brightness = tweened(1, {
    duration: 100,
    easing: cubicOut
  });

  const translateY = tweened(0, {
    duration: 100,
    easing: cubicOut
  });

  $: {
    if (state === 'selected') {
      brightness.set(0.9);
    } else if (state === 'pressed') {
      brightness.set(0.95);
      translateY.set(2);
    } else {
      brightness.set(isHovered ? 1.05 : 1);
      translateY.set(0);
    }
  }
  
  function handleMouseDown() {
    if (!disabled) {
      isPressed = true;
      translateY.set(2);
    }
  }
  
  function handleMouseUp() {
    if (!disabled) {
      isPressed = false;
      translateY.set(0);
    }
  }

  function handleMouseEnter() {
    if (!disabled) {
      isHovered = true;
    }
  }

  function handleMouseLeave() {
    if (!disabled) {
      isHovered = false;
      handleMouseUp();
    }
  }

  function handleClick(event: MouseEvent) {
    if (disabled) {
      event.preventDefault(); // Prevent default action if disabled
      return;
    }
    onClick();
  }

  $: buttonClass = `pixel-button ${size} ${variant} ${state} ${disabled ? 'disabled' : ''} ${className}`;
  $: formattedWidth = formatDimension(width);
</script>

{#if $themeStore === 'pixel'}
  <a
    use:tooltip={{ text: tooltipText !== null ? tooltipText : null }}
    class={buttonClass}
    on:click={handleClick}
    on:mousedown={handleMouseDown}
    on:mouseup={handleMouseUp}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    data-sveltekit-preload-code="eager"
    style="transform: translateY({$translateY}px); filter: brightness({$brightness}); width: {formattedWidth};"
    aria-disabled={disabled}
  >
    <div class="button-container" class:auto-size={width === 'auto'}>
      <img src={getImagePath('l')} alt="" class="left-part" />
      <div class="middle-part" style="background-image: url({getImagePath('mid')})"></div>
      <img src={getImagePath('r')} alt="" class="right-part" />
      <span class="button-text {state === 'selected' ? 'text-white font-semibold' : ''}">
        <slot>{text}</slot>
      </span>
    </div>
  </a>
{:else}
  <button
    class="glass-button {variant} {size} {className}"
    on:click={handleClick}
    disabled={disabled}
    style="width: {formattedWidth};"
    use:tooltip={{ text: tooltipText !== null ? tooltipText : null }}
  >
    <span class="button-content">
      <slot>{text}</slot>
    </span>
  </button>
{/if}

<style lang="postcss">
  .pixel-button {
    @apply relative border-none bg-none p-0 cursor-pointer inline-flex items-center justify-center transition-transform duration-100 ease-out min-w-fit;
  }

  .image-rendering-pixelated {
    image-rendering: pixelated;
  }

  .button-container {
    @apply flex items-stretch w-full relative;
  }

  .button-container.auto-size {
    @apply w-fit;
  }

  .left-part,
  .right-part {
    @apply flex-shrink-0 object-contain pointer-events-none image-rendering-pixelated;
  }

  .middle-part {
    @apply flex-1 bg-repeat-x bg-center bg-auto pointer-events-none min-w-[24px];
  }

  .button-text {
    @apply font-alumni text-2xl uppercase px-3.5 select-none whitespace-nowrap absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center w-auto min-w-max;
  }

  .small {
    @apply h-6 text-xs;
  }

  .medium {
    @apply h-8 text-sm;
  }

  .big {
    @apply h-12 text-base;
  }

  .disabled {
    @apply cursor-not-allowed opacity-50 pointer-events-none;
  }

  .blue {
    @apply text-black;
  }

  .yellow {
    @apply text-black;
  }

  .blue:hover {
    @apply text-white font-semibold;
  }

  .green .button-text {
    @apply text-white;
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
  }

  .yellow .button-text {
    @apply text-black;
    text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.5);
  }

  .glass-button {
    @apply rounded-lg font-medium transition-all duration-200
           backdrop-blur-lg border border-white/10 shadow-lg relative
           flex items-center justify-center cursor-pointer
           overflow-hidden font-alumni uppercase;
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.95),
      rgba(0, 0, 0, 0.85)
    );
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    transform-style: preserve-3d;
    perspective: 1000px;
  }

  .glass-button:hover {
    @apply transform -translate-y-0.5 shadow-xl border-white/20;
    filter: brightness(1.1);
    transform: translateY(-2px);
  }

  .glass-button:active {
    @apply transform shadow-md;
    filter: brightness(0.95);
    transform: translateY(1px);
  }

  .glass-button.blue {
    @apply border-blue-500/30 text-blue-100;
    background: linear-gradient(
      135deg,
      rgba(30, 58, 138, 0.97),
      rgba(30, 58, 138, 0.92)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 0 16px rgba(59, 130, 246, 0.15);
  }

  .glass-button.green {
    @apply border-emerald-500/30 text-emerald-100;
    background: linear-gradient(
      135deg,
      rgba(6, 78, 59, 0.97),
      rgba(6, 78, 59, 0.92)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 0 16px rgba(16, 185, 129, 0.15);
  }

  .glass-button.yellow {
    @apply border-yellow-500/30 text-yellow-100;
    background: linear-gradient(
      135deg,
      rgba(120, 53, 15, 0.97),
      rgba(120, 53, 15, 0.92)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 0 16px rgba(234, 179, 8, 0.15);
  }

  .button-content {
    @apply flex items-center justify-center gap-2 relative font-bold z-10 w-full;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    letter-spacing: 0.05em;
  }

  /* Size variants with better text handling */
  .glass-button.small {
    @apply px-3 py-1;
    height: 24px; /* Match pixel button height */
    font-size: 0.875rem;
    letter-spacing: 0.05em;
  }

  .glass-button.medium {
    @apply px-4 py-1;
    height: 32px; /* Match pixel button height */
    font-size: 1.125rem;
    letter-spacing: 0.05em;
  }

  .glass-button.big {
    @apply px-6 py-1;
    height: 48px; /* Match pixel button height */
    font-size: 1.5rem;
    letter-spacing: 0.05em;
  }

  /* Subtle ambient glow */
  .glass-button::after {
    content: '';
    @apply absolute inset-0 opacity-0 transition-opacity duration-300;
    background: radial-gradient(
      circle at center,
      currentColor 0%,
      transparent 70%
    );
    opacity: 0;
    z-index: 1;
  }

  .glass-button:hover::after {
    opacity: 0.1;
  }

  /* Disabled state */
  .glass-button:disabled {
    @apply opacity-50 cursor-not-allowed transform-none;
    filter: grayscale(0.5) brightness(0.8);
    transform: none !important;
  }

  .glass-button:disabled::after {
    @apply opacity-0;
  }

  /* Color-specific hover effects */
  .glass-button.blue:hover {
    @apply bg-blue-900/90 border-blue-400/40;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
                inset 0 0 24px rgba(59, 130, 246, 0.2);
  }

  .glass-button.green:hover {
    @apply bg-emerald-900/90 border-emerald-400/40;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
                inset 0 0 24px rgba(16, 185, 129, 0.2);
  }

  .glass-button.yellow:hover {
    @apply bg-yellow-900/90 border-yellow-400/40;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
                inset 0 0 24px rgba(234, 179, 8, 0.2);
  }

  /* Active state */
  .glass-button:active::after {
    @apply opacity-20;
  }

  /* Better text truncation for long content */
  .button-content {
    @apply px-1 truncate;
    min-width: 0;
  }

  /* Ensure icons are properly sized */
  .button-content :global(svg) {
    @apply flex-shrink-0;
  }

  .glass-button.small .button-content :global(svg) {
    @apply w-4 h-4;
  }

  .glass-button.medium .button-content :global(svg) {
    @apply w-5 h-5;
  }

  .glass-button.big .button-content :global(svg) {
    @apply w-6 h-6;
  }

  /* Ensure proper alignment with icons */
  .button-content:has(:global(svg)) {
    @apply gap-2;
  }

  /* Better focus state */
  .glass-button:focus-visible {
    @apply outline-none ring-2 ring-offset-2 ring-offset-black/50;
  }

  .glass-button.blue:focus-visible {
    @apply ring-blue-400/50;
  }

  .glass-button.green:focus-visible {
    @apply ring-emerald-400/50;
  }

  .glass-button.yellow:focus-visible {
    @apply ring-yellow-400/50;
  }

  /* Color variants with better text styling */
  .glass-button.blue {
    @apply border-blue-500/30;
    background: linear-gradient(
      135deg,
      rgba(30, 58, 138, 0.97),
      rgba(30, 58, 138, 0.92)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 0 16px rgba(59, 130, 246, 0.15);
  }

  .glass-button.blue .button-content {
    @apply text-white font-bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .glass-button.green {
    @apply border-emerald-500/30;
    background: linear-gradient(
      135deg,
      rgba(6, 78, 59, 0.97),
      rgba(6, 78, 59, 0.92)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 0 16px rgba(16, 185, 129, 0.15);
  }

  .glass-button.green .button-content {
    @apply text-white font-bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .glass-button.yellow {
    @apply border-yellow-500/30;
    background: linear-gradient(
      135deg,
      rgba(120, 53, 15, 0.97),
      rgba(120, 53, 15, 0.92)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 0 16px rgba(234, 179, 8, 0.15);
  }

  .glass-button.yellow .button-content {
    @apply text-white font-bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  /* Hover states */
  .glass-button:hover {
    @apply transform -translate-y-0.5 shadow-xl border-white/20;
    filter: brightness(1.1);
  }

  .glass-button:active {
    @apply transform shadow-md;
    filter: brightness(0.95);
    transform: translateY(1px);
  }

  /* Disabled state */
  .glass-button:disabled {
    @apply opacity-50 cursor-not-allowed transform-none;
    filter: grayscale(0.5) brightness(0.8);
  }

  /* Icon handling */
  .button-content :global(svg) {
    @apply flex-shrink-0;
  }

  .glass-button.small .button-content :global(svg) {
    @apply w-4 h-4;
  }

  .glass-button.medium .button-content :global(svg) {
    @apply w-5 h-5;
  }

  .glass-button.big .button-content :global(svg) {
    @apply w-6 h-6;
  }

  /* Focus state */
  .glass-button:focus-visible {
    @apply outline-none ring-2 ring-offset-2 ring-offset-black/50;
  }

  /* Ensure text is always centered and properly sized */
  .button-content {
    transform: translateY(1px); /* Slight adjustment for better vertical alignment */
  }

  /* Better text truncation for long content */
  .button-content {
    @apply truncate;
    max-width: calc(100% - 1rem);
  }

  /* Ensure proper height for all sizes */
  .glass-button {
    @apply flex items-center justify-center;
    padding-top: 0;
    padding-bottom: 0;
  }
</style>
