<!-- PageWrapper.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { themeStore } from '$lib/stores/themeStore';
  import { getThemeById } from '$lib/themes/themeRegistry';
  import type { ThemeDefinition } from '$lib/themes/baseTheme';
  import { onMount } from 'svelte';
  
  export let page: string;
  let currentTheme: ThemeDefinition;
  let starsContainer: HTMLDivElement;
  let backgroundLoaded = false;
  
  // Generate random positions for nebula gradients
  const nebulaPositions = {
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
  };

  // Add reactive declaration for competition page background
  $: isCompetition = page && page.includes('/competition/kong-madness');
  
  // Determine if theme has pattern background that should fill the screen
  $: hasPatternBg = currentTheme?.colors.backgroundType === 'pattern';
  
  // Subscribe to theme changes
  $: if (browser && $themeStore) {
    currentTheme = getThemeById($themeStore);
    // Preload background image if it exists
    if (currentTheme?.colors.backgroundType === 'pattern' && currentTheme?.colors.backgroundImage) {
      preloadBackgroundImage(currentTheme.colors.backgroundImage);
    }
  }

  // Function to preload background image
  function preloadBackgroundImage(imageUrl: string) {
    backgroundLoaded = false;
    const img = new Image();
    img.onload = () => {
      backgroundLoaded = true;
    };
    img.src = imageUrl;
  }
  
  // Helper function to determine if a theme feature is enabled
  function isEnabled(feature: 'enableNebula' | 'enableStars'): boolean {
    return currentTheme?.colors[feature] === true;
  }
  
  // Helper to get the background based on theme type
  function getBackgroundStyle(): string {
    if (!currentTheme) return '';
    
    const colors = currentTheme.colors;
    
    switch (colors.backgroundType) {
      case 'gradient':
        return colors.backgroundGradient || '';
      case 'solid':
        return colors.backgroundSolid || '';
      case 'pattern':
        // Pattern type is now handled with pattern-background div
        return ''; 
      default:
        return '';
    }
  }

  // Generate stars dynamically - Now using more efficient approach
  function generateStars() {
    if (!browser || !starsContainer || !currentTheme) return;
    
    // Clear existing stars
    starsContainer.innerHTML = '';
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Determine how many stars to generate based on screen size
    // Reduced density by quarter from original (from 2000 to 8000 pixels per star)
    const starCount = Math.floor((window.innerWidth * window.innerHeight) / 8000);
    
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      
      // Random positioning
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      
      // Randomize star size (0.5px - 2px)
      const size = 0.5 + Math.random() * 1.5;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      
      // Randomize opacity (50% - 100%)
      star.style.opacity = (0.5 + Math.random() * 0.5).toString();
      
      // Add slight animation with random delay for twinkling effect
      star.style.animation = `twinkle ${3 + Math.random() * 4}s linear infinite`;
      star.style.animationDelay = `${Math.random() * 5}s`;
      
      fragment.appendChild(star);
    }
    
    // Add all stars at once for better performance
    starsContainer.appendChild(fragment);
  }
  
  // Generate stars when theme changes or on mount
  $: if (browser && currentTheme && isEnabled('enableStars')) {
    // Wait for the next tick to ensure the DOM is updated
    setTimeout(generateStars, 0);
  }
  
  onMount(() => {
    if (browser && currentTheme && isEnabled('enableStars')) {
      generateStars();
    }
    
    // Regenerate stars on window resize with debounce
    let resizeTimer: number;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (isEnabled('enableStars')) {
          generateStars();
        }
      }, 150); // Debounce the resize event to avoid multiple regenerations
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  });
</script>

<div class="page-wrapper">
  <!-- Updated background based on page type -->
  {#if isCompetition}
    <div class="background-container custom"></div>
  {:else}
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
      {#if currentTheme && isEnabled('enableNebula')}
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
      {#if currentTheme && isEnabled('enableStars')}
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
  
  <slot />
</div>

<style lang="postcss">
  .page-wrapper {
    @apply flex flex-col w-full;
    min-height: 100vh;
    position: relative;
    z-index: 0;
  }

  /* Custom background for competition page */
  .background-container.custom {
    position: fixed;
    inset: 0;
    background: linear-gradient(90deg, #2a1b54 0%, #1a3a8f 100%);
    z-index: -1;
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
    transition: opacity 0.3s ease, background 0.3s ease;
    background-size: 100% 100% !important;
    background-position: center center !important;
    background-repeat: no-repeat !important;
    z-index: -10;
  }

  /* Pattern background styling with fade in */
  .pattern-background {
    position: fixed;
    pointer-events: none;
    z-index: -2;
    transition: opacity 0.4s ease-in;
    opacity: 0;
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
    animation: fadeIn 0.5s ease-in forwards;
  }

  @keyframes fadeIn {
    to { opacity: var(--nebula-opacity, 0.3); }
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
