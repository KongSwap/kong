<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let variant: 'blue' | 'green' | 'yellow' = 'blue';
  export let size: 'small' | 'medium' | 'big' = 'big';
  export let state: 'default' | 'pressed' | 'selected' = 'default';
  export let text: string = '';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;

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
    return `pxcomponents/${prefix}-${variant}-${state}-${middlePart}.svg`;
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

  function handleClick() {
    if (!disabled) {
      onClick();
    }
  }

  $: buttonClass = `pixel-button ${size} ${variant} ${state} ${disabled ? 'disabled' : ''}`;
</script>

<button
  class={buttonClass}
  on:click={handleClick}
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  {disabled}
  style="transform: translateY({$translateY}px); filter: brightness({$brightness})"
>
  <div class="button-container">
    <img src={getImagePath('l')} alt="" class="left-part" />
    <div class="middle-part" style="background-image: url({getImagePath('mid')})"></div>
    <img src={getImagePath('r')} alt="" class="right-part" />
    <span class="button-text">
      <slot>{text}</slot>
    </span>
  </div>
</button>

<style>
  .pixel-button {
    position: relative;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    image-rendering: pixelated;
    transform-origin: center;
    min-width: min-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s ease-out, filter 0.1s ease-out;
  }

  .button-container {
    display: flex;
    align-items: stretch;
    height: 100%;
    width: 100%;
    position: relative;
  }

  .left-part,
  .right-part {
    flex-shrink: 0;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }

  .middle-part {
    flex-grow: 1;
    background-repeat: repeat-x;
    background-position: center;
    background-size: auto 100%;
    min-width: 20px;
    pointer-events: none;
  }

  .button-text {
    font-family: theme('fontFamily.alumni');
    font-size: 24px;
    text-transform: uppercase;
    padding: 0 8px;
    user-select: none;
    white-space: nowrap;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    text-align: center;
  }

  .small {
    height: 24px;
    font-size: 8px;
  }

  .medium {
    height: 32px;
    font-size: 10px;
  }

  .big {
    height: 48px;
    font-size: 12px;
  }

  .disabled {
    cursor: not-allowed;
    opacity: 0.5;
    pointer-events: none;
  }

  .blue .button-text {
    color: #fff;
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
  }

  .green .button-text {
    color: #fff;
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
  }

  .yellow .button-text {
    color: #000;
    text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.5);
  }
</style>
