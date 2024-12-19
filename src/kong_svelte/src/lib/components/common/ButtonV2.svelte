<script lang="ts">
  export let label: string | undefined = undefined;
  export let type: "button" | "submit" | "reset" = "button";
  export let theme: "primary" | "secondary" | "success" | "error" | "warning" | "accent-green" | "accent-blue" | "muted" = "primary";
  export let variant: "solid" | "outline" | "transparent" = "solid";
  export let size: "sm" | "md" | "lg" = "md";
  export let isDisabled: boolean = false;
  export let fullWidth: boolean = false;
  export let uppercase: boolean = false;
  export let onClick: () => void = () => {};

  // Theme-based styles
  const baseThemeClasses = {
    primary: "text-kong-text-primary",
    secondary: "text-kong-secondary",
    success: "text-kong-success",
    error: "text-kong-error",
    warning: "text-kong-warning",
    "accent-green": "text-kong-accent-green",
    "accent-blue": "text-kong-accent-blue",
    "accent-red": "text-kong-accent-red",
    muted: "text-kong-text-inverse/60",
  };

  const solidThemeClasses = {
    primary: "bg-kong-primary hover:bg-kong-primary-hover",
    secondary: "bg-kong-secondary hover:bg-kong-secondary-hover",
    success: "bg-kong-success hover:bg-green-500",
    error: "bg-kong-error hover:bg-red-500",
    warning: "bg-kong-warning hover:bg-yellow-500",
    "accent-green": "bg-kong-accent-green hover:bg-kong-accent-green-hover",
    "accent-blue": "bg-kong-accent-blue hover:bg-kong-accent-blue-hover",
    "accent-red": "bg-kong-accent-red hover:bg-kong-accent-red-hover",
    muted: "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white",
  };

  const outlineThemeClasses = {
    primary: "border border-kong-primary text-kong-primary hover:bg-kong-primary/10",
    secondary: "border border-kong-secondary text-kong-secondary hover:bg-kong-secondary/10",
    success: "border border-kong-success text-kong-success hover:bg-kong-success/10",
    error: "border border-kong-error text-kong-error hover:bg-kong-error/10",
    warning: "border border-kong-warning text-kong-warning hover:bg-kong-warning/10",
    muted: "border border-white/20 text-white/50 hover:bg-white/10",
  };

  const transparentThemeClasses = {
    primary: "bg-transparent text-kong-primary hover:bg-kong-primary/10",
    secondary: "bg-transparent text-kong-secondary hover:bg-kong-secondary/10",
    success: "bg-transparent text-kong-success hover:bg-kong-success/10",
    error: "bg-transparent text-kong-error hover:bg-kong-error/10",
    warning: "bg-transparent text-kong-warning hover:bg-kong-warning/10",
    muted: "bg-transparent text-white/50 hover:bg-white/10",
  };

  // Size-based styles
  const sizeClasses = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Determine final button classes
  const variantClasses = {
    solid: solidThemeClasses[theme],
    outline: outlineThemeClasses[theme],
    transparent: transparentThemeClasses[theme],
  };
</script>

<button
  type={type}
  class="rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed {baseThemeClasses[theme]}
    {variantClasses[variant]} {sizeClasses[size]} {fullWidth ? 'w-full' : 'w-auto'} {uppercase ? 'uppercase' : ''}"
  disabled={isDisabled}
  onclick={onClick}
>
  {#if label}
    {label}
  {:else}
    <slot />
  {/if}
</button>
