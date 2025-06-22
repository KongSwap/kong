<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { tooltip } from '$lib/actions/tooltip';

  export let variant: 'blue' | 'green' | 'yellow' = 'blue';
  export let size: 'small' | 'medium' | 'big' | 'bigger' = 'big';
  export let state: 'default' | 'disabled' | 'pressed' | 'selected' = 'default';
  export let text: string = '';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;
  export let className: string = '';
  export let width: number | string | 'auto' = 'auto';
  export let tooltipText: string | null = null;

  let isPressed = false;
  let isHovered = false;

  const progress = tweened(0, {
    duration: 200,
    easing: cubicOut
  });

  function handleClick() {
    if (!disabled) {
      onClick();
    }
  }

  function handleMouseDown() {
    if (!disabled) {
      isPressed = true;
    }
  }

  function handleMouseUp() {
    isPressed = false;
  }

  function handleMouseEnter() {
    isHovered = true;
    progress.set(1);
  }

  function handleMouseLeave() {
    isHovered = false;
    progress.set(0);
    isPressed = false;
  }
</script>

<button
  class="glass-button {variant} {size} {className}"
  class:disabled
  class:pressed={isPressed}
  class:selected={state === 'selected'}
  onclick={handleClick}
  onmousedown={handleMouseDown}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  {disabled}
  style="--progress: {$progress}; width: {width === 'auto' ? 'auto' : typeof width === 'number' ? width + 'px' : width};"
  use:tooltip={{
    text: tooltipText,
    direction: 'top'
  }}
>
  <div class="button-content">
    <slot>
      <span class="button-text">{text}</span>
    </slot>
  </div>
  <div class="button-glow"></div>
</button>

<style lang="postcss">
  .modern-button {
    @apply relative flex items-center justify-center gap-2 px-4 py-2 
           rounded-xl font-medium transition-all duration-200
           text-kong-text-primary
           disabled:cursor-not-allowed disabled:opacity-50;
  }

  .modern-button.blue {
    @apply bg-kong-primary border border-kong-primary text-white
           hover:bg-kong-primary-hover hover:border-kong-primary-hover
           focus:ring-2 focus:ring-kong-primary/30
           shadow-lg shadow-kong-primary/10;
  }

  .modern-button.green {
    @apply bg-kong-success border border-kong-success text-white
           hover:bg-kong-success-hover hover:border-kong-success-hover
           focus:ring-2 focus:ring-kong-success/30
           shadow-lg shadow-kong-success/10;
  }

  .modern-button.yellow {
    @apply bg-kong-warning border border-kong-warning text-white
           hover:bg-kong-warning hover:border-kong-warning
           focus:ring-2 focus:ring-kong-warning/30
           shadow-lg shadow-kong-warning/10;
  }

  /* Size variants */
  .modern-button.small {
    @apply px-3 py-1.5 text-sm;
  }

  .modern-button.medium {
    @apply px-4 py-2 text-base;
  }

  .modern-button.big {
    @apply px-6 py-3 text-lg;
  }

  /* States */
  .modern-button.disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .modern-button.pressed {
    @apply transform scale-95;
  }

  .modern-button.selected {
    @apply ring-2 ring-kong-primary/30;
  }

  /* Hover effects */
  .modern-button:not(.disabled):hover {
    @apply transform -translate-y-0.5;
  }

  /* Focus styles */
  .modern-button:focus {
    @apply outline-none;
  }
</style>
