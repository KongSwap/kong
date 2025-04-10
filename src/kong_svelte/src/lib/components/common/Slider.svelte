<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let value: number;
  export let min: number = 0;
  export let max: number = 100;
  export let step: number = 1;
  export let color: string = "yellow";
  export let showInput: boolean = false;
  export let inputClass: string = "";

  const dispatch = createEventDispatcher();

  const colorMap = {
    yellow: "rgb(250, 204, 21)",
    green: "rgb(34, 197, 94)",
    blue: "rgb(59, 130, 246)",
    red: "rgb(239, 68, 68)",
    purple: "rgb(168, 85, 247)"
  };

  $: activeColor = colorMap[color] ? colorMap[color] : ((color.startsWith('#') || color.startsWith('rgb') || color.startsWith('var(')) ? color : `var(--${color})`);

  $: style = `--value-percent: ${((value - min) / (max - min)) * 100}%; --active-color: ${colorMap.yellow}; --thumb-color: ${activeColor};`;

  function handleInput(e: Event) {
    const newValue = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(newValue)) {
      value = Math.min(Math.max(newValue, min), max);
      dispatch('input', newValue);
    }
  }

  function handleChange(e: Event) {
    const newValue = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(newValue)) {
      value = Math.min(Math.max(newValue, min), max);
      dispatch('change', value);
    }
  }
</script>

<div class="slider-container">
  <div class="slider-wrapper">
    <input
      type="range"
      class="slider"
      bind:value
      {min}
      {max}
      {step}
      style={style}
      on:input={handleInput}
      on:change={handleChange}
    />
    {#if showInput}
      <input
        type="number"
        {min}
        {max}
        {step}
        bind:value
        on:input={handleInput}
        on:change={handleChange}
        class="slider-input {inputClass}"
      />
    {/if}
  </div>
</div>

<style lang="postcss">
  .slider-container {
    @apply w-full;
  }

  .slider-wrapper {
    @apply flex items-center gap-4;
  }

  .slider {
    @apply w-full h-3 rounded-lg appearance-none cursor-pointer;
    background: rgba(255, 255, 255, 0.1);
  }

  .slider::-webkit-slider-thumb {
    @apply appearance-none w-5 h-5 rounded-full cursor-pointer;
    background: var(--thumb-color, rgb(250, 204, 21)) !important;
    background-color: var(--thumb-color, rgb(250, 204, 21)) !important;
    border: none;
    transition: all 0.2s ease;
    margin-top: -4px;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
  }

  .slider::-moz-range-thumb {
    @apply w-5 h-5 rounded-full cursor-pointer;
    background: var(--thumb-color, rgb(250, 204, 21)) !important;
    background-color: var(--thumb-color, rgb(250, 204, 21)) !important;
    border: none;
    transition: all 0.2s ease;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.15);
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.15);
  }

  .slider::-webkit-slider-runnable-track {
    @apply rounded-lg h-3;
    background: linear-gradient(
      to right,
      var(--active-color) 0%,
      var(--active-color) var(--value-percent),
      rgba(255, 255, 255, 0.1) var(--value-percent),
      rgba(255, 255, 255, 0.1) 100%
    ) !important;
  }

  .slider::-moz-range-track {
    @apply rounded-lg h-3;
    background: linear-gradient(
      to right,
      var(--active-color) 0%,
      var(--active-color) var(--value-percent),
      rgba(255, 255, 255, 0.1) var(--value-percent),
      rgba(255, 255, 255, 0.1) 100%
    ) !important;
  }

  .slider-input {
    @apply w-16 px-2 py-1 text-right bg-white/10 rounded-lg text-kong-text-primary/90 
           focus:outline-none focus:ring-2;
    font-family: monospace;
  }

  .slider-input:focus {
    box-shadow: 0 0 0 2px var(--active-color, rgb(250, 204, 21));
  }

  .slider-input::-webkit-outer-spin-button,
  .slider-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .slider-input[type=number] {
    -moz-appearance: textfield;
  }
</style>
