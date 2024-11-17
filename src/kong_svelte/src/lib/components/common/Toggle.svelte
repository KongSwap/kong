<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let checked: boolean = false;
  export let color: string = "yellow";
  export let size: "sm" | "md" | "lg" = "md";
  export let disabled: boolean = false;
  export let label: string = "Toggle";

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
      toggle: "w-10 h-6",
      slider: "w-4 h-4",
      translate: "translate-x-5",
    },
    md: {
      toggle: "w-14 h-8",
      slider: "w-6 h-6",
      translate: "translate-x-7",
    },
    lg: {
      toggle: "w-16 h-10",
      slider: "w-8 h-8",
      translate: "translate-x-8",
    },
  };

  $: activeColor = colorMap[color] || colorMap.yellow;
  $: style = `--active-color: ${activeColor};`;
  $: sizeClass = sizeMap[size] || sizeMap.md;

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
    class="toggle-slider {sizeClass.slider}"
    class:translated={checked}
  />
</button>

<style scoped lang="postcss">
  .toggle-button {
    @apply relative rounded-full duration-300 ease-in-out cursor-pointer;
    background: rgba(255, 255, 255, 0.1);
  }

  .toggle-button.active {
    background: var(--active-color);
  }

  .toggle-slider {
    @apply absolute top-1 left-1 rounded-full bg-white shadow-lg transform duration-300 ease-in-out;
    transform: translateX(0);
  }

  .toggle-slider.translated {
    transform: translateX(24px);
  }

  .toggle-button:not(.active):hover:not(.disabled) {
    @apply bg-white/20;
  }

  .toggle-button.active:hover:not(.disabled) {
    filter: brightness(110%);
  }

  .toggle-button:focus {
    @apply outline-none ring-2 ring-opacity-50;
    --tw-ring-color: var(--active-color);
  }

  .toggle-button.disabled {
    @apply cursor-not-allowed opacity-50;
  }

  .toggle-button.disabled .toggle-slider {
    @apply opacity-50;
  }
</style>
