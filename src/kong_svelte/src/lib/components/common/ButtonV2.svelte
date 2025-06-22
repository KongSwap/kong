<script lang="ts">
  import { onMount } from 'svelte';
  import { panelRoundness } from '$lib/stores/derivedThemeStore';

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
    animationIterations = 1,
    onclick = () => {}
  } = $props<{
    label?: string;
    type?: "button" | "submit" | "reset";
    theme?: "primary" | "secondary" | "success" | "error" | "warning" | "accent-green" | "accent-blue" | "accent-red" | "muted";
    variant?: "solid" | "outline" | "transparent" | "shine";
    size?: "xs" | "sm" | "md" | "lg";
    isDisabled?: boolean;
    fullWidth?: boolean;
    uppercase?: boolean;
    disabled?: boolean;
    className?: string;
    element?: HTMLButtonElement | null;
    animationIterations?: number;
    onclick?: () => void;
  }>();
  
  // Convert state to runes
  let hasAnimated = $state(false);
  
  // Compute animation iteration count for CSS
  let animationCount = $derived(animationIterations <= 0 ? 'infinite' : animationIterations.toString());

  // Theme-based styles
  const baseThemeClasses = {
    primary: "text-kong-text-on-primary",
    secondary: "text-kong-text-primary",
    success: "text-white",
    error: "text-white",
    warning: "text-kong-text-on-primary",
    "accent-green": "text-kong-text-primary",
    "accent-blue": "text-kong-white",
    "accent-red": "text-kong-white",
    muted: "text-kong-text-inverse/60",
  };

  const solidThemeClasses = {
    primary: "bg-kong-primary hover:bg-kong-primary-hover border-0",
    secondary: "bg-kong-bg-secondary border-0",
    success: "bg-kong-success hover:bg-kong-success-hover border-0",
    error: "bg-red-600 hover:bg-red-700 border-0",
    warning: "bg-kong-warning hover:bg-yellow-500 border-0",
    "accent-green": "bg-kong-success hover:bg-kong-success-hover border-0",
    "accent-blue": "bg-kong-accent-blue hover:bg-kong-accent-blue-hover border-0",
    "accent-red": "bg-kong-error hover:bg-kong-error-hover border-0",
    muted: "bg-white/5 hover:bg-white/10 text-white/90 hover:text-white border-0",
  };

  const outlineThemeClasses = {
    primary: "border border-kong-primary text-kong-text-primary hover:bg-kong-primary/20",
    secondary: "border border-white/10 text-white/90 hover:bg-white/5",
    "accent-green": "border border-kong-success text-kong-success hover:bg-kong-success/10",
    "accent-blue": "border border-kong-accent-blue text-kong-accent-blue hover:bg-kong-accent-blue/10",
    "accent-red": "border border-kong-error text-kong-error hover:bg-kong-error/10",
    success: "border border-kong-success text-kong-success hover:bg-kong-success/10",
    error: "border border-red-600 text-red-500 hover:bg-red-600/10",
    warning: "border border-kong-warning text-kong-warning hover:bg-kong-warning/10",
    muted: "border border-white/10 text-white/50 hover:bg-white/5",
  };

  const transparentThemeClasses = {
    primary: "bg-transparent text-kong-primary hover:bg-kong-primary/10",
    secondary: "bg-transparent text-white/90 hover:bg-white/5",
    "accent-green": "bg-transparent text-kong-success hover:bg-kong-success/10",
    "accent-blue": "bg-transparent text-kong-accent-blue hover:bg-kong-accent-blue/10",
    "accent-red": "bg-transparent text-kong-error hover:bg-kong-error/10",
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
      bg-gradient-to-r from-kong-primary to-kong-primary-hover
      hover:from-kong-primary-hover hover:to-kong-primary
      shadow-lg hover:shadow-xl
      border border-white/10
      transform hover:-translate-y-0.5
      transition-all duration-200
    `,
    secondary: "bg-gradient-to-r from-kong-secondary to-kong-secondary-hover shadow-lg hover:shadow-xl border border-white/10",
    success: "bg-gradient-to-r from-kong-success to-green-500 shadow-lg hover:shadow-xl border border-white/10",
    error: "bg-gradient-to-r from-kong-error to-red-500 shadow-lg hover:shadow-xl border border-white/10",
    warning: "bg-gradient-to-r from-kong-warning to-yellow-500 shadow-lg hover:shadow-xl border border-white/10",
    "accent-green": "bg-gradient-to-r from-kong-success to-kong-success-hover shadow-lg hover:shadow-xl border border-white/10",
    "accent-blue": "bg-gradient-to-r from-kong-accent-blue to-kong-accent-blue-hover shadow-lg hover:shadow-xl border border-white/10",
    "accent-red": "bg-gradient-to-r from-kong-error to-kong-error-hover shadow-lg hover:shadow-xl border border-white/10",
    muted: "bg-gradient-to-r from-white/10 to-white/20 shadow-lg hover:shadow-xl border border-white/10",
  };

  // Use reactive derived variables for theme classes
  let baseThemeClass = $derived(baseThemeClasses[theme]);
  
  let variantClass = $derived(
    variant === 'solid' ? solidThemeClasses[theme] :
    variant === 'outline' ? outlineThemeClasses[theme] :
    variant === 'transparent' ? transparentThemeClasses[theme] :
    shineThemeClasses[theme]
  );
                    
  let sizeClass = $derived(sizeClasses[size]);
  
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
  class="{$panelRoundness} relative overflow-hidden isolate font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed 
    {baseThemeClass} {variantClass} {sizeClass} 
    {fullWidth ? 'w-full' : 'w-auto'} {uppercase ? 'uppercase' : ''} {className}"
  disabled={isDisabled}
  onclick={onclick}
>
  <div class="relative z-10">
    {#if label}
      {label}
    {:else}
      <slot />
    {/if}
  </div>

  {#if variant === "shine" && !isDisabled && (!hasAnimated || animationIterations <= 0)}
    <div class="absolute inset-0 overflow-hidden {$panelRoundness}">
      <div class="shine-effect" style="animation-iteration-count: {animationCount};" onanimationend={handleAnimationEnd}></div>
    </div>
    <div class="absolute inset-0 {$panelRoundness}">
      <div class="ready-glow" style="animation-iteration-count: {animationCount};"></div>
    </div>
  {/if}
</button>

<style>
  button {
    background-clip: padding-box;
    border: none;
    outline: none;
  }
  
  button:focus {
    outline: none;
  }
  
  button::before,
  button::after {
    content: none;
  }
  
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
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(55, 114, 255, 0.3),
      rgba(111, 66, 193, 0.3)
    );
    opacity: 0;
    filter: blur(4px);
    transition: opacity 0.3s ease;
    animation: pulse-glow 2s ease-in-out; /* Removed fixed iteration count */
    pointer-events: none;
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
