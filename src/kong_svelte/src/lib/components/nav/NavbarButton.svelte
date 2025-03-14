<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import type { ComponentType, SvelteComponent } from "svelte";
  
  // Props
  export let icon: ComponentType<SvelteComponent>; // Required - Icon component 
  export let onClick: () => void; // Required - Click handler
  export let label: string = ""; // Optional - Text label inside button
  export let tooltipText: string = ""; // Optional - Tooltip text
  export let variant: "default" | "primary" | "mobile" = "default"; // Button style
  export let tooltipDirection: "top" | "bottom" | "left" | "right" = "bottom";
  export let isSelected: boolean = false; // For active/selected state
  export let badgeCount: number = 0; // For notification badges
  export let iconSize: number = 18; // Default icon size
  export let disabled: boolean = false; // Disable button
  export let testId: string = ""; // For testing
  export let isWalletButton: boolean = false; // Flag for wallet buttons to ensure they always have a background
  
  // Theme-specific styling options
  export let customBgColor: string = ""; // Override background color
  export let customHoverBgColor: string = ""; // Override hover background color
  export let customTextColor: string = ""; // Override text color
  export let customBorderStyle: string = ""; // Override border style
  export let customBorderColor: string = ""; // Override border color
  export let customShadow: string = ""; // Override shadow
  export let useThemeBorder: boolean = false; // Use theme-specific border style
  export let useThemeVariables: boolean = true; // Whether to use CSS variables from theme

  // Allow custom classes to be passed from parent component
  let className = "";
  export { className as class };

  // Derive class based on variant
  $: buttonClass = variant === "primary" 
    ? "h-[34px] px-3.5 flex items-center gap-1.5 rounded-md text-sm font-semibold text-kong-text-primary/95 bg-kong-primary/40 border border-kong-primary/80 transition-all duration-150 hover:bg-kong-primary/60 hover:border-kong-primary/90"
    : variant === "mobile"
    ? "h-[34px] w-[34px] flex items-center justify-center rounded-md text-kong-text-primary bg-kong-primary/15 border border-kong-primary/30 transition-all duration-150 hover:bg-kong-primary/20 hover:border-kong-primary/40"
    : "h-[34px] px-3 flex items-center gap-1.5 rounded-md text-sm font-medium text-kong-text-secondary bg-kong-text-primary/5 border border-kong-border light:border-gray-800/20 transition-all duration-150 hover:text-kong-text-primary hover:bg-kong-text-primary/10 hover:border-kong-border-light";
  
  // If no label provided, make it a square button
  $: buttonStyle = !label && variant !== "mobile" ? "aspect-square" : "";
  
  // Add custom styling if provided
  $: if (customBgColor || customTextColor || customBorderStyle || customBorderColor || customShadow || customHoverBgColor) {
    buttonStyle += `${buttonStyle ? '; ' : ''}
      ${customBgColor ? `--btn-bg-color: ${customBgColor};` : ''}
      ${customHoverBgColor ? `--btn-hover-bg-color: ${customHoverBgColor};` : ''}
      ${customTextColor ? `--btn-text-color: ${customTextColor};` : ''}
      ${customBorderStyle ? `--btn-border-style: ${customBorderStyle};` : ''}
      ${customBorderColor ? `--btn-border-color: ${customBorderColor};` : ''}
      ${customShadow ? `--btn-shadow: ${customShadow};` : ''}
    `;
  }
  
  // Derive tooltip props
  $: tooltipProps = tooltipText 
    ? { text: tooltipText, direction: tooltipDirection } 
    : null;
</script>

<button
  class="{buttonClass} {className}"
  class:selected={isSelected}
  class:disabled
  class:use-theme-border={useThemeBorder}
  class:has-custom-style={customBgColor || customTextColor || customBorderStyle || customBorderColor || customShadow}
  class:use-theme-variables={useThemeVariables}
  class:is-primary={variant === "primary"}
  class:wallet-button={isWalletButton}
  style={buttonStyle}
  on:click={onClick}
  disabled={disabled}
  data-testid={testId || "navbar-button"}
  use:tooltip={tooltipProps}
  aria-label={tooltipText || label || "Button"}
>
  <svelte:component this={icon} size={iconSize} />
  
  {#if label && variant !== "mobile"}
    <span>{label}</span>
  {/if}
  
  {#if badgeCount > 0}
    <span class="notification-badge" class:notification-badge-mobile={variant === "mobile"}>
      {badgeCount}
    </span>
  {/if}
  
  <slot /><!-- Additional content like dropdowns -->
</button>

<style scoped lang="postcss">
  button.disabled {
    @apply opacity-50 cursor-not-allowed pointer-events-none;
  }
  
  button.selected {
    @apply bg-kong-primary/60 border-kong-primary/90;
  }
  
  button.has-custom-style {
    background-color: var(--btn-bg-color, unset) !important;
    color: var(--btn-text-color, unset) !important;
    border: var(--btn-border-style, 1px solid) var(--btn-border-color, unset) !important;
    box-shadow: var(--btn-shadow, unset) !important;
  }
  
  button.has-custom-style:hover:not(.disabled) {
    background-color: var(--btn-hover-bg-color, var(--btn-bg-color, unset)) !important;
  }
  
  /* Use CSS variables from theme */
  button.use-theme-variables:not(.has-custom-style):not(.is-primary) {
    background-color: var(--button-bg, #111523);
    color: var(--button-text, #FFFFFF);
    border: var(--button-border, 1px solid) var(--button-border-color, rgba(255, 255, 255, 0.1));
    box-shadow: var(--button-shadow, none);
    border-radius: var(--button-roundness, 0.375rem);
  }
  
  button.use-theme-variables:not(.has-custom-style):not(.is-primary):hover:not(.disabled) {
    background-color: var(--button-hover-bg, #232735);
  }
  
  /* Primary button theme variables */
  button.use-theme-variables.is-primary:not(.has-custom-style) {
    background-color: var(--primary-button-bg, #0095EB);
    color: var(--primary-button-text, #FFFFFF);
    border: var(--primary-button-border, 1px solid) var(--primary-button-border-color, rgba(255, 255, 255, 0.1));
  }
  
  button.use-theme-variables.is-primary:not(.has-custom-style):hover:not(.disabled) {
    background-color: var(--primary-button-hover-bg, #0086D3);
  }
  
  /* Special styling for wallet buttons - ensures they always have a background */
  button.wallet-button {
    background-color: var(--btn-bg-color, var(--primary-button-bg, var(--button-bg, #0095EB))) !important;
    color: var(--btn-text-color, var(--primary-button-text, var(--button-text, #FFFFFF))) !important;
  }
  
  button.wallet-button.is-primary {
    background-color: var(--btn-bg-color, var(--primary-button-bg, #0095EB)) !important;
  }
  
  button.wallet-button:not(.is-primary) {
    background-color: var(--btn-bg-color, var(--button-bg, rgba(255, 255, 255, 0.1))) !important;
  }
  
  button.wallet-button.use-theme-variables.is-primary:not(.has-custom-style) {
    background-color: var(--primary-button-bg, #0095EB) !important;
  }
  
  button.wallet-button:hover:not(.disabled) {
    background-color: var(--btn-hover-bg-color, var(--primary-button-hover-bg, var(--button-hover-bg, #0086D3))) !important;
    opacity: 0.9;
  }
  
  button.use-theme-border {
    border-style: var(--btn-border-style, solid) !important;
  }
  
  /* Windows 98 style border */
  :global(.theme-win98light) button.use-theme-border {
    border-width: 2px !important;
    border-style: solid !important;
    border-color: #FDFFFF #818181 #818181 #FDFFFF !important;
    box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF !important;
  }
  
  /* Ensure wallet button in Win98 theme has proper background */
  :global(.theme-win98light) button.wallet-button.is-primary {
    background-color: var(--primary-button-bg, #010081) !important;
    color: var(--primary-button-text, #FFFFFF) !important;
  }
  
  :global(.theme-win98light) button.wallet-button:not(.is-primary) {
    background-color: var(--button-bg, #C3C3C3) !important;
    color: var(--button-text, #000000) !important;
  }
  
  .notification-badge {
    @apply absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-kong-accent-red text-white text-[10px] font-medium flex items-center justify-center;
  }

  .notification-badge-mobile {
    @apply -top-1 -right-1;
  }
  
  /* Special style for mobile wallet button */
  :global(.mobile-wallet-btn) {
    @apply w-full flex items-center justify-center gap-2 px-4 py-1.5 bg-kong-primary/15 hover:bg-kong-primary/20 text-kong-text-primary font-semibold border border-kong-primary/30 hover:border-kong-primary/40 transition-all duration-200;
    background-color: var(--primary-button-bg, rgba(0, 149, 235, 0.15)) !important;
  }
  
  /* Win98 special styling for mobile wallet button */
  :global(.theme-win98light .mobile-wallet-btn) {
    border-width: 2px !important;
    border-style: solid !important;
    border-color: #FDFFFF #818181 #818181 #FDFFFF !important;
    box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF !important;
    border-radius: 0 !important;
    background-color: var(--primary-button-bg, #C3C3C3) !important;
  }
</style> 