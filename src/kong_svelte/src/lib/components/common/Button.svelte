<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { tooltip } from '$lib/actions/tooltip';
  import { themeStore } from '$lib/stores/themeStore';
  import { assetCache } from '$lib/services/assetCache';
  import { onMount } from 'svelte';

  export let variant: 'blue' | 'green' | 'yellow' = 'blue';
  export let size: 'small' | 'medium' | 'big' = 'big';
  export let state: 'default' | 'disabled' | 'pressed' | 'selected' = 'default';
  export let text: string = '';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;
  export let className: string = '';
  export let width: number | string | 'auto' = 'auto';
  export let tooltipText: string | null = null;

  let cachedUrls = {
    left: '',
    middle: '',
    right: ''
  };

  let mounted = false;

  $: {
    if (size === 'small' && variant === 'blue') {
      size = 'medium';
      console.warn('Small size is not available for blue buttons, falling back to medium');
    }
  }

  $: {
    if (disabled && state !== 'disabled') {
      state = 'disabled';
    } else if (!disabled && state === 'disabled') {
      state = 'default';
    }
  }

  $: buttonClass = `${size} ${variant} ${state === 'disabled' ? 'default' : state} ${className} pixel-button`;

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
    return `/pxcomponents/${prefix}-${variant}-${state === 'disabled' ? 'default' : state}-${middlePart}.svg`;
  }

  async function updateCachedUrls() {
    try {
      const [left, middle, right] = await Promise.all([
        assetCache.getAsset(getImagePath('l')),
        assetCache.getAsset(getImagePath('mid')),
        assetCache.getAsset(getImagePath('r'))
      ]);
      cachedUrls = { left, middle, right };
    } catch (error) {
      console.error('Error updating cached URLs:', error);
    }
  }

  onMount(() => {
    mounted = true;
    updateCachedUrls();
  });

  $: if (mounted && (variant || size || state)) {
    updateCachedUrls();
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
    class:disabled={disabled}
  >
    <div class="button-container {state === 'disabled' ? 'grayscale cursor-not-allowed' : 'cursor-pointer'}" class:auto-size={width === 'auto'}>
      <img src={cachedUrls.left} alt="" class="left-part" loading="eager" decoding="sync" />
      <div 
        class="middle-part" 
        style="background-image: url({cachedUrls.middle}); image-rendering: pixelated;"
      ></div>
      <img src={cachedUrls.right} alt="" class="right-part" loading="eager" decoding="sync" />
      <span class="button-text">
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
    filter: grayscale(100%);
    transition: all 0.2s ease-in-out;
  }

  .image-rendering-pixelated {
    image-rendering: pixelated;
  }

  .button-container {
    @apply relative flex items-stretch;
    min-width: max-content;
    margin: 0 0.25rem;
  }

  .button-container.auto-size {
    width: max-content;
  }

  .left-part,
  .right-part {
    @apply flex-shrink-0 object-contain pointer-events-none image-rendering-pixelated;
  }

  .middle-part {
    @apply flex-1 bg-repeat-x bg-center bg-auto pointer-events-none min-w-[24px];
  }

  .button-text {
    @apply absolute inset-0 flex items-center justify-center font-alumni text-2xl uppercase select-none;
    min-width: max-content;
    padding: 0 0.875rem;
  }

  .small {
    @apply h-6;
    font-size: 0.75rem;
  }

  .medium {
    @apply h-8;
    font-size: 0.875rem;
  }

  .big {
    @apply h-12;
    font-size: 1rem;
  }

  .blue {
    @apply text-black;
  }

  .yellow {
    @apply text-black;
  }

  .green .button-text {
    @apply text-white;
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
  }

  .yellow .button-text {
    @apply text-black;
  }

  .yellow.selected .button-text {
    @apply text-white font-bold;
  }

  /* Base glass button styles */
  .glass-button {
    @apply relative inline-flex items-center justify-center font-alumni uppercase transition-all duration-150 ease-out border rounded-lg;
    backdrop-filter: blur(12px);
  }

  .glass-button.small {
    @apply px-4 py-1 text-sm tracking-wide;
    height: 32px;
  }

  .glass-button.medium {
    @apply px-5 py-1 text-base tracking-wide;
    height: 40px;
  }

  .glass-button.big {
    @apply px-6 py-1 text-xl tracking-wide;
    height: 48px;
  }

  /* Color variants */
  .glass-button.blue {
    @apply border-blue-500/30;
    background: linear-gradient(
      165deg,
      rgba(30, 64, 175, 0.98),
      rgba(30, 58, 138, 0.95)
    );
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(59, 130, 246, 0.15);
  }

  .glass-button.green {
    @apply border-emerald-500/30;
    background: linear-gradient(
      165deg,
      rgba(16, 185, 129, 0.98),
      rgba(6, 95, 70, 0.95)
    );
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(52, 211, 153, 0.15);
  }

  .glass-button.yellow {
    @apply border-amber-500/30;
    background: linear-gradient(
      165deg,
      rgba(245, 158, 11, 0.98),
      rgba(180, 83, 9, 0.95)
    );
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
                inset 0 0 32px rgba(245, 158, 11, 0.15);
  }

  /* Button content */
  .button-content {
    @apply flex items-center justify-center gap-2 px-1 font-bold text-white;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
    letter-spacing: 0.03em;
  }

  /* Hover state */
  .glass-button:hover:not(:disabled) {
    @apply border-white/20;
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  /* Active state */
  .glass-button:active:not(:disabled) {
    transform: translateY(0);
    filter: brightness(0.98);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  /* Disabled state */
  .glass-button:disabled {
    @apply opacity-60 cursor-not-allowed;
    filter: grayscale(0.3) brightness(0.9);
    transform: none;
  }

  /* Focus state */
  .glass-button:focus-visible {
    @apply outline-none ring-2 ring-offset-1 ring-offset-black/50;
  }

  .glass-button.blue:focus-visible {
    @apply ring-blue-400/60;
  }

  .glass-button.green:focus-visible {
    @apply ring-emerald-400/60;
  }

  .glass-button.yellow:focus-visible {
    @apply ring-yellow-400/60;
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
