<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { tooltip } from '$lib/actions/tooltip';
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

<style scoped lang="postcss">
  .pixel-button {
    filter: grayscale(100%) opacity(50%);
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
</style>
