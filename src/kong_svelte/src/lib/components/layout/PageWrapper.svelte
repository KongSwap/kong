<!-- PageWrapper.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { themeStore } from '$lib/stores/themeStore';
  import { getThemeById } from '$lib/themes/themeRegistry';
  import type { ThemeDefinition } from '$lib/themes/baseTheme';
  import { app } from '$lib/state/app.state.svelte';
  
  interface Props {
    page: string;
    enableBackground?: boolean;
    children?: any;
  }
  
  let { page, enableBackground = true, children }: Props = $props();
  
  let currentTheme = $state<ThemeDefinition | undefined>();
  let starsContainer = $state<HTMLDivElement>();
  let backgroundLoaded = $state(false);
  let isGeneratingStars = $state(false);
  let currentImageUrl = $state<string | undefined>();
  
  // Determine if we should show themed background
  let showThemedBackground = $derived(enableBackground);
  
  // Generate random positions for nebula gradients - initialize immediately
  let nebulaPositions = $state({
    blue: {
      x: 20 + Math.random() * 40, // 20-60%
      y: 10 + Math.random() * 30  // 10-40%
    },
    purple1: {
      x: 50 + Math.random() * 40, // 50-90%
      y: 40 + Math.random() * 40  // 40-80%
    },
    purple2: {
      x: 20 + Math.random() * 40, // 20-60%
      y: 50 + Math.random() * 40  // 50-90%
    },
    purple3: {
      x: 60 + Math.random() * 30, // 60-90%
      y: 10 + Math.random() * 40  // 10-50%
    }
  });

  // Add reactive declaration for competition page background
  let isCompetition = $derived(page && page.includes('/competition/kong-madness'));
  
  // Determine if theme has pattern background that should fill the screen
  let hasPatternBg = $derived(showThemedBackground && currentTheme?.colors.backgroundType === 'pattern');
  
  // Subscribe to theme changes
  $effect(() => {
    if (browser && $themeStore) {
      const newTheme = getThemeById($themeStore);
      currentTheme = newTheme;
      
      // Handle background image changes
      const newImageUrl = newTheme?.colors.backgroundType === 'pattern' ? newTheme?.colors.backgroundImage : undefined;
      
      if (newImageUrl !== currentImageUrl) {
        currentImageUrl = newImageUrl;
        if (newImageUrl) {
          preloadBackgroundImage(newImageUrl);
        } else {
          backgroundLoaded = false;
        }
      }
    }
  });

  // Function to preload background image
  function preloadBackgroundImage(imageUrl: string) {
    backgroundLoaded = false;
    const img = new Image();
    img.onload = () => {
      requestAnimationFrame(() => {
        backgroundLoaded = true;
      });
    };
    img.onerror = () => {
      backgroundLoaded = false;
    };
    img.src = imageUrl;
  }
  
  
  // Helper to get the background based on theme type
  function getBackgroundStyle(): string {
    if (!currentTheme) return '';
    
    const colors = currentTheme.colors;
    
    // For pattern backgrounds, use fallback gradient on non-swap pages
    if (colors.backgroundType === 'pattern' && !showThemedBackground && colors.backgroundFallbackGradient) {
      return colors.backgroundFallbackGradient;
    }
    
    if (colors.backgroundType === 'gradient') return colors.backgroundGradient || '';
    if (colors.backgroundType === 'solid') return colors.backgroundSolid || '';
    return '';
  }

  // Generate stars dynamically with optimizations
  function generateStars() {
    if (!browser || !starsContainer || !currentTheme || isGeneratingStars) return;
    
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
    isGeneratingStars = true;
    
    // Clear existing stars
    starsContainer.innerHTML = '';
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Determine how many stars to generate based on screen size
    // Cap at reasonable maximum for performance
    const starCount = Math.min(
      Math.floor((currentWidth * currentHeight) / 24000),
      150 // Maximum stars
    );
    
    
    // Pre-calculate CSS text to reduce string operations
    const stars = [];
    for (let i = 0; i < starCount; i++) {
      const size = 0.5 + Math.random() * 1.5;
      const opacity = 0.5 + Math.random() * 0.5;
      const fadeInDelay = Math.random() * 0.5;
      const twinkleDuration = 3 + Math.random() * 4;
      const twinkleDelay = fadeInDelay + 0.6 + Math.random() * 5;
      
      stars.push({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size,
        opacity,
        animation: `starFadeIn 0.6s ${fadeInDelay}s cubic-bezier(0.4, 0, 0.2, 1) forwards, twinkle ${twinkleDuration}s ${twinkleDelay}s linear infinite`
      });
    }
    
    // Create stars in batch
    stars.forEach(starData => {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.cssText = `
        left: ${starData.left}%;
        top: ${starData.top}%;
        width: ${starData.size}px;
        height: ${starData.size}px;
        opacity: ${starData.opacity};
        --star-opacity: ${starData.opacity};
        animation: ${starData.animation};
      `;
      fragment.appendChild(star);
    });
    
    // Add all stars at once
    starsContainer.appendChild(fragment);
    
    // Reset flag after a microtask to ensure DOM updates are complete
    queueMicrotask(() => {
      isGeneratingStars = false;
    });
  }
  
  // Generate stars when theme changes or on mount
  let starsGenerationTimer: number | null = null;
  
  $effect(() => {
    // Clear any pending star generation
    if (starsGenerationTimer) {
      clearTimeout(starsGenerationTimer);
      starsGenerationTimer = null;
    }
    
    if (browser && currentTheme && showThemedBackground && currentTheme?.colors.enableStars && starsContainer) {
      // Debounce star generation to avoid rapid regeneration
      starsGenerationTimer = window.setTimeout(() => {
        generateStars();
        starsGenerationTimer = null;
      }, 100);
    }
    
    return () => {
      if (starsGenerationTimer) {
        clearTimeout(starsGenerationTimer);
        starsGenerationTimer = null;
      }
    };
  });
  
</script>

<div class="page-wrapper" style="--navbar-height: {app.navbarHeight}px;" class:has-background={showThemedBackground || getBackgroundStyle()}>
  <!-- Background effects for non-swap pages with fallback gradient -->
  {#if !showThemedBackground && getBackgroundStyle()}
    <div class="background-fade-wrapper visible">
      <div class="background-container">
        <div 
          class="theme-background" 
          style={`background: ${getBackgroundStyle()}`}
        ></div>
      </div>
    </div>
  {/if}
  
  <!-- Background effects for swap pages -->
  <div class="background-fade-wrapper" class:visible={showThemedBackground}>
    {#if isCompetition}
      <div class="background-container custom"></div>
    {:else if showThemedBackground}
      <div class="background-container">
        <!-- Solid/gradient background -->
        <div 
          class="theme-background" 
          style={`background: ${getBackgroundStyle()}`}
        ></div>
        
        <!-- Pattern background image - now with fade-in animation -->
        {#if hasPatternBg && currentTheme?.colors.backgroundImage}
          <div 
            class="pattern-background"
            class:loaded={backgroundLoaded}
            style={`
              background-image: url(${currentTheme.colors.backgroundImage}); 
              opacity: ${currentTheme.colors.backgroundOpacity ?? 1};
              background-size: ${currentTheme.colors.backgroundSize || 'cover'};
              background-position: ${currentTheme.colors.backgroundPosition || 'center center'};
              background-repeat: ${currentTheme.colors.backgroundRepeat || 'no-repeat'};
              width: ${currentTheme.colors.backgroundWidth || '100%'};
              height: ${currentTheme.colors.backgroundHeight || '100%'};
              top: ${currentTheme.colors.backgroundTop || '0'};
              left: ${currentTheme.colors.backgroundLeft || '0'};
              right: ${currentTheme.colors.backgroundRight || 'auto'};
              bottom: ${currentTheme.colors.backgroundBottom || 'auto'};
            `}
          ></div>
        {/if}
        
        <!-- Nebula effect -->
        {#if currentTheme?.colors.enableNebula}
          <div 
            class="nebula" 
            style="
              opacity: {currentTheme.colors.nebulaOpacity || 0.3};
              --blue-x: {nebulaPositions.blue.x}%;
              --blue-y: {nebulaPositions.blue.y}%;
              --purple1-x: {nebulaPositions.purple1.x}%;
              --purple1-y: {nebulaPositions.purple1.y}%;
              --purple2-x: {nebulaPositions.purple2.x}%;
              --purple2-y: {nebulaPositions.purple2.y}%;
              --purple3-x: {nebulaPositions.purple3.x}%;
              --purple3-y: {nebulaPositions.purple3.y}%;
            "
          ></div>
        {/if}
        
        <!-- Stars - using dynamic generation -->
        {#if currentTheme?.colors.enableStars}
          <div 
            bind:this={starsContainer}
            class="stars"
            style="
              opacity: {currentTheme.colors.starsOpacity || 0.8};
            "
          ></div>
        {/if}
      </div>
    {/if}
  </div>
  
  {@render children?.()}
</div>

<style lang="postcss">
  .page-wrapper {
    @apply flex flex-col w-full;
    min-height: calc(100vh - var(--navbar-height));
    position: relative;
    z-index: 0;
    background-color: transparent;
  }
  
  /* Background fade wrapper for smooth transitions */
  .background-fade-wrapper {
    position: fixed;
    inset: 0;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }
  
  .background-fade-wrapper.visible {
    opacity: 1;
  }

  /* Background container for default pages */
  .background-container {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
  }

  /* Theme background */
  .theme-background {
    position: absolute;
    inset: 0;
    opacity: var(--background-opacity, 1);
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), 
                background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    background-size: 100% 100% !important;
    background-position: center center !important;
    background-repeat: no-repeat !important;
    z-index: -10;
    will-change: opacity, background;
  }

  /* Pattern background styling with fade in */
  .pattern-background {
    position: fixed;
    pointer-events: none;
    z-index: -2;
    transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    will-change: opacity;
  }
  
  .pattern-background.loaded {
    opacity: var(--background-opacity, 1);
  }

  /* Nebula effect */
  .nebula {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 100vh;
    pointer-events: none;
    z-index: -3;
    filter: blur(120px);
    background: 
      radial-gradient(
        circle at var(--blue-x) var(--blue-y),
        rgba(30, 64, 175, 0.6),
        transparent 60%
      ),
      radial-gradient(
        circle at var(--purple1-x) var(--purple1-y),
        rgba(147, 51, 234, 0.5),
        transparent 60%
      ),
      radial-gradient(
        circle at var(--purple2-x) var(--purple2-y),
        rgba(168, 85, 247, 0.4),
        transparent 50%
      ),
      radial-gradient(
        circle at var(--purple3-x) var(--purple3-y),
        rgba(88, 28, 135, 0.5),
        transparent 55%
      );
    opacity: 0;
    animation: fadeIn 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    will-change: opacity, transform;
    transform: translateZ(0); /* Force GPU acceleration */
    backface-visibility: hidden;
  }

  @keyframes fadeIn {
    0% { 
      opacity: 0;
      transform: scale(0.95);
    }
    100% { 
      opacity: var(--nebula-opacity, 0.3);
      transform: scale(1);
    }
  }

  /* Stars container */
  .stars {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: -2; /* Higher than background but below nebula */
  }

  /* Individual star styling */
  :global(.star) {
    position: absolute;
    background-color: #ffffff;
    border-radius: 50%;
    box-shadow: 0 0 2px 1px rgba(255, 255, 255, 0.4);
    opacity: 0;
    animation: starFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    will-change: opacity;
    contain: layout style paint;
    backface-visibility: hidden;
    transform: translateZ(0); /* Force GPU acceleration */
  }
  
  @keyframes starFadeIn {
    to { opacity: var(--star-opacity, 1); }
  }

  /* Twinkle animation for stars */
  @keyframes twinkle {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
</style>
