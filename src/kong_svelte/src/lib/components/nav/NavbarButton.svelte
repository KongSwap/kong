<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  
  // Props with Svelte 5 runes
  let {
    icon,          // Required - Icon component
    onClick,       // Required - Click handler
    label = "",    // Optional - Text label inside button
    tooltipText = "",  // Optional - Tooltip text
    variant = "default", // Button style: "default" | "primary" | "mobile"
    tooltipDirection = "bottom", // Tooltip direction
    isSelected = false, // For active/selected state
    badgeCount = 0,  // For notification badges
    iconSize = 18,   // Default icon size
    disabled = false, // Disable button
    testId = "",     // For testing
    isWalletButton = false, // Flag for wallet buttons
    
    // Theme options - consolidated into a single theme object
    customBgColor = "",
    customHoverBgColor = "",
    customTextColor = "",
    customBorderStyle = "",
    customBorderColor = "",
    customShadow = "",
    useThemeBorder = false,
    useThemeVariables = true,
    class: className = "",
    children = () => null // Replace slot with render function
  } = $props();

  // Generate button style string
  function generateButtonStyle() {
    const styles = [];
    if (!label && variant !== "mobile") styles.push("aspect-square");
    
    if (customBgColor) styles.push(`--btn-bg-color: ${customBgColor}`);
    if (customHoverBgColor) styles.push(`--btn-hover-bg-color: ${customHoverBgColor}`);
    if (customTextColor) styles.push(`--btn-text-color: ${customTextColor}`);
    if (customBorderStyle) styles.push(`--btn-border-style: ${customBorderStyle}`);
    if (customBorderColor) styles.push(`--btn-border-color: ${customBorderColor}`);
    if (customShadow) styles.push(`--btn-shadow: ${customShadow}`);
    
    return styles.join('; ');
  }
  
  let buttonStyle = $derived(generateButtonStyle());
  
  // Compute tooltip props with proper type casting
  let tooltipProps = $derived(tooltipText ? { 
    text: tooltipText, 
    direction: tooltipDirection as "top" | "bottom" | "left" | "right" 
  } : null);
  
  // Compute if button has custom styling
  let hasCustomStyle = $derived(
    !!(customBgColor || customTextColor || customBorderStyle || customBorderColor || customShadow)
  );

  // Compute button classes
  let buttonClass = $derived(
    variant === "primary" 
      ? "h-[30px] px-3 flex items-center gap-1.5 rounded-md text-xs font-semibold text-kong-text-primary/95 bg-kong-primary/40 border border-kong-primary/80 transition-all duration-150 hover:bg-kong-primary/60 hover:border-kong-primary/90"
      : variant === "mobile"
      ? "h-[34px] w-[34px] flex items-center justify-center rounded-md text-kong-text-primary bg-kong-primary/15 border border-kong-primary/30 transition-all duration-150 hover:bg-kong-primary/20 hover:border-kong-primary/40"
      : "h-[30px] px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light"
  );

  // Selected and disabled classes
  let selectedClass = "bg-kong-primary/60 border-kong-primary/90";
  let disabledClass = "opacity-50 cursor-not-allowed pointer-events-none";
</script>

<button
  class="{buttonClass} {className} {isSelected ? selectedClass : ''} {disabled ? disabledClass : ''}"
  class:use-theme-border={useThemeBorder}
  class:has-custom-style={hasCustomStyle}
  class:use-theme-variables={useThemeVariables}
  class:is-primary={variant === "primary"}
  class:wallet-button={isWalletButton}
  style={buttonStyle}
  on:click={onClick}
  {disabled}
  data-testid={testId || "navbar-button"}
  use:tooltip={tooltipProps}
  aria-label={tooltipText || label || "Button"}
>
  <div class="relative">
    {@render icon({ size: iconSize })}
    {#if badgeCount > 0}
      <span class="absolute {variant === 'mobile' ? '-top-2 -left-2' : '-top-3 -left-3'} w-4 h-4 rounded-full bg-kong-accent-red text-white text-[10px] font-medium flex items-center justify-center z-10">
        {badgeCount}
      </span>
    {/if}
  </div>
  
  {#if label && variant !== "mobile"}
    <span>{label}</span>
  {/if}
  
  {@render children()}
</button>

<style scoped lang="postcss">
  /* Custom styling for theme variables - can't be easily converted to Tailwind */
  button.has-custom-style {
    background-color: var(--btn-bg-color, unset) !important;
    color: var(--btn-text-color, unset) !important;
    border: var(--btn-border-style, 1px solid) var(--btn-border-color, unset) !important;
    box-shadow: var(--btn-shadow, unset) !important;
  }
  
  button.has-custom-style:hover:not(.disabled) {
    background-color: var(--btn-hover-bg-color, var(--btn-bg-color, unset)) !important;
  }
  
  /* Theme variables */
  button.use-theme-variables:not(.has-custom-style) {
    &:not(.is-primary) {
      background-color: var(--button-bg, #111523);
      color: var(--button-text, #FFFFFF);
      border: var(--button-border, 1px solid) var(--button-border-color, rgba(255, 255, 255, 0.1));
      box-shadow: var(--button-shadow, none);
      border-radius: var(--button-roundness, 0.375rem);
      
      &:hover:not(.disabled) {
        background-color: var(--button-hover-bg, #232735);
      }
    }
    
    &.is-primary {
      background-color: var(--primary-button-bg, #0095EB);
      color: var(--primary-button-text, #FFFFFF);
      border: var(--primary-button-border, 1px solid) var(--primary-button-border-color, rgba(255, 255, 255, 0.1));
      
      &:hover:not(.disabled) {
        background-color: var(--primary-button-hover-bg, #0086D3);
      }
    }
  }
  
  /* Wallet button */
  button.wallet-button {
    background-color: var(--btn-bg-color, var(--primary-button-bg, var(--button-bg, #0095EB))) !important;
    color: var(--btn-text-color, var(--primary-button-text, var(--button-text, #FFFFFF))) !important;
    
    &.is-primary {
      background-color: var(--btn-bg-color, var(--primary-button-bg, #0095EB)) !important;
    }
    
    &:not(.is-primary) {
      background-color: var(--btn-bg-color, var(--button-bg, rgba(255, 255, 255, 0.1))) !important;
    }
    
    &:hover:not(.disabled) {
      background-color: var(--btn-hover-bg-color, var(--primary-button-hover-bg, var(--button-hover-bg, #0086D3))) !important;
      opacity: 0.9;
    }
  }
  
  button.use-theme-border {
    border-style: var(--btn-border-style, solid) !important;
  }
  
  /* Windows 98 style theme overrides */
  :global(.theme-win98light) {
    button.use-theme-border {
      border-width: 2px !important;
      border-style: solid !important;
      border-color: #FDFFFF #818181 #818181 #FDFFFF !important;
      box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF !important;
    }
    
    button.wallet-button {
      &.is-primary {
        background-color: var(--primary-button-bg, #010081) !important;
        color: var(--primary-button-text, #FFFFFF) !important;
      }
      
      &:not(.is-primary) {
        background-color: var(--button-bg, #C3C3C3) !important;
        color: var(--button-text, #000000) !important;
      }
    }
    
    .mobile-wallet-btn {
      border-width: 2px !important;
      border-style: solid !important;
      border-color: #FDFFFF #818181 #818181 #FDFFFF !important;
      box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF !important;
      border-radius: 0 !important;
      background-color: var(--primary-button-bg, #C3C3C3) !important;
    }
  }
  
  /* Mobile wallet button */
  :global(.mobile-wallet-btn) {
    @apply w-full flex items-center justify-center gap-2 px-4 py-1.5 bg-kong-primary/15 hover:bg-kong-primary/20 text-kong-text-primary font-semibold border border-kong-primary/30 hover:border-kong-primary/40 transition-all duration-200;
    background-color: var(--primary-button-bg, rgba(0, 149, 235, 0.15)) !important;
  }
</style> 