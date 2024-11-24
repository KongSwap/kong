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
    background: rgba(17, 24, 39, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.05);
    height: 48px;
    min-width: 160px;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Force white text for all child elements */
  .glass-button :global(*) {
    color: inherit;
  }

  .glass-button:focus-visible {
    @apply outline-none ring-2 ring-white ring-opacity-20;
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
  }

  .glass-button.small .button-text {
    @apply text-sm;
  }

  .button-glow {
    @apply absolute inset-0 opacity-0;
    transition: opacity 0.2s ease-out;
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%),
      rgba(255, 255, 255, 0.2) 0%,
      transparent 70%
    );
    opacity: calc(var(--progress));
  }

  /* Variant styles */
  .glass-button.blue {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  .glass-button.green {
    background: rgba(74, 222, 128, 0.08);
    border-color: rgba(74, 222, 128, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  .glass-button.yellow {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  /* State styles */
  .glass-button.disabled {
    @apply cursor-not-allowed;
    opacity: 0.4;
    background: rgba(17, 24, 39, 0.05);
    border-color: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.4);
  }

  .glass-button.pressed:not(.disabled) {
    transform: translateY(1px);
  }

  .glass-button.selected:not(.disabled) {
    background: rgba(31, 41, 55, 0.4);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .glass-button.blue.selected:not(.disabled) {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
    color: white;
  }

  .glass-button.yellow.selected:not(.disabled) {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.5);
    color: white;
  }

  /* Hover effects */
  @media (hover: hover) {
    .glass-button:not(.disabled):hover {
      background: rgba(31, 41, 55, 0.2);
      border-color: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .glass-button.blue:not(.disabled):hover {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
      color: white;
    }

    .glass-button.yellow:not(.disabled):hover {
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.3);
      color: white;
    }

    .glass-button:not(.disabled):hover:active {
      background: rgba(31, 41, 55, 0.3);
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
