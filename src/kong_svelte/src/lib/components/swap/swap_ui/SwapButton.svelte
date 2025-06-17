<script lang="ts">
  import { Check, AlertCircle, Loader2 } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';

  // ===== CONSTANTS =====
  const ANIMATION_DURATIONS = {
    buttonScale: 300,
    success: 300,
    glow: 400,
    press: 150,
    ripple: 800,
    pressCallback: 0,
    successFade: 2000
  };

  const SCALE_VALUES = {
    press: 0.99,
    click: 0.99,
    hover: 1.02,
    normal: 1
  };

  const CORNER_POSITIONS = [
    { pos: 'top-0 left-0', border: 'border-t-2 border-l-2', round: 'rounded-tl-lg' },
    { pos: 'top-0 right-0', border: 'border-t-2 border-r-2', round: 'rounded-tr-lg', delayed: true },
    { pos: 'bottom-0 left-0', border: 'border-b-2 border-l-2', round: 'rounded-bl-lg', delayed: true },
    { pos: 'bottom-0 right-0', border: 'border-b-2 border-r-2', round: 'rounded-br-lg' }
  ];

  // ===== PROPS =====
  let { 
    text,
    isError,
    isProcessing,
    isLoading,
    showShineAnimation,
    disabled,
    onClick,
    showSuccessAnimation = false,
    priceImpact = null,
    estimatedGas = null,
  } = $props();

  // ===== STATE MANAGEMENT =====
  // Animation tweens
  const buttonScale = tweened(SCALE_VALUES.normal, { duration: ANIMATION_DURATIONS.buttonScale, easing: cubicOut });
  const successOpacity = tweened(0, { duration: ANIMATION_DURATIONS.success, easing: cubicOut });
  const glowIntensity = tweened(0, { duration: ANIMATION_DURATIONS.glow, easing: cubicOut });
  const pressScale = tweened(SCALE_VALUES.normal, { duration: ANIMATION_DURATIONS.press, easing: cubicOut });
  
  // Interaction state
  let interaction = $state({
    isHovered: false,
    isPressed: false,
    mouseX: 50,
    mouseY: 50
  });
  
  let buttonElement: HTMLButtonElement;
  let ripples = $state<Array<{ x: number; y: number; id: number }>>([]);
  let nextRippleId = 0;

  // ===== COMPUTED VALUES =====
  const isSwapReady = $derived(text === "SWAP" && !disabled && !isProcessing && !isError);
  const showIcon = $derived(getIcon() !== null);
  const Icon = $derived(getIcon());
  const isLoadingState = $derived(isProcessing || isLoading);
  const showPriceImpactWarning = $derived(priceImpact !== null && priceImpact > 2 && !isError && !isProcessing);

  // ===== UI HELPERS =====
  function getIcon() {
    if (showSuccessAnimation) return Check;
    if (isError) return AlertCircle;
    if (isLoadingState) return Loader2;
    return null;
  }
  
  function getAriaLabel(): string {
    if (showSuccessAnimation) return "Swap completed successfully";
    if (isError) return `Error: ${text}`;
    if (isLoadingState) return "Processing swap, please wait";
    if (disabled) return `${text} - button disabled`;
    return text;
  }

  function getTextSizeClass() {
    return text.length > 20 ? 'text-lg' : 'text-xl';
  }

  // Get button state class
  function getButtonStateClass() {
    if (isError) return 'button-error';
    if (isLoadingState) return 'button-processing';
    if (isSwapReady) return 'button-ready';
    return 'button-normal';
  }

  // ===== INTERACTION HANDLERS =====
  function updateMousePosition(event: MouseEvent) {
    if (!buttonElement) return;
    const rect = buttonElement.getBoundingClientRect();
    interaction.mouseX = ((event.clientX - rect.left) / rect.width) * 100;
    interaction.mouseY = ((event.clientY - rect.top) / rect.height) * 100;
  }

  function handleMouseDown(event: MouseEvent) {
    if (disabled || isProcessing) return;
    
    interaction.isPressed = true;
    pressScale.set(SCALE_VALUES.press);
    buttonScale.set(SCALE_VALUES.click);
    updateMousePosition(event);
  }

  function handleMouseUp() {
    interaction.isPressed = false;
    pressScale.set(SCALE_VALUES.normal);
    buttonScale.set(SCALE_VALUES.normal);
  }

  function handleClick(event: MouseEvent) {
    if (disabled || isProcessing) return;
    
    const rect = buttonElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    addRipple(x, y);
    
    if ('vibrate' in navigator) navigator.vibrate(10);
    
    setTimeout(onClick, ANIMATION_DURATIONS.pressCallback);
  }

  function addRipple(x: number, y: number) {
    const id = nextRippleId++;
    ripples = [...ripples, { x, y, id }];
    
    setTimeout(() => {
      ripples = ripples.filter(r => r.id !== id);
    }, ANIMATION_DURATIONS.ripple);
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled && !isProcessing) {
      event.preventDefault();
      const rect = buttonElement.getBoundingClientRect();
      const mockEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      handleClick(mockEvent as MouseEvent);
    }
  }
  
  function handleMouseMove(event: MouseEvent) {
    if (!disabled) updateMousePosition(event);
  }
  
  function handleMouseEnter() {
    interaction.isHovered = true;
    if (!disabled && !isProcessing) {
      glowIntensity.set(1);
      buttonScale.set(SCALE_VALUES.hover);
    }
  }
  
  function handleMouseLeave() {
    interaction = {
      isHovered: false,
      isPressed: false,
      mouseX: 50,
      mouseY: 50
    };
    glowIntensity.set(0);
    buttonScale.set(SCALE_VALUES.normal);
    pressScale.set(SCALE_VALUES.normal);
  }

  // ===== EFFECTS & LIFECYCLE =====
  $effect(() => {
    if (showSuccessAnimation) {
      successOpacity.set(1);
      setTimeout(() => successOpacity.set(0), ANIMATION_DURATIONS.successFade);
    }
  });

  onMount(() => {
    const handleGlobalMouseUp = () => {
      if (interaction.isPressed) handleMouseUp();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  });
</script>

<!-- ===== SNIPPETS ===== -->
{#snippet rippleEffect(ripple: { x: number, y: number, id: number })}
  <div 
    class="absolute pointer-events-none animate-ripple"
    style="left: {ripple.x}%; top: {ripple.y}%; transform: translate(-50%, -50%);"
  >
    <div class="w-full h-full rounded-full {isSwapReady ? 'bg-kong-success/30' : 'bg-white/30'}"></div>
  </div>
{/snippet}

{#snippet cornerAccent(corner: typeof CORNER_POSITIONS[0])}
  <div class="absolute {corner.pos} w-8 h-8">
    <div class="absolute {corner.pos} w-full h-full {corner.border} {corner.round} {corner.delayed ? 'animate-corner-pulse-delayed' : 'animate-corner-pulse'}"
         style="border-color: {isSwapReady ? 'rgb(var(--semantic-success) / 0.8)' : 'rgb(var(--semantic-success) / 0.6)'};" />
  </div>
{/snippet}

{#snippet orbitalParticle(position: string, animationClass: string)}
  <div class="absolute {position}">
    <div class="w-full h-full rounded-full bg-gradient-to-r from-kong-success to-kong-success-hover blur-sm {animationClass}"></div>
  </div>
{/snippet}

  <button
    bind:this={buttonElement}
    class="swap-button relative w-full px-6 overflow-hidden shadow-md min-h-[64px] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent group backdrop-blur-sm {getButtonStateClass()}"
    class:transition-fast={interaction.isPressed}
    class:transition-normal={!interaction.isPressed}
    class:animate-pulse={isLoadingState}
    class:hover-effect={!disabled && !isProcessing}
    class:pressed={interaction.isPressed}
    class:swap-ready={isSwapReady}
    style="
      transform: scale({$buttonScale * $pressScale});
      --mouse-x: {interaction.mouseX}%;
      --mouse-y: {interaction.mouseY}%;
      --glow-intensity: {$glowIntensity};
    "
    onclick={handleClick}
    onkeydown={handleKeyDown}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    onmousemove={handleMouseMove}
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    disabled={disabled || isProcessing}
    aria-label={getAriaLabel()}
    aria-busy={isLoadingState}
    aria-disabled={disabled}
    role="button"
    tabindex={disabled ? -1 : 0}
  >
  <!-- Ripple effects -->
  {#each ripples as ripple (ripple.id)}
    {@render rippleEffect(ripple)}
  {/each}

  <!-- Press effect overlay -->
  {#if interaction.isPressed}
    <div class="absolute inset-0 pointer-events-none rounded-[inherit] bg-black/30 transition-opacity duration-75" />
    <div 
      class="absolute inset-0 pointer-events-none rounded-[inherit] animate-press-wave"
      style="background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), {isSwapReady ? 'rgba(0, 214, 143, 0.5)' : 'rgba(255, 255, 255, 0.4)'}, transparent 70%);"
    />
  {/if}

  <!-- Button content -->
  <div class="relative z-10 flex items-center justify-center gap-2 w-full">
    {#if showIcon && Icon}
      <div class="flex-shrink-0" class:animate-spin={isLoadingState}>
        <svelte:component this={Icon} class="w-5 h-5 {showSuccessAnimation ? 'text-green-300' : isError ? 'text-red-300' : ''}" />
      </div>
    {/if}
    
    <span 
      class="font-semibold tracking-wide flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-200 {getTextSizeClass()}"
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
    
    {#if showPriceImpactWarning}
      <span class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-medium">
        {priceImpact?.toFixed(1)}%
      </span>
    {/if}
  </div>
  
  <!-- Hover glow effect -->
  <div 
    class="glow-effect absolute inset-0 transition-all duration-500 pointer-events-none rounded-[inherit]" 
    style="
      opacity: calc(var(--glow-intensity) * 0.6);
      transform: scale({interaction.isHovered && !disabled ? 1.05 : 1});
    "
  />
  
  <!-- Dynamic gradient layer -->
  {#if interaction.isHovered && !disabled && !isError}
    <div
      class="gradient-layer absolute inset-0 transition-opacity duration-300 pointer-events-none rounded-[inherit]"
    />
  {/if}
  
  <!-- SWAP ready state animations -->
  {#if isSwapReady}
    <!-- Orbital particles -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      <div class="absolute inset-0 animate-rotate-slow">
        {@render orbitalParticle('top-0 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2', 'animate-pulse-glow')}
        {@render orbitalParticle('bottom-0 right-1/2 w-2 h-2 translate-x-1/2 translate-y-1/2', 'animate-pulse-glow-delayed')}
      </div>
      
      <!-- Energy field -->
      <div class="absolute inset-0 opacity-30">
        <div class="absolute inset-0 bg-gradient-conic from-transparent via-kong-success/20 to-transparent animate-rotate-slow"></div>
      </div>
    </div>
    
    <!-- Breathing edge glow -->
    <div class="absolute inset-0 rounded-[inherit] pointer-events-none">
      <div class="absolute inset-0 animate-breathe ready-glow" />
      
      <!-- Corner accents -->
      {#each CORNER_POSITIONS as corner}
        {@render cornerAccent(corner)}
      {/each}
    </div>
  {/if}
  
  <!-- Liquid morph effect -->
  {#if interaction.isHovered && !disabled && !isProcessing}
    <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      <div class="liquid-morph absolute inset-0 opacity-40"></div>
    </div>
  {/if}
  
  <!-- Progress indicator -->
  {#if isLoadingState}
    <div class="absolute bottom-0 left-0 h-1 bg-white/20 rounded-full overflow-hidden w-full">
      <div class="h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer w-full" />
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
  /* ===== BASE BUTTON STYLES ===== */
  .swap-button {
    border: 1px solid rgb(var(--ui-border) / 0.3);
    border-radius: var(--swap-button-roundness, 9999px);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* Button state backgrounds */
  .button-normal {
    background: linear-gradient(135deg, 
      rgb(var(--brand-primary) / 0.95) 0%, 
      rgb(var(--brand-secondary) / 0.95) 100%);
  }

  .button-ready {
    background: linear-gradient(135deg, 
      rgb(var(--semantic-success) / 0.95) 0%, 
      rgb(var(--semantic-success-hover) / 0.95) 100%);
    border-color: rgb(var(--semantic-success) / 0.4);
    box-shadow: 0 0 20px rgba(var(--semantic-success) / 0.2), 0 8px 32px rgba(0, 0, 0, 0.32);
  }

  .button-error {
    background: linear-gradient(135deg, 
      rgb(var(--semantic-error) / 0.9) 0%, 
      rgb(var(--semantic-error-hover) / 0.8) 100%);
    border-color: rgb(var(--semantic-error) / 0.4);
  }

  .button-processing {
    background: linear-gradient(135deg, 
      rgb(var(--semantic-info) / 0.8) 0%, 
      rgb(var(--semantic-info-hover) / 0.6) 100%);
    border-color: rgb(var(--semantic-info) / 0.4);
    cursor: wait;
    opacity: 0.8;
  }

  /* Hover effects */
  .swap-button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .swap-button.button-ready:hover:not(:disabled) {
    box-shadow: 0 0 30px rgba(var(--semantic-success) / 0.3), 0 12px 40px rgba(0, 0, 0, 0.4);
  }

  /* Glow effect */
  .glow-effect {
    background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), 
      rgba(255, 255, 255, 0.2), transparent 40%);
  }

  .button-ready .glow-effect {
    background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), 
      rgba(var(--semantic-success) / 0.3), transparent 40%);
  }

  /* Gradient layer */
  .gradient-layer {
    background: radial-gradient(
      circle at var(--mouse-x) var(--mouse-y),
      rgba(var(--brand-primary) / 0.3),
      transparent 50%
    );
    opacity: 0.5;
  }

  /* Ready state glow */
  .ready-glow {
    background: radial-gradient(ellipse at center, 
      transparent 30%, 
      rgba(var(--semantic-success) / 0.2) 70%, 
      transparent 71%);
    filter: blur(10px);
  }

  /* ===== LIQUID MORPH EFFECT ===== */
  .liquid-morph {
    animation: liquid-morph 6s ease-in-out infinite;
    will-change: border-radius, background;
  }

  .swap-ready .liquid-morph {
    background: radial-gradient(circle at 30% 30%, rgba(0, 214, 143, 0.3), transparent 40%),
                radial-gradient(circle at 70% 70%, rgba(0, 183, 122, 0.3), transparent 40%);
  }

  /* ===== ANIMATION KEYFRAMES ===== */
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

  @keyframes swap-text-bounce-glow {
    0%, 100% {
      transform: translateY(0) scale(1);
      filter: brightness(1);
    }
    50% {
      transform: translateY(-1px) scale(1.02);
      filter: brightness(1.1);
    }
  }

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
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
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
  
  /* ===== ANIMATION CLASSES ===== */
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
  
  .swap-text-animate {
    animation: swap-text-bounce-glow 3s ease-in-out infinite;
    will-change: transform, filter;
  }

  .animate-shimmer {
    animation: shimmer 1.5s infinite;
  }
  
  .animate-ripple {
    animation: ripple 0.8s ease-out;
  }
  
  .animate-ripple > div {
    animation: ripple 0.8s ease-out;
  }
  
  .animate-success-pop {
    animation: success-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  
  /* ===== UTILITY CLASSES ===== */
  .bg-gradient-conic {
    background: conic-gradient(from 0deg, var(--tw-gradient-stops));
  }
  
  /* ===== BUTTON STATES ===== */
  button:focus {
    --tw-ring-color: rgb(var(--brand-primary) / 0.5);
  }
  
  button.button-error:focus {
    --tw-ring-color: rgb(var(--semantic-error) / 0.5);
  }
  
  button.hover-effect:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.25);
  }
  
  button.pressed {
    transform: scale(0.92) translateY(2px) !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5) !important;
    filter: brightness(0.9) !important;
  }
  
  /* ===== TRANSITIONS ===== */
  button {
    transform-origin: center;
    will-change: transform, box-shadow;
  }
  
  .transition-fast {
    transition: all 75ms ease-out;
  }
  
  .transition-normal {
    transition: all 300ms ease-out;
  }
</style> 