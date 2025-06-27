<script lang="ts">
  /**
   * Badge component for displaying status indicators, tags, or labels
   * 
   * Usage:
   * <Badge>Default</Badge>
   * <Badge variant="blue">Blue</Badge>
   * <Badge variant="green">Green</Badge>
   * <Badge variant="red">Red</Badge>
   * <Badge variant="yellow">Yellow</Badge>
   * <Badge variant="purple">Purple</Badge>
   * <Badge variant="gray">Gray</Badge>
   * <Badge icon="🐋">Whale</Badge>
   * <Badge tooltip="This is a tooltip">With tooltip</Badge>
   */
  import { tooltip } from "$lib/actions/tooltip";
  import { colorScheme } from "$lib/stores/derivedThemeStore";

  // Props
  let { 
    variant = "blue", // blue, green, red, yellow, purple, gray, orange, icrc, solana, google
    size = "sm",      // xs, sm, md, lg
    icon = null,      // optional icon to display before text
    pill = true,      // whether to use pill shape (rounded-full) or slightly rounded (rounded)
    tooltip: tooltipText = null, // optional tooltip text
    tooltipDirection = "top" as const, // tooltip direction: top, bottom, left, right
    class: className = "", // additional classes
    children = () => null
  } = $props<{
    variant?: "blue" | "green" | "red" | "yellow" | "purple" | "gray" | "orange" | "icrc" | "solana" | "google";
    size?: "xs" | "sm" | "md" | "lg";
    icon?: string | null;
    pill?: boolean;
    tooltip?: string | null;
    tooltipDirection?: "top" | "bottom" | "left" | "right";
    class?: string;
    children?: () => any;
  }>();

  // Get current theme
  const isDarkTheme = $derived($colorScheme === 'dark');

  // Computed styles based on variant
  const variantStyles = $derived({
    blue: "bg-kong-accent-blue/20 text-kong-accent-blue",
    green: "bg-kong-success/20 text-kong-success",
    red: "bg-kong-error/20 text-kong-error",
    yellow: "bg-kong-accent-yellow/20 text-kong-accent-yellow",
    purple: "bg-kong-primary/20 text-kong-primary",
    gray: "bg-kong-text-secondary/20 text-kong-text-secondary",
    orange: "bg-kong-accent-yellow/20 text-kong-accent-yellow",
    icrc: "bg-gradient-to-r from-[#2D5BCA]/50 to-[#3B99F4]/50 text-kong-text-primary/80",
    solana: "bg-gradient-to-r from-[#00FFA3]/50 to-[#DC1FFF]/50 text-kong-text-primary/70",
    google: isDarkTheme 
      ? "bg-kong-bg-secondary text-white border border-kong-border hover:bg-[#303134] flex items-center shadow-sm" 
      : "bg-white text-[#4285F4] border border-kong-bg-secondary hover:bg-[#F8FAFD] flex items-center shadow-sm"
  });

  // Size styles
  const sizeStyles = {
    xs: "text-[0.65rem] tracking-tight leading-1 px-1",
    sm: "text-xs px-1.5 py-0.5 px-2 font-medium",
    md: "text-sm px-2 py-1 px-2 font-medium",
    lg: "text-sm px-2.5 py-1.5 px-2 font-medium"
  };

  // Special Google badge size overrides
  const googleSizeStyles = {
    xs: "text-xs tracking-tight leading-1 px-1 py-0.5",
    sm: "text-sm py-1 px-2.5",
    md: "text-sm py-1.5 px-3",
    lg: "text-sm py-2 px-4 font-medium",
  };

  // Computed classes
  const badgeClasses = $derived(`
    inline-flex items-center gap-1 
    ${variantStyles[variant] || variantStyles.blue} 
    ${variant === 'google' ? googleSizeStyles[size] || googleSizeStyles.sm : sizeStyles[size] || sizeStyles.sm} 
    ${pill ? 'rounded-full' : 'rounded'} 
    ${tooltipText ? 'cursor-help' : ''}
    ${className}
  `);
</script>

<span 
  class={badgeClasses}
  use:tooltip={tooltipText ? { text: tooltipText, direction: tooltipDirection } : undefined}
>
  {#if variant === 'google'}
    <div class="flex items-center gap-2">
      <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      {@render children()}
    </div>
  {:else}
    {#if icon}<span class="inline-block">{icon}</span>{/if}
    {@render children()}
  {/if}
</span> 