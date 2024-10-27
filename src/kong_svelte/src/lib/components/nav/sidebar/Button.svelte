<script lang="ts">
  import { spring } from 'svelte/motion';
  import { fly } from 'svelte/transition';

  export let variant: "primary" | "secondary" | "danger" = "primary";
  export let size: "small" | "medium" | "large" = "medium";
  export let disabled: boolean = false;
  export let onClick: () => void = () => {};
  export let text: string;
  export let active: boolean = false;

  let isPressed = false;
  let buttonScale = spring(1, {
    stiffness: 0.3,
    damping: 0.4
  });

  function handleMousedown() {
    if (!disabled) {
      isPressed = true;
      buttonScale.set(0.95);
    }
  }

  function handleMouseup() {
    if (!disabled) {
      isPressed = false;
      buttonScale.set(1);
    }
  }

  function handleClick() {
    if (!disabled) {
      onClick();
    }
  }
</script>

<div class="pixel-corners--wrapper" 
  style="transform: scale({$buttonScale})"
  on:mousedown={handleMousedown}
  on:mouseup={handleMouseup}
  on:mouseleave={handleMouseup}
>
  <button
    class={`pixel-corners ${variant} ${size} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${active ? "active" : ""} ${isPressed ? "pressed" : ""}`}
    on:click={handleClick}
    {disabled}
  >
    <span class="button-text" class:text-pressed={isPressed}>
      {text}
    </span>
    {#if isPressed}
      <div class="press-effect" 
        in:fly="{{ y: -2, duration: 150 }}"
        out:fly="{{ y: 2, duration: 100 }}"
      ></div>
    {/if}
  </button>
</div>

<style scoped lang="postcss">
  .primary {
    --button-bg: #61c9ff;
    --button-shadow: #0077cc;
    --button-highlight: #99ddff;
    --button-border: #0099ff;
    --button-press-shadow: #005999;
    @apply uppercase hover:text-white font-extrabold;
  }

  .secondary {
    --button-bg: #ffcc00;
    --button-shadow: #cc9900;
    --button-highlight: #ffe066;
    --button-border: #ffdb4d;
    --button-press-shadow: #997300;
    @apply uppercase hover:text-white font-extrabold;
  }

  .danger {
    --button-bg: #ff4d4d;
    --button-shadow: #cc0000;
    --button-highlight: #ff8080;
    --button-border: #ff1a1a;
    --button-press-shadow: #990000;
    @apply uppercase hover:text-white font-extrabold;
  }

  .active {
    --button-bg: #00a1fa;
    --button-shadow: #0077cc;
    --button-highlight: #66c7ff;
    --button-border: #0099ff;
    --button-press-shadow: #005999;
    @apply text-white;
  }

  .small {
    @apply text-sm;
    padding: 4px 8px;
  }

  .medium {
    @apply text-base;
    padding: 8px 16px;
  }

  .large {
    @apply text-lg;
    padding: 12px 24px;
  }

  .pixel-corners--wrapper {
    display: inline-block;
    transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  button {
    position: relative;
    border: var(--pixel-size) solid var(--button-border);
    background: var(--button-bg);
    image-rendering: pixelated;
    box-shadow: 
      inset -4px -4px 0px var(--button-shadow),
      inset 4px 4px 0px var(--button-highlight),
      4px 4px 0px rgba(0, 0, 0, 0.2);
    transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    min-width: 120px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0;
    clip-path: polygon(
      0 4px, 4px 4px, 4px 0,
      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%,
      4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px)
    );
  }

  button:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 
      inset -4px -4px 0px var(--button-shadow),
      inset 4px 4px 0px var(--button-highlight),
      6px 6px 0px rgba(0, 0, 0, 0.2);
  }

  button.pressed {
    transform: translate(2px, 2px);
    box-shadow: 
      inset -2px -2px 0px var(--button-press-shadow),
      inset 2px 2px 0px var(--button-highlight),
      2px 2px 0px rgba(0, 0, 0, 0.1);
    transition-duration: 0.05s;
  }

  .button-text {
    position: relative;
    z-index: 1;
    transition: transform 0.1s ease;
  }

  .text-pressed {
    transform: translate(1px, 1px);
  }

  .press-effect {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.1) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.05) 100%
    );
    pointer-events: none;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  button:disabled:hover {
    transform: none;
    box-shadow: 
      inset -4px -4px 0px var(--button-shadow),
      inset 4px 4px 0px var(--button-highlight),
      4px 4px 0px rgba(0, 0, 0, 0.2);
  }
</style>
