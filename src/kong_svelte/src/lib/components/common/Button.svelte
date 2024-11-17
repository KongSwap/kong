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

  /* Base glass button styles */
  .glass-button {
    @apply relative inline-flex items-center justify-center font-alumni uppercase transition-all duration-200 ease-out border rounded-lg;
    backdrop-filter: blur(8px);
  }

  .glass-button.small {
    @apply px-4 py-1 text-sm;
    height: 32px;
  }

  .glass-button.medium {
    @apply px-5 py-1 text-base;
    height: 40px;
  }

  .glass-button.big {
    @apply px-6 py-1 text-xl;
    height: 48px;
    letter-spacing: 0.05em;
  }

  /* Color variants */
  .glass-button.blue {
    @apply border-blue-500/30;
    background: linear-gradient(
      135deg,
      rgba(30, 58, 138, 0.95),
      rgba(30, 58, 138, 0.9)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3),
                inset 0 0 16px rgba(59, 130, 246, 0.15);
  }

  .glass-button.green {
    @apply border-emerald-500/30;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.95),
      rgba(6, 95, 70, 0.9)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3),
                inset 0 0 16px rgba(52, 211, 153, 0.15);
  }

  .glass-button.yellow {
    @apply border-amber-500/30;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.95),
      rgba(180, 83, 9, 0.9)
    );
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3),
                inset 0 0 16px rgba(245, 158, 11, 0.15);
  }

  /* Button content */
  .button-content {
    @apply flex items-center justify-center gap-2 px-1 font-bold text-white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* Hover state */
  .glass-button:hover:not(:disabled) {
    @apply transform -translate-y-0.5 border-white/20;
    filter: brightness(1.1);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  /* Active state */
  .glass-button:active:not(:disabled) {
    @apply transform translate-y-0.5;
    filter: brightness(0.95);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  /* Disabled state */
  .glass-button:disabled {
    @apply opacity-50 cursor-not-allowed transform-none;
    filter: grayscale(0.5) brightness(0.8);
  }

  /* Focus state */
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

  /* Icon sizes */
  .glass-button.small .button-content :global(svg) {
    @apply w-4 h-4;
  }

  .glass-button.medium .button-content :global(svg) {
    @apply w-5 h-5;
  }

  .glass-button.big .button-content :global(svg) {
    @apply w-6 h-6;
  }
</style>
