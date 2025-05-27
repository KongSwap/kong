<script lang="ts">
  import { themeStore } from '$lib/stores/themeStore';
  import type { ThemeColors } from '$lib/themes/baseTheme';
  import { getThemeById } from '$lib/themes/themeRegistry';
  import { panelRoundness } from '$lib/stores/derivedThemeStore';
  import { Check, AlertCircle, Loader2 } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';

  // Props
  let { 
    text,
    isError,
    isProcessing,
    isLoading,
    showShineAnimation,
    disabled,
    onClick,
    // New props for enhanced functionality
    showSuccessAnimation = false,
    priceImpact = null,
    estimatedGas = null,
    // Theme props - only used if theme values aren't available
    primaryGradientStart,
    primaryGradientEnd,
    errorGradientStart,
    errorGradientEnd,
    processingGradientStart,
    processingGradientEnd,
    borderColor,
    glowColor,
    shine,
    readyGlowStart,
    readyGlowEnd
  } = $props<{
    text: string;
    isError: boolean;
    isProcessing: boolean;
    isLoading: boolean;
    showShineAnimation: boolean;
    disabled: boolean;
    onClick: () => void;
    // New props
    showSuccessAnimation?: boolean;
    priceImpact?: number | null;
    estimatedGas?: string | null;
    // Optional theme props as fallbacks
    primaryGradientStart?: string;
    primaryGradientEnd?: string;
    errorGradientStart?: string;
    errorGradientEnd?: string;
    processingGradientStart?: string;
    processingGradientEnd?: string;
    borderColor?: string;
    glowColor?: string;
    shine?: string;
    readyGlowStart?: string;
    readyGlowEnd?: string;
  }>();

  // Animation states
  const buttonScale = tweened(1, { duration: 200, easing: cubicOut });
  const successOpacity = tweened(0, { duration: 300, easing: cubicOut });
  const glowIntensity = tweened(0, { duration: 400, easing: cubicOut });
  const progressWidth = tweened(0, { duration: 300, easing: cubicOut });
  const pressScale = tweened(1, { duration: 150, easing: cubicOut });
  
  // Track hover state for enhanced effects
  let isHovered = false;
  let isPressed = false;
  let buttonElement: HTMLButtonElement;
  
  // Ripple effect state
  let ripples: Array<{ x: number; y: number; id: number }> = [];
  let nextRippleId = 0;
  
  // Track mouse position for gradient follow effect
  let mouseX = 50;
  let mouseY = 50;

  // Check if button should show success state (when text is "SWAP")
  const isSwapReady = $derived(text === "SWAP" && !disabled && !isProcessing && !isError);

  // Get current theme - using function approach to prevent reactive loops
  function getCurrentTheme() {
    return getThemeById($themeStore);
  }

  function getThemeColors(): ThemeColors {
    return getCurrentTheme().colors as ThemeColors;
  }
  
  function getPrimaryGradientStart(): string {
    // Use success color for SWAP state
    if (isSwapReady) {
      return getThemeColors().success || "#00D68F";
    }
    return getThemeColors().swapButtonPrimaryGradientStart || 
           primaryGradientStart || 
           "rgba(55, 114, 255, 0.95)";
  }
  
  function getPrimaryGradientEnd(): string {
    // Use success hover color for SWAP state
    if (isSwapReady) {
      return getThemeColors().successHover || "#00B778";
    }
    return getThemeColors().swapButtonPrimaryGradientEnd || 
           primaryGradientEnd || 
           "rgba(111, 66, 193, 0.95)";
  }

  function getErrorGradientStart(): string {
    return getThemeColors().swapButtonErrorGradientStart || 
           errorGradientStart || 
           "rgba(239, 68, 68, 0.9)";
  }
  
  function getErrorGradientEnd(): string {
    return getThemeColors().swapButtonErrorGradientEnd || 
           errorGradientEnd || 
           "rgba(239, 68, 68, 0.8)";
  }
  
  function getProcessingGradientStart(): string {
    return getThemeColors().swapButtonProcessingGradientStart || 
           processingGradientStart || 
           "#3772ff";
  }
  
  function getProcessingGradientEnd(): string {
    return getThemeColors().swapButtonProcessingGradientEnd || 
           processingGradientEnd || 
           "#4580ff";
  }
  
  function getBorderColor(): string {
    // Use success color for border when in SWAP state
    if (isSwapReady) {
      return `${getThemeColors().success}40` || "rgba(0, 214, 143, 0.25)";
    }
    return getThemeColors().swapButtonBorderColor || 
           borderColor || 
           "rgba(255, 255, 255, 0.12)";
  }
  
  function getGlowColor(): string {
    // Use success glow for SWAP state
    if (isSwapReady) {
      return `${getThemeColors().success}30` || "rgba(0, 214, 143, 0.3)";
    }
    return getThemeColors().swapButtonGlowColor || 
           glowColor || 
           "rgba(255, 255, 255, 0.2)";
  }
  
  function getShineColor(): string {
    return getThemeColors().swapButtonShineColor || 
           shine || 
           "rgba(255, 255, 255, 0.2)";
  }
  
  function getReadyGlowStart(): string {
    return getThemeColors().swapButtonReadyGlowStart || 
           readyGlowStart || 
           "rgba(55, 114, 255, 0.5)";
  }
  
  function getReadyGlowEnd(): string {
    return getThemeColors().swapButtonReadyGlowEnd || 
           readyGlowEnd || 
           "rgba(111, 66, 193, 0.5)";
  }
  
  function getTextColor(): string {
    return getThemeColors().swapButtonTextColor || "#FFFFFF";
  }
  
  function getRoundness(): string {
    return getThemeColors().swapButtonRoundness || $panelRoundness || "rounded-lg";
  }
  
  function getShadow(): string {
    return getThemeColors().swapButtonShadow || "0 8px 32px rgba(0, 0, 0, 0.32)";
  }

  // Generate dynamic style strings
  function getNormalStyle(): string {
    const brightness = isHovered && !disabled ? 'brightness(1.1)' : 'brightness(1)';
    return `background: linear-gradient(135deg, ${getPrimaryGradientStart()} 0%, ${getPrimaryGradientEnd()} 100%); border-color: ${getBorderColor()}; box-shadow: ${getShadow()}; filter: ${brightness};`;
  }
  
  function getErrorStyle(): string {
    return `background: linear-gradient(135deg, ${getErrorGradientStart()} 0%, ${getErrorGradientEnd()} 100%); border-color: ${getBorderColor()}; box-shadow: none; opacity: 1;`;
  }
  
  function getProcessingStyle(): string {
    return `background: linear-gradient(135deg, ${getProcessingGradientStart()} 0%, ${getProcessingGradientEnd()} 100%); border-color: ${getBorderColor()}; cursor: wait; opacity: 0.8;`;
  }

  // Handle mouse down for press effect
  function handleMouseDown(event: MouseEvent) {
    if (!disabled && !isProcessing) {
      isPressed = true;
      pressScale.set(0.92); // More pronounced press effect
      buttonScale.set(0.96); // Add immediate scale effect
      
      // Update mouse position for press effect
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        mouseX = ((event.clientX - rect.left) / rect.width) * 100;
        mouseY = ((event.clientY - rect.top) / rect.height) * 100;
      }
    }
  }

  // Handle mouse up
  function handleMouseUp() {
    isPressed = false;
    pressScale.set(1);
    buttonScale.set(1);
  }

  // Handle click with ripple effect
  function handleClick(event: MouseEvent) {
    if (disabled || isProcessing) return;
    
    // Create ripple effect
    const rect = buttonElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    ripples = [...ripples, { x, y, id: nextRippleId++ }];
    
    // Remove ripple after animation
    setTimeout(() => {
      ripples = ripples.filter(r => r.id !== nextRippleId - 1);
    }, 800);
    
    // Haptic-like feedback for better UX
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    // Delay the onClick callback to show the press effect first
    setTimeout(() => {
      onClick();
    }, 180); // Slightly longer to ensure effect is visible
  }
  
  // Success animation
  $effect(() => {
    if (showSuccessAnimation) {
      successOpacity.set(1);
      setTimeout(() => successOpacity.set(0), 2000);
    }
  });
  
  // Get icon based on state
  function getIcon() {
    if (showSuccessAnimation) return Check;
    if (isError) return AlertCircle;
    if (isProcessing || isLoading) return Loader2;
    return null;
  }
  
  // Determine if we should show the icon
  const showIcon = $derived(getIcon() !== null);
  const Icon = $derived(getIcon());
  
  // Get ARIA label based on state
  function getAriaLabel(): string {
    if (showSuccessAnimation) return "Swap completed successfully";
    if (isError) return `Error: ${text}`;
    if (isProcessing || isLoading) return "Processing swap, please wait";
    if (disabled) return `${text} - button disabled`;
    return text;
  }
  
  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && !isProcessing) {
        // Simulate click at center for ripple effect
        const rect = buttonElement.getBoundingClientRect();
        const mockEvent = new MouseEvent('click', {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        handleClick(mockEvent as MouseEvent);
      }
    }
  }
  
  // Track mouse movement for dynamic gradient
  function handleMouseMove(event: MouseEvent) {
    if (!buttonElement || disabled) return;
    
    const rect = buttonElement.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 100;
    mouseY = ((event.clientY - rect.top) / rect.height) * 100;
  }
  
  // Enhanced hover effects
  function handleMouseEnter() {
    isHovered = true;
    if (!disabled && !isProcessing) {
      glowIntensity.set(1);
      buttonScale.set(1.02);
    }
  }
  
  function handleMouseLeave() {
    isHovered = false;
    isPressed = false;
    glowIntensity.set(0);
    buttonScale.set(1);
    pressScale.set(1);
    mouseX = 50;
    mouseY = 50;
  }

  // Global mouse up handler to catch mouse up outside button
  onMount(() => {
    const handleGlobalMouseUp = () => {
      if (isPressed) {
        handleMouseUp();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  });
</script>

<button
  bind:this={buttonElement}
  class="relative w-full px-6 overflow-hidden border shadow-md min-h-[64px] disabled:opacity-50 disabled:cursor-not-allowed {getRoundness()} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent group backdrop-blur-sm"
  class:transition-fast={isPressed}
  class:transition-normal={!isPressed}
  style="
    {isError ? getErrorStyle() : (isProcessing || isLoading) ? getProcessingStyle() : getNormalStyle()}
    transform: scale({$buttonScale * $pressScale});
    --mouse-x: {mouseX}%;
    --mouse-y: {mouseY}%;
    --glow-intensity: {$glowIntensity};
    --success-color: {getThemeColors().success || '#00D68F'};
    --success-hover: {getThemeColors().successHover || '#00B778'};
  "
  class:animate-pulse={isProcessing || isLoading}
  class:focus-error={isError}
  class:hover-effect={!disabled && !isProcessing}
  class:pressed={isPressed}
  class:swap-ready={isSwapReady}
  on:click={handleClick}
  on:keydown={handleKeyDown}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:mousemove={handleMouseMove}
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  disabled={disabled || isProcessing}
  aria-label={getAriaLabel()}
  aria-busy={isProcessing || isLoading}
  aria-disabled={disabled}
  role="button"
  tabindex={disabled ? -1 : 0}
>
  <!-- Ripple effects -->
  {#each ripples as ripple (ripple.id)}
    <div 
      class="absolute pointer-events-none animate-ripple"
      style="left: {ripple.x}%; top: {ripple.y}%; transform: translate(-50%, -50%);"
    >
      <div class="w-full h-full rounded-full {isSwapReady ? 'bg-kong-success/30' : 'bg-white/30'}"></div>
    </div>
  {/each}

  <!-- Press effect overlay -->
  {#if isPressed}
    <!-- Dark overlay for immediate feedback -->
    <div 
      class="absolute inset-0 pointer-events-none rounded-[inherit] bg-black/30 transition-opacity duration-75"
      style="opacity: 1;"
    />
    <!-- Animated wave effect -->
    <div 
      class="absolute inset-0 pointer-events-none rounded-[inherit] animate-press-wave"
      style="background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), {isSwapReady ? 'rgba(0, 214, 143, 0.5)' : 'rgba(255, 255, 255, 0.4)'}, transparent 70%);"
    />
  {/if}

  <div class="relative z-10 flex items-center justify-center gap-2 w-full">
    {#if showIcon && Icon}
      <div class="flex-shrink-0" class:animate-spin={isProcessing || isLoading}>
        {#if showSuccessAnimation}
          <Check class="w-5 h-5 text-green-300" />
        {:else if isError}
          <AlertCircle class="w-5 h-5 text-red-300" />
        {:else if isProcessing || isLoading}
          <Loader2 class="w-5 h-5 animate-spin" />
        {/if}
      </div>
    {/if}
    
    <span 
      class="font-semibold tracking-wide flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-200" 
      style="color: {getTextColor()}; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);"
      class:text-lg={text.length > 20}
      class:text-xl={text.length <= 20}
      class:swap-text-animate={isSwapReady}
    >
      <span class="relative">
        {text}
        {#if isSwapReady}
          <span class="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs opacity-70 whitespace-nowrap">
            Press to execute
          </span>
        {/if}
      </span>
    </span>
    
    {#if priceImpact !== null && priceImpact > 2 && !isError && !isProcessing}
      <span class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-medium">
        {priceImpact.toFixed(1)}%
      </span>
    {/if}
  </div>
  
  <!-- Enhanced hover glow effect with mouse tracking -->
  <div 
    class="absolute inset-0 transition-all duration-500 pointer-events-none rounded-[inherit]" 
    style="
      background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), {getGlowColor()}, transparent 40%);
      opacity: calc(var(--glow-intensity) * 0.6);
      transform: scale({isHovered && !disabled ? 1.05 : 1});
    "
  />
  
  <!-- Additional dynamic gradient layer -->
  <div
    class="absolute inset-0 transition-opacity duration-300 pointer-events-none rounded-[inherit]"
    style="
      background: radial-gradient(
        circle at var(--mouse-x) var(--mouse-y),
        {getPrimaryGradientStart()}33,
        transparent 50%
      );
      opacity: {isHovered && !disabled && !isError ? 0.5 : 0};
    "
  />
  
  <!-- Unique animation: Orbital particles for SWAP ready state -->
  {#if isSwapReady}
    <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      <!-- Orbiting energy particles -->
      <div class="absolute inset-0 animate-rotate-slow">
        <div class="absolute top-0 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2">
          <div class="w-full h-full rounded-full bg-gradient-to-r from-kong-success to-kong-success-hover blur-sm animate-pulse-glow"></div>
        </div>
        <div class="absolute bottom-0 right-1/2 w-2 h-2 translate-x-1/2 translate-y-1/2">
          <div class="w-full h-full rounded-full bg-gradient-to-r from-kong-success-hover to-kong-success blur-sm animate-pulse-glow-delayed"></div>
        </div>
      </div>
      
      <!-- Energy field effect -->
      <div class="absolute inset-0 opacity-30">
        <div class="absolute inset-0 bg-gradient-conic from-transparent via-kong-success/20 to-transparent animate-rotate-slow"></div>
      </div>
    </div>
  {/if}
  
  <!-- Liquid morph effect for hover -->
  {#if isHovered && !disabled && !isProcessing}
    <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      <div class="liquid-morph absolute inset-0 opacity-40"></div>
    </div>
  {/if}
  
  <!-- Unique ready state: Breathing edge glow -->
  {#if isSwapReady}
    <div class="absolute inset-0 rounded-[inherit] pointer-events-none">
      <!-- Breathing glow effect -->
      <div class="absolute inset-0 animate-breathe"
           style="
             background: radial-gradient(ellipse at center, transparent 30%, var(--success-color, #00D68F)20 70%, transparent 71%);
             filter: blur(10px);
           " />
      
      <!-- Corner accents -->
      <div class="absolute top-0 left-0 w-8 h-8">
        <div class="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 rounded-tl-lg animate-corner-pulse"
             style="border-color: var(--success-color, #00D68F);" />
      </div>
      <div class="absolute top-0 right-0 w-8 h-8">
        <div class="absolute top-0 right-0 w-full h-full border-t-2 border-r-2 rounded-tr-lg animate-corner-pulse-delayed"
             style="border-color: var(--success-hover, #00B778);" />
      </div>
      <div class="absolute bottom-0 left-0 w-8 h-8">
        <div class="absolute bottom-0 left-0 w-full h-full border-b-2 border-l-2 rounded-bl-lg animate-corner-pulse-delayed"
             style="border-color: var(--success-hover, #00B778);" />
      </div>
      <div class="absolute bottom-0 right-0 w-8 h-8">
        <div class="absolute bottom-0 right-0 w-full h-full border-b-2 border-r-2 rounded-br-lg animate-corner-pulse"
             style="border-color: var(--success-color, #00D68F);" />
      </div>
    </div>
  {/if}
  
  <!-- Progress indicator for processing state -->
  {#if isProcessing || isLoading}
    <div class="absolute bottom-0 left-0 h-1 bg-white/20 rounded-full overflow-hidden w-full">
      <div 
        class="h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"
        style="width: 100%;"
      />
    </div>
  {/if}
  
  <!-- Success overlay -->
  {#if $successOpacity > 0}
    <div 
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
      style="opacity: {$successOpacity}"
    >
      <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center animate-success-pop">
        <Check class="w-8 h-8 text-green-400" />
      </div>
    </div>
  {/if}
</button>

<style>
  /* Unique animations */
  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      opacity: 0.4;
      transform: scale(1);
      filter: blur(2px);
    }
    50% { 
      opacity: 1;
      transform: scale(1.5);
      filter: blur(3px);
    }
  }
  
  @keyframes pulse-glow-delayed {
    0%, 100% { 
      opacity: 0.4;
      transform: scale(1);
      filter: blur(2px);
    }
    50% { 
      opacity: 1;
      transform: scale(1.5);
      filter: blur(3px);
    }
  }
  
  @keyframes liquid-morph {
    0%, 100% {
      border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
      background: radial-gradient(circle at 30% 30%, rgba(0, 214, 143, 0.3), transparent 40%),
                  radial-gradient(circle at 70% 70%, rgba(0, 183, 122, 0.3), transparent 40%);
    }
    33% {
      border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
      background: radial-gradient(circle at 50% 20%, rgba(0, 214, 143, 0.3), transparent 40%),
                  radial-gradient(circle at 80% 50%, rgba(0, 183, 122, 0.3), transparent 40%);
    }
    66% {
      border-radius: 70% 30% 50% 50% / 30% 80% 70% 40%;
      background: radial-gradient(circle at 20% 80%, rgba(0, 214, 143, 0.3), transparent 40%),
                  radial-gradient(circle at 60% 60%, rgba(0, 183, 122, 0.3), transparent 40%);
    }
  }
  
  @keyframes breathe {
    0%, 100% { 
      opacity: 0.3;
      transform: scale(0.95);
    }
    50% { 
      opacity: 0.7;
      transform: scale(1.05);
    }
  }
  
  @keyframes corner-pulse {
    0%, 100% { 
      opacity: 0.3;
      transform: scale(1);
    }
    50% { 
      opacity: 1;
      transform: scale(1.1);
    }
  }
  
  @keyframes corner-pulse-delayed {
    0%, 100% { 
      opacity: 0.3;
      transform: scale(1);
    }
    50% { 
      opacity: 1;
      transform: scale(1.1);
    }
  }
  
  @keyframes press-wave {
    0% {
      transform: scale(0.5);
      opacity: 1;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }
  
  /* Animation classes */
  .animate-rotate-slow {
    animation: rotate-slow 8s linear infinite;
  }
  
  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
  
  .animate-pulse-glow-delayed {
    animation: pulse-glow-delayed 2s ease-in-out infinite;
    animation-delay: 1s;
  }
  
  .liquid-morph {
    animation: liquid-morph 6s ease-in-out infinite;
    will-change: border-radius, background;
  }
  
  /* For SWAP ready state */
  .swap-ready .liquid-morph {
    background: radial-gradient(circle at 30% 30%, rgba(0, 214, 143, 0.3), transparent 40%),
                radial-gradient(circle at 70% 70%, rgba(0, 183, 122, 0.3), transparent 40%);
  }
  
  .animate-breathe {
    animation: breathe 3s ease-in-out infinite;
  }
  
  .animate-corner-pulse {
    animation: corner-pulse 2s ease-in-out infinite;
  }
  
  .animate-corner-pulse-delayed {
    animation: corner-pulse-delayed 2s ease-in-out infinite;
    animation-delay: 1s;
  }
  
  .animate-press-wave {
    animation: press-wave 0.3s ease-out forwards;
  }
  
  /* Gradient conic for energy field - Tailwind doesn't support this yet */
  .bg-gradient-conic {
    background: conic-gradient(from 0deg, var(--tw-gradient-stops));
  }

  @keyframes swap-text-bounce-glow {
    0%, 100% {
      transform: translateY(0) scale(1);
      filter: brightness(1);
      text-shadow: 0 1px 8px rgba(0, 214, 143, 0.15), 0 1px 1px rgba(0,0,0,0.1);
    }
    50% {
      transform: translateY(-1px) scale(1.02);
      filter: brightness(1.1);
      text-shadow: 0 2px 12px rgba(0, 214, 143, 0.25), 0 1px 1px rgba(0,0,0,0.1);
    }
  }
  .swap-text-animate {
    animation: swap-text-bounce-glow 3s ease-in-out infinite;
    will-change: transform, filter, text-shadow;
  }

  /* New animations */
  @keyframes ripple {
    0% {
      width: 10px;
      height: 10px;
      opacity: 0.8;
    }
    100% {
      width: 300px;
      height: 300px;
      opacity: 0;
    }
  }
  
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  @keyframes success-pop {
    0% {
      transform: scale(0) rotate(-45deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.2) rotate(5deg);
      opacity: 1;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
  
  .animate-shimmer {
    animation: shimmer 1.5s infinite;
  }
  
  .animate-ripple {
    animation: ripple 0.8s ease-out;
  }
  
  .animate-ripple > div {
    width: 10px;
    height: 10px;
    animation: ripple 0.8s ease-out;
  }
  
  .animate-success-pop {
    animation: success-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  
  /* Focus ring styles */
  button:focus {
    ring-color: var(--primary-color, #3B82F6);
  }
  
  button.focus-error:focus {
    ring-color: var(--error-color, #F43F5E);
  }
  
  /* Hover and active states */
  button.hover-effect {
    transform: translateY(0);
  }
  
  button.hover-effect:hover:not(:disabled) {
    transform: translateY(-2px) !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4) !important;
    border-color: rgba(255, 255, 255, 0.25) !important;
  }
  
  /* Enhanced pressed state */
  button.pressed {
    transform: scale(0.92) translateY(2px) !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5) !important;
    filter: brightness(0.9) !important;
  }
  
  /* SWAP ready state specific styling */
  button.swap-ready {
    box-shadow: 
      0 0 20px rgba(0, 214, 143, 0.2),
      0 8px 32px rgba(0, 0, 0, 0.32) !important;
  }
  
  button.swap-ready:hover:not(:disabled) {
    box-shadow: 
      0 0 30px rgba(0, 214, 143, 0.3),
      0 12px 40px rgba(0, 0, 0, 0.4) !important;
  }
  
  /* Ensure transitions work smoothly */
  button {
    transform-origin: center;
    will-change: transform, box-shadow;
  }
  
  /* Fast transition for press effect */
  .transition-fast {
    transition: all 75ms ease-out !important;
  }
  
  /* Normal transition for other states */
  .transition-normal {
    transition: all 300ms ease-out;
  }
</style> 