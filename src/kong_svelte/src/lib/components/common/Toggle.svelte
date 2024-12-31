<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let checked: boolean = false;
  export let color: string = "blue";
  export let size: "sm" | "md" | "lg" = "sm";
  export let disabled: boolean = false;
  export let label: string = "Toggle";
  export let showKongMonke: boolean = false;

  const dispatch = createEventDispatcher();

  const colorMap = {
    yellow: "rgb(250, 204, 21)",
    green: "rgb(34, 197, 94)",
    blue: "rgb(59, 130, 246)",
    red: "rgb(239, 68, 68)",
    purple: "rgb(168, 85, 247)",
  };

  const sizeMap = {
    sm: {
      toggle: "w-12 h-6",
      slider: "w-5 h-5",
      translate: "translate-x-6",
    },
    md: {
      toggle: "w-14 h-7",
      slider: "w-6 h-6",
      translate: "translate-x-7",
    },
    lg: {
      toggle: "w-16 h-8",
      slider: "w-7 h-7",
      translate: "translate-x-8",
    },
  };

  $: activeColor = colorMap[color] || colorMap.blue;
  $: style = `--active-color: ${activeColor};`;
  $: sizeClass = sizeMap[size] || sizeMap.sm;

  function handleClick() {
    if (!disabled) {
      checked = !checked;
      dispatch('change', checked);
    }
  }
</script>

<button
  type="button"
  class="toggle-button {sizeClass.toggle}"
  class:active={checked}
  class:disabled
  {disabled}
  on:click={handleClick}
  {style}
  aria-checked={checked}
  role="switch"
  aria-label={label}
>
  <span 
    class="toggle-slider {sizeClass.slider} {checked ? '' : 'bg-kong-bg-dark'}"
    class:translated={checked}
  >
    {#if checked}
      🍌
    {/if}
  </span>
</button>

<style scoped lang="postcss">
  .toggle-button {
    @apply relative rounded-full duration-200 ease-in-out cursor-pointer;
    background: rgba(255, 255, 255, 0.1);
  }

  .toggle-button.active {
    background: rgb(var(--accent-green));
    box-shadow: 0 0 8px rgb(var(--accent-green));
  }

  .toggle-slider {
    @apply absolute top-0.5 left-0.5 rounded-full shadow-sm 
           transform duration-200 ease-in-out;
    background: rgb(var(--bg-dark));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .toggle-button.active .toggle-slider {
    background: rgb(var(--accent-green));
  }

  .toggle-slider.translated {
    transform: translateX(calc(100% + 2px));
  }

  .kong-monke {
    @apply w-full h-full object-cover rounded-full;
    transform-origin: center;
    transition: transform 200ms ease-in-out;
    padding: 1px;
  }

  .kong-monke.flip {
    transform: scaleX(-1);
  }

  .toggle-button:not(.active):hover:not(.disabled) {
    @apply bg-white/20;
  }

  .toggle-button.active:hover:not(.disabled) {
    filter: brightness(110%);
  }

  .toggle-button:focus {
    @apply outline-none ring-1 ring-opacity-50;
    --tw-ring-color: rgb(var(--accent-green));
  }

  .toggle-button.disabled {
    @apply cursor-not-allowed opacity-50;
  }
</style>
