<script lang="ts">
  import { onMount } from 'svelte';

  let {
    label = undefined,
    type = "button",
    theme = "primary",
    variant = "solid",
    size = "md",
    isDisabled = false,
    fullWidth = false,
    uppercase = false,
    disabled = false,
    className = "",
    element = $bindable(null),
    animationIterations = 1
  } = $props<{
    label?: string;
    type?: "button" | "submit" | "reset";
    theme?: "primary" | "secondary" | "success" | "error" | "warning" | "accent-green" | "accent-blue" | "muted";
    variant?: "solid" | "outline" | "transparent" | "shine";
    size?: "xs" | "sm" | "md" | "lg";
    isDisabled?: boolean;
    fullWidth?: boolean;
    uppercase?: boolean;
    disabled?: boolean;
    className?: string;
    element?: HTMLButtonElement | null;
    animationIterations?: number;
  }>();
  
  // Convert state to runes
  let hasAnimated = $state(false);
  
  // Compute animation iteration count for CSS
  let animationCount = $derived(animationIterations <= 0 ? 'infinite' : animationIterations.toString());

  // Theme-based styles
  const baseThemeClasses = {
    primary: "text-white/90",
    secondary: "text-white/90",
    success: "text-kong-success",
    error: "text-white",
    warning: "text-kong-warning",
    "accent-green": "text-kong-text-on-primary",
    "accent-blue": "text-kong-white",
    "accent-red": "text-kong-white",
    muted: "text-kong-text-inverse/60",
  };

  const solidThemeClasses = {
    primary: "bg-kong-primary hover:bg-kong-primary-hover",
    secondary: "bg-white/5 hover:bg-white/10",
    success: "bg-kong-accent-green hover:bg-kong-accent-green-hover",
    error: "bg-red-600 hover:bg-red-700",
    warning: "bg-kong-warning hover:bg-yellow-500",
    "accent-green": "bg-kong-accent-green hover:bg-kong-accent-green-hover",
    "accent-blue": "bg-kong-accent-blue hover:bg-kong-accent-blue-hover",
    "accent-red": "bg-kong-accent-red hover:bg-kong-accent-red-hover",
    muted: "bg-white/5 hover:bg-white/10 text-white/90 hover:text-white",
  };

  const outlineThemeClasses = {
    primary: "border border-kong-primary text-kong-primary hover:bg-kong-primary/10",
    secondary: "border border-white/10 text-white/90 hover:bg-white/5",
    "accent-green": "border border-kong-accent-green text-kong-text-accent-green hover:bg-kong-accent-green/10",
    "accent-blue": "border border-kong-accent-blue text-kong-accent-blue hover:bg-kong-accent-blue/10",
    "accent-red": "border border-kong-accent-red text-kong-accent-red hover:bg-kong-accent-red/10",
    success: "border border-kong-success text-kong-success hover:bg-kong-success/10",
    error: "border border-red-600 text-red-500 hover:bg-red-600/10",
    warning: "border border-kong-warning text-kong-warning hover:bg-kong-warning/10",
    muted: "border border-white/10 text-white/50 hover:bg-white/5",
  };

  const transparentThemeClasses = {
    primary: "bg-transparent text-kong-primary hover:bg-kong-primary/10",
    secondary: "bg-transparent text-white/90 hover:bg-white/5",
    "accent-green": "bg-transparent text-kong-text-accent-green hover:bg-kong-accent-green/10",
    "accent-blue": "bg-transparent text-kong-accent-blue hover:bg-kong-accent-blue/10",
    "accent-red": "bg-transparent text-kong-accent-red hover:bg-kong-accent-red/10",
    success: "bg-transparent text-kong-success hover:bg-kong-success/10",
    error: "bg-transparent text-red-600 hover:bg-red-600/10",
    warning: "bg-transparent text-kong-warning hover:bg-kong-warning/10",
    muted: "bg-transparent text-white/50 hover:bg-white/5",
  };

  const sizeClasses = {
    xs: "px-2 py-1 text-xs",
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

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

  const variantClasses = {
    solid: solidThemeClasses[theme],
    outline: outlineThemeClasses[theme],
    transparent: transparentThemeClasses[theme],
    shine: shineThemeClasses[theme],
  };
  
  function handleAnimationEnd() {
    if (animationIterations > 0) {
      hasAnimated = true;
    }
  }
  
  onMount(() => {
    hasAnimated = false;
  });
</script>

<button
  bind:this={element}
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

  {#if variant === "shine" && !isDisabled && (!hasAnimated || animationIterations <= 0)}
    <div class="absolute inset-0 overflow-hidden">
      <div class="shine-effect" style="animation-iteration-count: {animationCount};" on:animationend={handleAnimationEnd}></div>
    </div>
    <div class="ready-glow" style="animation-iteration-count: {animationCount};"></div>
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
    animation: shine 3s; /* Removed fixed iteration count */
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
    animation: pulse-glow 2s ease-in-out; /* Removed fixed iteration count */
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
