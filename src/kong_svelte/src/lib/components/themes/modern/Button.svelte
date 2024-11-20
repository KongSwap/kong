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
    <span class="button-text">{text}</span>
  </div>
  <div class="button-glow"></div>
</button>

<style lang="postcss">
  .glass-button {
    @apply relative rounded-lg border border-white/10 backdrop-blur-lg
           transition-all duration-200 overflow-hidden;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.05)
    );
    height: 48px;
    min-width: 160px;
  }

  .glass-button:focus-visible {
    @apply outline-none ring-2 ring-white/20;
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
    @apply font-medium text-white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .glass-button.small .button-text {
    @apply text-sm;
  }

  .button-glow {
    @apply absolute inset-0 opacity-0;
    transition: opacity 0.2s ease-out;
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%),
      currentColor 0%,
      transparent 70%
    );
    opacity: calc(0.15 * var(--progress));
  }

  /* Variant styles */
  .glass-button.blue {
    @apply border-blue-500/20;
    background: linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.2),
      rgba(37, 99, 235, 0.1)
    );
    color: rgb(59, 130, 246);
  }

  .glass-button.green {
    @apply border-emerald-500/20;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.2),
      rgba(16, 185, 129, 0.1)
    );
    color: rgb(16, 185, 129);
  }

  .glass-button.yellow {
    @apply border-amber-500/20;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.2),
      rgba(245, 158, 11, 0.1)
    );
    color: rgb(245, 158, 11);
  }

  /* State styles */
  .glass-button.disabled {
    @apply cursor-not-allowed opacity-50;
  }

  .glass-button.pressed:not(.disabled) {
    transform: translateY(1px);
    @apply border-opacity-30 shadow-inner;
  }

  .glass-button.selected:not(.disabled) {
    @apply border-opacity-30;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.1)
    );
  }

  /* Hover effects */
  @media (hover: hover) {
    .glass-button:not(.disabled):hover {
      @apply border-opacity-30;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.15),
        rgba(255, 255, 255, 0.1)
      );
    }

    .glass-button:not(.disabled):hover:active {
      @apply border-opacity-40;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.1),
        rgba(255, 255, 255, 0.05)
      );
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
