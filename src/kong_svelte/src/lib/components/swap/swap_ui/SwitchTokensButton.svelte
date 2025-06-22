<script lang="ts">
  import { themeStore } from "$lib/stores/themeStore";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import { tweened } from 'svelte/motion';
  import { onMount } from 'svelte';
  
  // Theme-specific styling
  let theme = $derived(getThemeById($themeStore));
  let backgroundColor = $derived(theme.colors.switchButtonBg || theme.colors.bgSecondary || '#1c2333');
  let hoverBackgroundColor = $derived(theme.colors.switchButtonHoverBg || theme.colors.bgPrimary || '#252b3d');
  let borderColor = $derived(theme.colors.switchButtonBorder || theme.colors.borderLight || 'rgba(255, 255, 255, 0.1)');
  let buttonShadow = $derived(theme.colors.switchButtonShadow || '0 8px 32px rgba(0, 0, 0, 0.32)');
  let ismicroswapTheme = $derived(theme.id === 'microswap');

  // Props
  let { 
    isDisabled = false,
    debounceTime = 250,
    onSwitch = () => {} // Default no-op function
  } = $props<{
    isDisabled?: boolean;
    debounceTime?: number;
    onSwitch?: () => void;
  }>();

  // Use Svelte's tweened store for smooth animation with optimized settings
  const rotation = tweened(0, {
    duration: 250, // Slightly faster animation for better responsiveness
    easing: t => 1 - Math.pow(1 - t, 3) // cubic ease out
  });
  
  // Internal state
  let debouncing = false;
  let isHovered = $state(false);
  let buttonElement;

  // Memoize button styles to avoid recalculation on each render
  let buttonStyle = $derived(`
    background: ${isHovered ? hoverBackgroundColor : backgroundColor};
    ${!ismicroswapTheme ? `border-color: ${isHovered ? borderColor : borderColor};` : 
    `border-style: solid; border-width: 2px; border-color: ${borderColor};`}
    ${ismicroswapTheme ? `box-shadow: ${buttonShadow};` : ''}
    color: ${theme.colors.textPrimary || 'white'};
  `);

  // Memoize icon container styles
  let iconStyle = $derived(`transform: rotate(-${$rotation}deg);`);

  // Memoize disabled state classes
  let disabledClasses = $derived(isDisabled ? 'opacity-50 cursor-not-allowed' : '');

  // Optimized click handler with debounce
  function handleClick() {
    if (isDisabled || debouncing) return;
    
    // Set debounce flag to prevent rapid clicks
    debouncing = true;
    setTimeout(() => {
      debouncing = false;
    }, debounceTime);
    
    // Update rotation value
    rotation.update(r => r + 180);
    
    // Call the onSwitch callback
    onSwitch();
  }

  // Use passive event listeners for better performance
  onMount(() => {
    if (buttonElement) {
      const handleMouseEnter = () => isHovered = true;
      const handleMouseLeave = () => isHovered = false;
      
      buttonElement.addEventListener('mouseenter', handleMouseEnter, { passive: true });
      buttonElement.addEventListener('mouseleave', handleMouseLeave, { passive: true });
      
      return () => {
        buttonElement.removeEventListener('mouseenter', handleMouseEnter);
        buttonElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  });

  // Pre-optimized SVG path
  const svgPath = "M7.5 3.5L4.5 6.5L7.5 9.5M4.5 6.5H16.5C18.71 6.5 20.5 8.29 20.5 10.5C20.5 11.48 20.14 12.37 19.55 13.05M16.5 20.5L19.5 17.5L16.5 14.5M19.5 17.5H7.5C5.29 17.5 3.5 15.71 3.5 13.5C3.5 12.52 3.86 11.63 4.45 10.95";
</script>

<button
  bind:this={buttonElement}
  class="switch-tokens-button opacity-80 transition-all hover:opacity-100 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full duration-200 ease-out border shadow-lg {ismicroswapTheme ? 'rounded-none win98-button' : 'hover:scale-110 hover:shadow-lg active:scale-95 active:shadow-md'} {disabledClasses}"
  style={buttonStyle}
  onclick={handleClick}
  disabled={isDisabled}
  aria-label="Switch tokens position"
>
  <div 
    class="w-full h-full flex items-center justify-center transform-gpu"
    style={iconStyle}
  >
    <svg
      class="w-5 h-5 sm:w-5 sm:h-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      width="24"
      height="24"
    >
      <path
        d={svgPath}
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</button>

<style>
  .switch-tokens-button {
    /* Hardware acceleration */
    transform: translate(-50%, -50%) translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
  }
  
  .transform-gpu {
    /* Enable GPU acceleration for transforms */
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform;
    transition: transform 0.2s ease-out;
  }
  
  /* Win98 specific styles */
  .win98-button {
    transition: all 0.1s ease-out;
  }
  
  .win98-button:active {
    /* Pressed state for Win98 */
    box-shadow: inset -1px -1px 0 #FFFFFF, inset 1px 1px 0 #808080 !important;
    transform: translate(-50%, -50%) translateY(1px);
  }
</style>
