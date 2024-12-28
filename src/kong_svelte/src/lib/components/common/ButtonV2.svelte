<script lang="ts">
  export let label: string | undefined = undefined;
  export let type: "button" | "submit" | "reset" = "button";
  export let theme: "primary" | "secondary" | "success" | "error" | "warning" | "accent-green" | "accent-blue" | "muted" = "primary";
  export let variant: "solid" | "outline" | "transparent" | "shine" = "solid";
  export let size: "sm" | "md" | "lg" = "md";
  export let isDisabled: boolean = false;
  export let fullWidth: boolean = false;
  export let uppercase: boolean = false;
  export let disabled: boolean = false;
  export let className: string = "";

  // Theme-based styles
  const baseThemeClasses = {
    primary: "text-white",
    secondary: "text-kong-secondary",
    success: "text-kong-success",
    error: "text-kong-error",
    warning: "text-kong-warning",
    "accent-green": "text-white",
    "accent-blue": "text-kong-white",
    "accent-red": "text-kong-white",
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

  // Add shine variant styles
  const shineThemeClasses = {
    primary: `
      relative overflow-hidden
      bg-gradient-to-r from-kong-primary to-kong-primary-hover
      hover:from-kong-primary-hover hover:to-kong-primary
      shadow-lg hover:shadow-xl
      border border-white/10
      transform hover:-translate-y-0.5
      transition-all duration-200
    `,
    secondary: "bg-gradient-to-r from-kong-secondary to-kong-secondary-hover",
    success: "bg-gradient-to-r from-kong-success to-green-500",
    error: "bg-gradient-to-r from-kong-error to-red-500",
    warning: "bg-gradient-to-r from-kong-warning to-yellow-500",
    "accent-green": "bg-gradient-to-r from-kong-accent-green to-kong-accent-green-hover",
    "accent-blue": "bg-gradient-to-r from-kong-accent-blue to-kong-accent-blue-hover",
    muted: "bg-gradient-to-r from-white/10 to-white/20",
  };

  // Determine final button classes
  const variantClasses = {
    solid: solidThemeClasses[theme],
    outline: outlineThemeClasses[theme],
    transparent: transparentThemeClasses[theme],
    shine: shineThemeClasses[theme],
  };
</script>

<button
  type={type}
  class="rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed 
    {baseThemeClasses[theme]} {variantClasses[variant]} {sizeClasses[size]} 
    {fullWidth ? 'w-full' : 'w-auto'} {uppercase ? 'uppercase' : ''} {className}"
  disabled={isDisabled}
  on:click
>
  <div class="relative z-10">
    {#if label}
      {label}
    {:else}
      <slot />
    {/if}
  </div>

  {#if variant === "shine" && !isDisabled}
    <div class="absolute inset-0 overflow-hidden">
      <div class="shine-effect"></div>
    </div>
    <div class="ready-glow"></div>
  {/if}
</button>

<style>
  .shine-effect {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transform: skewX(-20deg);
    pointer-events: none;
    animation: shine 3s infinite;
  }

  .ready-glow {
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: linear-gradient(
      135deg,
      rgba(55, 114, 255, 0.5),
      rgba(111, 66, 193, 0.5)
    );
    opacity: 0;
    filter: blur(8px);
    transition: opacity 0.3s ease;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes shine {
    0%, 100% {
      left: -100%;
    }
    35%, 65% {
      left: 200%;
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      opacity: 0;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.02);
    }
  }
</style>
