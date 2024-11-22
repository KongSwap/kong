<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { tooltip } from '$lib/actions/tooltip';

  export let variant: 'blue' | 'green' | 'yellow' = 'blue';
  export let size: 'small' | 'medium' | 'big' = 'big';
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
  on:click={handleClick}
  on:mousedown={handleMouseDown}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  {disabled}
  style="--progress: {$progress}; width: {width === 'auto' ? 'auto' : typeof width === 'number' ? width + 'px' : width};"
  use:tooltip={{
    text: tooltipText,
    position: 'top'
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
  .glass-button {
    @apply relative rounded-lg transition-all duration-200 overflow-hidden;
    background: #111827;
    border: 1px solid #4ade80;
    height: 48px;
    min-width: 160px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    color: white;
  }

  /* Force white text for all child elements */
  .glass-button :global(*) {
    color: white;
  }

  .glass-button:focus-visible {
    @apply outline-none;
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
  }

  .glass-button.small {
    height: 32px;
    min-width: 120px;
  }

  .glass-button.medium {
    height: 40px;
    min-width: 140px;
  }

  .button-content {
    @apply absolute inset-0 flex items-center justify-center;
    z-index: 1;
  }

  .button-text {
    @apply font-medium;
    color: white;
  }

  .glass-button.small .button-text {
    @apply text-sm;
  }

  .button-glow {
    @apply absolute inset-0 opacity-0;
    transition: opacity 0.2s ease-out;
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%),
      rgba(74, 222, 128, 0.15) 0%,
      transparent 70%
    );
    opacity: calc(0.8 * var(--progress));
  }

  /* Variant styles */
  .glass-button.blue {
    border-color: #3B82F6;
  }

  .glass-button.green {
    border-color: #4ade80;
  }

  .glass-button.yellow {
    border-color: #F59E0B;
  }

  /* State styles */
  .glass-button.disabled {
    @apply cursor-not-allowed opacity-50;
    border-color: #374151;
  }

  .glass-button.pressed:not(.disabled) {
    transform: translateY(1px);
  }

  .glass-button.selected:not(.disabled) {
    background: #1f2937;
    border-color: #86efac;
    box-shadow: 
      0 4px 20px rgba(134, 239, 172, 0.15),
      0 0 0 1px rgba(134, 239, 172, 0.3),
      inset 0 0 20px rgba(134, 239, 172, 0.1);
  }

  /* Hover effects */
  @media (hover: hover) {
    .glass-button:not(.disabled):hover {
      background: #1a2438;
      border-color: #86efac;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3),
                  0 0 0 1px rgba(134, 239, 172, 0.2);
    }

    .glass-button.blue:not(.disabled):hover {
      border-color: #60A5FA;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3),
                  0 0 0 1px rgba(96, 165, 250, 0.2);
    }

    .glass-button.yellow:not(.disabled):hover {
      border-color: #FBBF24;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3),
                  0 0 0 1px rgba(251, 191, 36, 0.2);
    }

    .glass-button:not(.disabled):hover:active {
      background: #1f2937;
    }
  }

  /* Responsive styles */
  @media (max-width: 768px) {
    .glass-button {
      height: 40px;
      min-width: 140px;
    }

    .glass-button.small {
      height: 28px;
      min-width: 100px;
    }

    .glass-button.medium {
      height: 36px;
      min-width: 120px;
    }
  }
</style>
