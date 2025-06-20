<script lang="ts">
  import { Check, AlertCircle, Loader2 } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';

  // ===== CONSTANTS =====
  const SCALE_VALUES = {
    press: 0.98,
    hover: 1.02,
    normal: 1
  };

  // ===== PROPS =====
  let { 
    text,
    isError,
    isProcessing,
    isLoading,
    disabled,
    onClick,
    priceImpact = null,
    estimatedGas = null,
  } = $props();

  // ===== STATE MANAGEMENT =====
  // Animation tweens
  const buttonScale = tweened(SCALE_VALUES.normal, { duration: 150, easing: cubicOut });
  const pressScale = tweened(SCALE_VALUES.normal, { duration: 75, easing: cubicOut });
  
  // Interaction state
  let interaction = $state({
    isHovered: false,
    isPressed: false
  });
  
  let buttonElement: HTMLButtonElement;

  // ===== COMPUTED VALUES =====
  const isSwapReady = $derived(text === "SWAP" && !disabled && !isProcessing && !isError);
  const showIcon = $derived(getIcon() !== null);
  const Icon = $derived(getIcon());
  const isLoadingState = $derived(isProcessing || isLoading);
  const showPriceImpactWarning = $derived(priceImpact !== null && priceImpact > 2 && !isError && !isProcessing);

  // ===== UI HELPERS =====
  function getIcon() {
    if (isError) return AlertCircle;
    if (isLoadingState) return Loader2;
    return null;
  }
  
  function getAriaLabel(): string {
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
  function handleMouseDown(event: MouseEvent) {
    if (disabled || isProcessing) return;
    
    interaction.isPressed = true;
    pressScale.set(SCALE_VALUES.press);
  }

  function handleMouseUp() {
    interaction.isPressed = false;
    pressScale.set(SCALE_VALUES.normal);
    buttonScale.set(SCALE_VALUES.normal);
  }

  function handleClick(event: MouseEvent) {
    if (disabled || isProcessing) return;
    
    if ('vibrate' in navigator) navigator.vibrate(10);
    
    onClick();
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
  
  function handleMouseEnter() {
    interaction.isHovered = true;
    if (!disabled && !isProcessing) {
      buttonScale.set(SCALE_VALUES.hover);
    }
  }
  
  function handleMouseLeave() {
    interaction = {
      isHovered: false,
      isPressed: false
    };
    buttonScale.set(SCALE_VALUES.normal);
    pressScale.set(SCALE_VALUES.normal);
  }

  // ===== EFFECTS & LIFECYCLE ===== 

  onMount(() => {
    const handleGlobalMouseUp = () => {
      if (interaction.isPressed) handleMouseUp();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  });
</script>


  <button
    bind:this={buttonElement}
    class="swap-button relative w-full px-6 overflow-hidden min-h-[64px] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent group {getButtonStateClass()}"
    class:hover-effect={!disabled && !isProcessing}
    class:pressed={interaction.isPressed}
    style="
      transform: scale({$buttonScale * $pressScale});
    "
    onclick={handleClick}
    onkeydown={handleKeyDown}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    disabled={disabled || isProcessing}
    aria-label={getAriaLabel()}
    aria-busy={isLoadingState}
    aria-disabled={disabled}
    role="button"
    tabindex={disabled ? -1 : 0}
  >
  <!-- Press effect overlay -->
  {#if interaction.isPressed}
    <div class="absolute inset-0 pointer-events-none rounded-[inherit] bg-black/10 transition-opacity duration-75" />
  {/if}

  <!-- Button content -->
  <div class="relative z-10 flex items-center justify-center gap-2 w-full">
    {#if showIcon && Icon}
      <div class="flex-shrink-0">
        <svelte:component this={Icon} class="w-5 h-5 {isError ? 'text-red-300' : ''} {isLoadingState ? 'animate-spin' : ''}" />
      </div>
    {/if}
    
    <span class="font-semibold tracking-wide text-center {getTextSizeClass()}">
      {text}
    </span>
    
    {#if showPriceImpactWarning}
      <span class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-medium">
        {priceImpact?.toFixed(1)}%
      </span>
    {/if}
  </div>
  
  <!-- Progress indicator -->
  {#if isLoadingState}
    <div class="absolute bottom-0 left-0 h-1 bg-kong-text-light/20 rounded-full overflow-hidden w-full">
      <div class="h-full bg-kong-text-light/30 w-full" />
    </div>
  {/if}
</button>

<style>
  /* ===== BASE BUTTON STYLES ===== */
  .swap-button {
    border: 1px solid var(--swap-button-border-color, rgb(var(--ui-border) / 0.3));
    border-radius: var(--swap-button-roundness, 9999px);
    color: var(--swap-button-text-color, rgb(var(--text-light)));
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    /* box-shadow: var(--swap-button-shadow, 0 2px 4px rgba(0, 0, 0, 0.1)); */

    &:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }

  /* Button state backgrounds */
  .button-normal {
    background: linear-gradient(135deg, 
      var(--swap-button-primary-gradient-start, rgb(var(--brand-primary) / 0.95)) 0%, 
      var(--swap-button-primary-gradient-end, rgb(var(--brand-secondary) / 0.95)) 100%);
  }

  .button-ready {
    background: linear-gradient(135deg, 
      var(--swap-button-ready-glow-start, rgb(var(--semantic-success) / 0.95)) 0%, 
      var(--swap-button-ready-glow-end, rgb(var(--semantic-success-hover) / 0.95)) 100%);
    border-color: var(--swap-button-ready-glow-start, rgb(var(--semantic-success) / 0.4));
    box-shadow: var(--swap-button-shadow, none);
  }

  .button-error {
    background: linear-gradient(135deg, 
      var(--swap-button-error-gradient-start, rgb(var(--semantic-error) / 0.9)) 0%, 
      var(--swap-button-error-gradient-end, rgb(var(--semantic-error-hover) / 0.8)) 100%);
    border-color: var(--swap-button-error-gradient-start, rgb(var(--semantic-error) / 0.4));
  }

  .button-processing {
    background: linear-gradient(135deg, 
      var(--swap-button-processing-gradient-start, rgb(var(--semantic-info) / 0.8)) 0%, 
      var(--swap-button-processing-gradient-end, rgb(var(--semantic-info-hover) / 0.6)) 100%);
    border-color: var(--swap-button-processing-gradient-start, rgb(var(--semantic-info) / 0.4));
    cursor: wait;
    opacity: 0.8;
  }

  /* Hover effects */
  .swap-button:hover:not(:disabled) {
    filter: brightness(1.1);
  }


  /* ===== UTILITY CLASSES ===== */
  
  /* ===== BUTTON STATES ===== */
  button:focus {
    --tw-ring-color: rgb(var(--brand-primary) / 0.5);
  }
  
  button.button-error:focus {
    --tw-ring-color: rgb(var(--semantic-error) / 0.5);
  }
  
  button.hover-effect:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: rgba(var(--text-light) / 0.25);
  }
  
  button.pressed {
    transform: scale(0.98) translateY(2px) !important;
    filter: brightness(0.9) !important;
  }
  
  /* ===== TRANSITIONS ===== */
  button {
    transform-origin: center;
    transition: all 150ms ease-out;
  }
</style> 