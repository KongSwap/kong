<script lang="ts">
  import { themeStore } from '$lib/stores/themeStore';
  import type { ThemeColors } from '$lib/themes/baseTheme';
  import { getThemeById } from '$lib/themes/themeRegistry';

  // Props
  let { 
    text,
    isError,
    isProcessing,
    isLoading,
    showShineAnimation,
    disabled,
    onClick,
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

  // Get current theme - using function approach to prevent reactive loops
  function getCurrentTheme() {
    return getThemeById($themeStore);
  }

  function getThemeColors(): ThemeColors {
    return getCurrentTheme().colors as ThemeColors;
  }
  
  function getPrimaryGradientStart(): string {
    return getThemeColors().swapButtonPrimaryGradientStart || 
           primaryGradientStart || 
           "rgba(55, 114, 255, 0.95)";
  }
  
  function getPrimaryGradientEnd(): string {
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
    return getThemeColors().swapButtonBorderColor || 
           borderColor || 
           "rgba(255, 255, 255, 0.12)";
  }
  
  function getGlowColor(): string {
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
    return getThemeColors().swapButtonRoundness || "rounded-lg";
  }
  
  function getShadow(): string {
    return getThemeColors().swapButtonShadow || "0 8px 32px rgba(0, 0, 0, 0.32)";
  }

  // Generate dynamic style strings
  function getNormalStyle(): string {
    return `background: linear-gradient(135deg, ${getPrimaryGradientStart()} 0%, ${getPrimaryGradientEnd()} 100%); border-color: ${getBorderColor()}; box-shadow: ${getShadow()};`;
  }
  
  function getErrorStyle(): string {
    return `background: linear-gradient(135deg, ${getErrorGradientStart()} 0%, ${getErrorGradientEnd()} 100%); box-shadow: none;`;
  }
  
  function getProcessingStyle(): string {
    return `background: linear-gradient(135deg, ${getProcessingGradientStart()} 0%, ${getProcessingGradientEnd()} 100%); cursor: wait; opacity: 0.8;`;
  }
</script>

<button
  class="relative w-full py-4 px-6 overflow-hidden transition-all duration-200 ease-out mt-1 border shadow-md min-h-[64px] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-px hover:shadow-lg hover:border-white/20 active:translate-y-0 active:shadow-md active:duration-100 {getRoundness()}"
  style={isError ? getErrorStyle() : (isProcessing || isLoading) ? getProcessingStyle() : getNormalStyle()}
  class:animate-pulse={isProcessing || isLoading}
  class:shine-animation={showShineAnimation}
  on:click={onClick}
  {disabled}
>
  <div class="relative z-10 flex items-center justify-center gap-2">
    {#if isProcessing || isLoading}
      <div class="w-[22px] h-[22px] rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
    {/if}
    <span class="font-semibold text-2xl tracking-wide flex items-center justify-center min-w-[140px] text-center" style="color: {getTextColor()}; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);">
      {text}
    </span>
  </div>
  
  <div class="absolute inset-0 transition-opacity duration-300 opacity-0 hover:opacity-100" 
       style="background: radial-gradient(circle at 50% 50%, {getGlowColor()}, transparent 70%);"></div>
  
  <div class="absolute top-0 left-[-100%] w-1/2 h-full pointer-events-none transform -skew-x-20" 
       style="background: linear-gradient(90deg, transparent, {getShineColor()}, transparent);"
       class:animate-shine={showShineAnimation}></div>
  
  <div class="absolute -inset-[2px] rounded-[18px] opacity-0 blur-md transition-opacity duration-300" 
       style="background: linear-gradient(135deg, {getReadyGlowStart()}, {getReadyGlowEnd()});"
       class:animate-pulse-glow={showShineAnimation}></div>
</button>

<style>
  /* Animations that can't be expressed with Tailwind */
  @keyframes shine {
    0%, 100% { left: -100%; }
    35%, 65% { left: 200%; }
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.02); }
  }

  /* Animation utility classes */
  .animate-shine {
    animation: shine 3s infinite;
  }
  
  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
</style> 