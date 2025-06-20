<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let checked: boolean = false;
  export let color: string = "blue";
  export let size: "sm" | "md" | "lg" = "sm";
  export let disabled: boolean = false;
  export let label: string = "Toggle";
  export let isThemeToggle: boolean = false;

  const dispatch = createEventDispatcher();

  const sizeMap = {
    sm: {
      toggle: "w-12 h-6",
      slider: "w-5 h-5",
      translate: "translate-x-[26px]",
      icon: "w-3 h-3",
    },
    md: {
      toggle: "w-16 h-8",
      slider: "w-7 h-7",
      translate: "translate-x-[36px]",
      icon: "w-4 h-4",
    },
    lg: {
      toggle: "w-20 h-10",
      slider: "w-9 h-9",
      translate: "translate-x-[44px]",
      icon: "w-5 h-5",
    },
  };

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
  class="toggle-base {sizeClass.toggle}"
  class:active={checked}
  class:disabled
  {disabled}
  onclick={handleClick}
  aria-checked={checked}
  role="switch"
  aria-label={label}
>
  <div class="toggle-background" class:checked />

  {#if isThemeToggle}
    <div class="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
      <!-- Sun icon -->
      <svg 
        class="icon-sun {sizeClass.icon}"
        class:dim={checked}
        viewBox="0 0 24 24" 
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z"/>
        <path d="M12 1V3M12 21V23M23 12H21M3 12H1M20 20L18.5 18.5M4 4L5.5 5.5M20 4L18.5 5.5M4 20L5.5 18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>

      <!-- Moon icon -->
      <svg 
        class="icon-moon {sizeClass.icon}"
        class:dim={!checked}
        viewBox="0 0 24 24" 
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    </div>
  {/if}

  <div 
    class="toggle-slider {sizeClass.slider}"
    style="transform: translateX({checked ? (size === 'sm' ? '26px' : size === 'md' ? '36px' : '44px') : '0'})"
  />
</button>

<style lang="postcss">
  .toggle-base {
    @apply relative rounded-full transition-all duration-300 ease-in-out cursor-pointer;
    @apply bg-kong-bg-primary border border-kong-border;
  }

  .toggle-background {
    @apply absolute inset-0 rounded-full transition-all duration-300;
    @apply bg-gradient-to-r from-kong-primary/20 to-kong-primary/30;
    opacity: 0;
  }

  .toggle-background.checked {
    opacity: 1;
    @apply bg-gradient-to-r from-kong-primary/30 to-kong-primary/40;
  }

  .toggle-slider {
    @apply absolute top-0.5 left-0.5 rounded-full transition-all duration-300 ease-out;
    @apply bg-white border border-white/90;
    @apply shadow-[0_2px_4px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,1)];
  }

  .icon-sun {
    @apply transition-all duration-300;
    @apply text-yellow-300;
    filter: drop-shadow(0 0 4px theme('colors.yellow.400'))
           drop-shadow(0 0 6px theme('colors.yellow.400/0.5'));
  }

  .icon-moon {
    @apply transition-all duration-300;
    @apply text-blue-400;
    filter: drop-shadow(0 0 4px theme('colors.blue.400'))
           drop-shadow(0 0 6px theme('colors.blue.400/0.5'));
  }

  .dim {
    @apply opacity-40;
    filter: none;
  }

  /* Hover effects */
  .toggle-base:hover:not(.disabled) {
    @apply border-kong-border-light;
  }

  .toggle-base:hover:not(.disabled) .toggle-slider {
    @apply shadow-[0_3px_6px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,1)];
  }

  /* Active/pressed state */
  .toggle-base:active:not(.disabled) .toggle-slider {
    @apply scale-95;
  }

  /* Focus state */
  .toggle-base:focus {
    @apply outline-none ring-2 ring-kong-primary/50 ring-offset-1 ring-offset-kong-bg-primary;
  }

  /* Disabled state */
  .toggle-base.disabled {
    @apply cursor-not-allowed opacity-50;
  }

  .toggle-base.disabled .toggle-slider {
    @apply bg-gray-200;
  }

  /* Checked state enhancements */
  .toggle-base.active {
    @apply border-kong-primary/30 bg-kong-bg-primary/80;
  }

  .toggle-base.active .toggle-background {
    @apply bg-gradient-to-r from-kong-primary/40 to-kong-primary/50;
    @apply shadow-[inset_0_2px_8px_theme(colors.kong.primary/0.2),inset_0_-1px_4px_theme(colors.kong.primary/0.1)];
  }
</style>
