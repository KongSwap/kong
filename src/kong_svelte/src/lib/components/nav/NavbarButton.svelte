<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { X } from "lucide-svelte";
  
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
    loading = false, // Loading state
    clickableDuringLoading = false, // Allow clicking during loading state
    
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
    if (customBorderStyle) styles.push(`--btn-border-style: ${customBorderStyle}`);
    if (customBorderColor) styles.push(`--btn-border-color: ${customBorderColor}`);
    if (customShadow) styles.push(`--btn-shadow: ${customShadow}`);
    
    return styles.join('; ');
  }
  
  let buttonStyle = $derived(generateButtonStyle());
  
  // Compute tooltip props with proper type casting - only when tooltipText exists
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
      ? `h-[34px] px-2.5 flex items-center gap-1.5 ${$panelRoundness} text-xs font-semibold text-kong-text-primary/95 bg-kong-primary/40 border border-kong-primary/80 transition-all duration-150 hover:bg-kong-primary/60 hover:border-kong-primary/90`
      : variant === "mobile"
      ? `h-[34px] w-[34px] flex items-center justify-center ${$panelRoundness} text-kong-text-primary bg-kong-primary/15 border border-kong-primary/30 transition-all duration-150 hover:bg-kong-primary/20 hover:border-kong-primary/40`
      : `h-[34px] px-2.5 flex items-center gap-1.5 ${$panelRoundness} text-xs font-medium text-kong-text-secondary bg-kong-bg-primary border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-bg-secondary hover:border-kong-border-light`
  );

  // Selected and disabled classes
  let selectedClass = "bg-kong-primary/60 border-kong-primary/90";
  let disabledClass = "opacity-70 cursor-not-allowed pointer-events-none";
</script>

<button
  class="{buttonClass} {className} {isSelected ? selectedClass : ''} {disabled ? disabledClass : ''} {$panelRoundness}"
  class:use-theme-border={useThemeBorder}
  class:has-custom-style={hasCustomStyle}
  class:use-theme-variables={useThemeVariables}
  class:is-primary={variant === "primary"}
  class:wallet-button={isWalletButton}
  style={buttonStyle}
  onclick={onClick}
  disabled={disabled}
  data-testid={testId || "navbar-button"}
  use:tooltip={tooltipText ? tooltipProps : null}
  aria-label={tooltipText || label || "Button"}
>
  <div class="relative group">
    {#if loading}
      <div class="spinner" style="width: {iconSize}px; height: {iconSize}px;">
        {#if isWalletButton}
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <X size={iconSize} />
          </div>
          <div class="absolute inset-0 opacity-100 group-hover:opacity-0 transition-opacity duration-200">
            <div class="spinner-inner"></div>
          </div>
        {/if}
      </div>
    {:else}
      {@render icon({ size: iconSize })}
      {#if badgeCount > 0}
        <span class="absolute {variant === 'mobile' ? '-top-2 -left-2' : '-top-3 -left-3'} w-4 h-4 rounded-full bg-kong-error text-white text-[10px] font-medium flex items-center justify-center z-10">
          {badgeCount}
        </span>
      {/if}
    {/if}
  </div>
  
  {#if label && variant !== "mobile"}
    <span>{loading ? undefined : label}</span>
  {/if}
  
  {@render children()}
</button>

<style scoped lang="postcss">
  /* Custom styling for theme variables - can't be easily converted to Tailwind */
  button.has-custom-style {
    background-color: var(--btn-bg-color, unset) !important;
    border: var(--btn-border-style, 1px solid) var(--btn-border-color, unset) !important;
    box-shadow: var(--btn-shadow, unset) !important;
  }
  
  button.has-custom-style:hover:not(.disabled) {
    background-color: var(--btn-hover-bg-color, var(--btn-bg-color, unset)) !important;
  }
  
  /* Theme variables */
  button.use-theme-variables:not(.has-custom-style) {
    &:not(.is-primary) {
      @apply bg-kong-bg-primary text-kong-text-primary hover:bg-kong-bg-secondary hover:text-kong-text-primary;
      border: var(--button-border, 1px solid) var(--button-border-color, rgba(255, 255, 255, 0.1));
      box-shadow: var(--button-shadow, none);
    }
    
    &.is-primary {
      background-color: var(--primary-button-bg, #0095EB);
      color: var(--text-primary, #FFFFFF);
      border: var(--primary-button-border, 1px solid) var(--primary-button-border-color, rgba(255, 255, 255, 0.1));
      
      &:hover:not(.disabled) {
        background-color: var(--primary-button-hover-bg, #0086D3);
      }
    }
  }
  
  /* Wallet button */
  button.wallet-button {
    @apply !bg-kong-primary !text-kong-text-primary;
    
    &.is-primary {
      background-color: var(--btn-bg-color, var(--primary-button-bg, #0095EB)) !important;
    }
    
    &:not(.is-primary) {
      @apply !bg-kong-primary hover:!text-kong-text-primary;
    }
    
    &:hover:not(.disabled) {
      @apply !bg-kong-primary/90 !text-kong-text-primary;
      opacity: 0.9;
    }
  }
  
  button.use-theme-border {
    border-style: var(--btn-border-style, solid) !important;
  }
  
  /* Windows 98 style theme overrides */
  :global(.theme-microswap) {
    button.use-theme-border {
      border-width: 2px !important;
      border-style: solid !important;
      border-color: #FDFFFF #818181 #818181 #FDFFFF !important;
      box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF !important;
    }
    
    button.wallet-button {
      &.is-primary {
        background-color: var(--primary-button-bg, #010081) !important;
        color: var(--text-primary, #FFFFFF) !important;
      }
      
      &:not(.is-primary) {
        background-color: var(--button-bg, #C3C3C3) !important;
      }
    }
    
    .mobile-wallet-btn {
      @apply w-full flex items-center justify-center gap-2 px-4 py-1.5 bg-kong-primary/15 hover:bg-kong-primary/20 text-kong-text-primary font-semibold border border-kong-primary/30 hover:border-kong-primary/40 transition-all duration-200;
    background-color: var(--primary-button-bg, rgba(0, 149, 235, 0.15)) !important;
      border-width: 2px !important;
      border-style: solid !important;
      border-color: #FDFFFF #818181 #818181 #FDFFFF !important;
      box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF !important;
      border-radius: 0 !important;
      background-color: var(--primary-button-bg, #C3C3C3) !important;
    }
  }
  
  /* Loading spinner */
  .spinner {
    width: 18px;
    height: 18px;
    position: relative;
  }

  .spinner-inner {
    width: 100%;
    height: 100%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: currentColor;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style> 