<script lang="ts">
  import { onMount, tick, getContext } from "svelte";
  import { app } from "$lib/state/app.state.svelte";
  import type { Writable } from 'svelte/store';
  import * as THREE from "three";
  import { ChevronDown } from "lucide-svelte";
  import LandingButton from "./LandingButton.svelte";
  import {
    FORMAT_NUMBER_KEY,
    FORMAT_COUNT_KEY,
    TWEENED_TVL_KEY,
    TWEENED_VOLUME_KEY,
    TWEENED_FEES_KEY,
    TWEENED_SWAPS_KEY
  } from "$lib/constants/contextKeys"; // Import shared keys

  // Props using $props rune - corrected syntax
  type FormatNumberFn = (num: number, precision?: number) => string;
  type FormatCountFn = (num: number) => string;
  type NavigateToSwapFn = () => void;

  // === Get Context ===
  const tweenedTVL = getContext<Writable<number>>(TWEENED_TVL_KEY);
  const tweenedVolume = getContext<Writable<number>>(TWEENED_VOLUME_KEY);
  const tweenedFees = getContext<Writable<number>>(TWEENED_FEES_KEY);
  const tweenedSwaps = getContext<Writable<number>>(TWEENED_SWAPS_KEY);
  const formatNumber = getContext<FormatNumberFn>(FORMAT_NUMBER_KEY);
  const formatCount = getContext<FormatCountFn>(FORMAT_COUNT_KEY);

  // === Props (Only non-shared props) ===
  let { 
    showGetStarted,
    navigateToSwap,
    isVisible = false // Default value provided here
  } = $props<{
    showGetStarted: boolean;
    navigateToSwap: NavigateToSwapFn;
    isVisible?: boolean;
  }>();

  // State using $state rune
  let hasTriggeredAnimation = $state(false);
  let contentVisible = $state(false);

  // Trigger animations when the section becomes visible
  $effect(() => {
    if (isVisible && !hasTriggeredAnimation) {
      triggerAnimation();
    }
  });
  
  function triggerAnimation() {
    hasTriggeredAnimation = true;
    contentVisible = true; // Set immediately when triggered
  }

  // Three.js variables - using $state where appropriate
  let canvasContainer = $state<HTMLElement | undefined>(undefined); // Keep $state for the element ref
  let scene: THREE.Scene | undefined;
  let camera: THREE.OrthographicCamera | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  let animationFrameId: number | undefined;
  let materialUniforms: any | undefined; // Consider defining a proper type
  
  // Performance detection - using $state
  let isLowEndDevice = $state(false);
  let isMobile = $derived(app.isMobile);
  
  // Mouse tracking variables with throttling
  let mouse = $state({
    position: { x: 0.5, y: 0.5 },
    target: { x: 0.5, y: 0.5 },
    active: true, // Default to active
  });
  let lastMoveTime = $state(0);
  let frameCount = $state(0);
  
  // Store handler references for cleanup
  const handleMouseEnter = () => { mouse.active = true; };
  const handleMouseLeave = () => { 
    // Don't immediately turn off effect on mouseleave
    setTimeout(() => {
      mouse.active = false;
    }, 500);
  };
  
  // Handle mouse move with throttling
  function handleMouseMove(event: MouseEvent) {
    const now = performance.now();
    if (now - lastMoveTime < 16) return; // Skip if less than ~60fps interval
    lastMoveTime = now;
    
    // Convert screen coordinates to normalized UV coordinates (0 to 1)
    mouse.target.x = event.clientX / window.innerWidth;
    mouse.target.y = 1.0 - (event.clientY / window.innerHeight); // Invert Y for shader space
    
    // Ensure mouseActive is true when mouse is moving
    mouse.active = true;
  }
  
  // Handle touch move for mobile with throttling
  function handleTouchMove(event: TouchEvent) {
    const now = performance.now();
    if (now - lastMoveTime < 32) return; // Even more throttling for touch events (~30fps)
    lastMoveTime = now;
    
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.target.x = touch.clientX / window.innerWidth;
      mouse.target.y = 1.0 - (touch.clientY / window.innerHeight);
      mouse.active = true;
    }
  }
  
  // Handle touch start for mobile
  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.target.x = touch.clientX / window.innerWidth;
      mouse.target.y = 1.0 - (touch.clientY / window.innerHeight);
      mouse.active = true;
    }
  }
  
  // Handle touch end for mobile
  function handleTouchEnd() {
    // Keep effect active for a moment after touch ends
    setTimeout(() => {
      mouse.active = false;
    }, 500);
  }
  
  // Detect if device is low-end
  function detectPerformance() {
    // Check for mobile devices
    // isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Simple performance check - can be expanded with more sophisticated detection
    try {
      // Test how long it takes to create a large array
      const startTime = performance.now();
      const arr = new Array(1000000).fill(0);
      const endTime = performance.now();
      
      // If operation took more than 50ms, consider it a low-end device
      isLowEndDevice = (endTime - startTime) > 50;
    } catch (e) {
      // If there's an error, assume it's a low-end device
      isLowEndDevice = true;
    }
    
    // Additional check for older browsers that might not handle WebGL well
    if (!window.WebGLRenderingContext) {
      isLowEndDevice = true;
    }
  }
  
  // Initialize Three.js scene
  let sceneInitialized = $state(false);
  
  async function initThreeJs() {
    // Skip initialization if already done
    if (sceneInitialized) return;
    sceneInitialized = true;
    
    // Wait for next tick to ensure DOM is ready
    await tick();
    
    // Check if container exists before proceeding
    if (!canvasContainer) {
      console.error("Canvas container not found");
      return;
    }

    const newScene = new THREE.Scene();
    
    // Camera setup - orthographic for fullscreen quad
    const newCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Renderer setup with pixel ratio limiting based on device capability
    const newRenderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: false,
      powerPreference: 'low-power' // Changed from 'high-performance' for consistency
    });
    
    // Limit pixel ratio more aggressively for mobile/low-end devices
    const maxPixelRatio = isLowEndDevice || isMobile ? 1 : 1.5; // Slightly reduced max non-mobile
    const pixelRatio = Math.min(window.devicePixelRatio, maxPixelRatio);
    newRenderer.setPixelRatio(pixelRatio);
    
    // Set lower resolution for mobile/low-end devices
    if (isMobile || isLowEndDevice) {
      const scale = isMobile ? 1.3 : 1.2; // Slightly increased scaling for lower res
      newRenderer.setSize(window.innerWidth / scale, window.innerHeight / scale, true);
    } else {
      newRenderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Ensure canvas fills the container properly
    newRenderer.domElement.style.position = 'absolute';
    newRenderer.domElement.style.top = '0';
    newRenderer.domElement.style.left = '0';
    newRenderer.domElement.style.width = '100%';
    newRenderer.domElement.style.height = '100%';
    
    canvasContainer.appendChild(newRenderer.domElement);
    
    // Create trading/swapping themed background effect
    const crtGeometry = new THREE.PlaneGeometry(2, 2);
    
    // Trading-themed shader uniforms
    materialUniforms = {
      time: { value: 0.0 },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      baseColor: { value: new THREE.Color(0x0D111F) },      // Match other sections bg
      neonColor1: { value: new THREE.Color(0x7B68EE) },     // Use Indigo/Purple from SwapSection
      neonColor2: { value: new THREE.Color(0x9370DB) },     // Use Indigo/Purple from SwapSection
      greenColor: { value: new THREE.Color(0x00FF88) },     // Trading green
      redColor: { value: new THREE.Color(0xFF0055) },       // Trading red
      mousePosition: { value: new THREE.Vector2(0.5, 0.5) },// Mouse position in UV space
      mouseActive: { value: 0.0 },                           // Mouse activity indicator
      isLowPerformance: { value: (isLowEndDevice || isMobile) ? 1.0 : 0.0 }
    };
    
    const tradingMaterial = new THREE.ShaderMaterial({
      uniforms: materialUniforms,
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 baseColor;
        uniform vec3 neonColor1;
        uniform vec3 neonColor2;
        uniform vec3 greenColor;
        uniform vec3 redColor;
        uniform vec2 mousePosition;
        uniform float mouseActive;
        uniform float isLowPerformance;
        varying vec2 vUv;
        
        // Optimized random function
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        // Simplified noise function
        float noise(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          vec2 u = f * f * (3.0 - 2.0 * f); // Smoothstep
          
          return mix(mix(random(i), random(i + vec2(1.0, 0.0)), u.x),
                     mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        
        // Trading candlestick pattern
        vec3 candlestickPattern(vec2 uv, float time) {
          vec3 color = vec3(0.0);
          
          // Create multiple candlesticks across the screen
          float numCandles = 20.0;
          float candleWidth = 1.0 / numCandles;
          
          for (float i = 0.0; i < numCandles; i++) {
            float x = i * candleWidth + candleWidth * 0.5;
            float priceNoise = noise(vec2(i * 0.3, time * 0.2));
            float height = 0.2 + priceNoise * 0.3;
            float y = 0.3 + sin(i * 0.5 + time * 0.3) * 0.2;
            
            // Candle body
            float bodyWidth = candleWidth * 0.6;
            float bodyHeight = height * 0.7;
            
            // Determine if bullish or bearish
            bool isBullish = priceNoise > 0.5;
            vec3 candleColor = isBullish ? greenColor : redColor;
            
            // Draw candle body
            if (abs(uv.x - x) < bodyWidth * 0.5 && abs(uv.y - y) < bodyHeight * 0.5) {
              color += candleColor * 0.15;
            }
            
            // Draw wick
            float wickWidth = bodyWidth * 0.1;
            float wickHeight = height;
            if (abs(uv.x - x) < wickWidth * 0.5 && abs(uv.y - y) < wickHeight * 0.5) {
              color += candleColor * 0.08;
            }
          }
          
          return color;
        }
        
        // Order book visualization
        vec3 orderBookPattern(vec2 uv, float time) {
          vec3 color = vec3(0.0);
          
          // Left side - buy orders (green)
          if (uv.x < 0.15) {
            float orderDepth = noise(vec2(uv.y * 10.0, time * 0.5)) * 0.15;
            if (uv.x < orderDepth) {
              color += greenColor * 0.2 * (1.0 - uv.x / 0.15);
            }
          }
          
          // Right side - sell orders (red)
          if (uv.x > 0.85) {
            float orderDepth = noise(vec2(uv.y * 10.0, time * 0.5 + 100.0)) * 0.15;
            if ((1.0 - uv.x) < orderDepth) {
              color += redColor * 0.2 * ((uv.x - 0.85) / 0.15);
            }
          }
          
          return color;
        }
        
        // Flowing data streams representing token swaps
        vec3 swapFlowPattern(vec2 uv, float time) {
          vec3 color = vec3(0.0);
          
          // Create flowing particles
          float numFlows = 5.0;
          
          for (float i = 0.0; i < numFlows; i++) {
            float flowTime = time * 0.5 + i * 1.3;
            float y = fract(flowTime * 0.3);
            float x = 0.5 + sin(y * 6.28 + i) * 0.3;
            
            // Create particle trail
            float dist = distance(uv, vec2(x, y));
            float trail = smoothstep(0.02, 0.0, dist);
            
            // Alternate between colors
            vec3 flowColor = mod(i, 2.0) < 1.0 ? neonColor1 : neonColor2;
            color += flowColor * trail * 0.3;
            
            // Add glow
            float glow = smoothstep(0.1, 0.0, dist);
            color += flowColor * glow * 0.1;
          }
          
          return color;
        }
        
        // Price chart line
        vec3 priceChartPattern(vec2 uv, float time) {
          vec3 color = vec3(0.0);
          
          if (isLowPerformance < 0.5) {
            // Generate price movement
            float price = 0.5;
            for (float i = 0.0; i < 10.0; i++) {
              price += sin(i * 0.5 + time * 0.2) * 0.02;
              price += noise(vec2(i * 0.1, time * 0.1)) * 0.01;
            }
            
            // Draw price line
            float chartY = 0.5 + (noise(vec2(uv.x * 5.0, time * 0.2)) - 0.5) * 0.3;
            float lineThickness = 0.003;
            
            if (abs(uv.y - chartY) < lineThickness) {
              // Gradient based on price direction
              float priceChange = noise(vec2(uv.x * 5.0 + 0.1, time * 0.2)) - 
                                  noise(vec2(uv.x * 5.0 - 0.1, time * 0.2));
              vec3 lineColor = priceChange > 0.0 ? greenColor : redColor;
              color += lineColor * 0.4;
            }
          }
          
          return color;
        }
        
        // Grid pattern for trading interface feel
        vec3 gridPattern(vec2 uv) {
          vec3 color = vec3(0.0);
          
          // Major grid lines
          float gridSize = 0.1;
          float lineWidth = 0.001;
          
          if (mod(uv.x, gridSize) < lineWidth || mod(uv.y, gridSize) < lineWidth) {
            color += neonColor1 * 0.05;
          }
          
          // Minor grid lines
          float minorGridSize = 0.025;
          if (mod(uv.x, minorGridSize) < lineWidth * 0.5 || 
              mod(uv.y, minorGridSize) < lineWidth * 0.5) {
            color += neonColor2 * 0.02;
          }
          
          return color;
        }
        
        // Mouse effect - swap ripple
        vec3 mouseSwapEffect(vec2 uv, vec2 mousePos) {
          float dist = length(uv - mousePos);
          
          // Create expanding rings
          float ring1 = sin(dist * 30.0 - time * 5.0) * 0.5 + 0.5;
          float ring2 = sin(dist * 20.0 - time * 4.0 + 3.14) * 0.5 + 0.5;
          
          float falloff = smoothstep(0.3, 0.0, dist);
          float rings = (ring1 * 0.7 + ring2 * 0.3) * falloff * mouseActive;
          
          // Swap colors between green and purple
          vec3 swapColor = mix(greenColor, neonColor1, sin(time * 2.0) * 0.5 + 0.5);
          
          return swapColor * rings * 0.4 * (1.0 - isLowPerformance * 0.7);
        }
        
        void main() {
          vec2 uv = vUv;
          vec3 color = baseColor;
          
          // Add grid background
          color += gridPattern(uv);
          
          // Add trading patterns based on performance
          if (isLowPerformance > 0.5) {
            // Low performance - just basic patterns
            color += swapFlowPattern(uv, time) * 0.5;
          } else {
            // Full performance - all patterns
            color += candlestickPattern(uv, time) * 0.3;
            color += orderBookPattern(uv, time) * 0.5;
            color += swapFlowPattern(uv, time);
            color += priceChartPattern(uv, time) * 0.6;
          }
          
          // Add mouse swap effect
          color += mouseSwapEffect(uv, mousePosition);
          
          // Subtle static noise for texture
          float staticNoise = random(uv + fract(time * 0.5));
          color += vec3(staticNoise * 0.02);
          
          // Subtle horizontal scan lines
          if (fract(uv.y * 150.0) > 0.7) {
            color *= 0.98;
          }
          
          // Vignette effect
          float vignetteDist = length(vec2(0.5) - uv);
          color *= smoothstep(0.9, 0.2, vignetteDist);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true
    });
    
    const crtScreen = new THREE.Mesh(crtGeometry, tradingMaterial);
    newScene.add(crtScreen);
    
    // Assign to state variables
    scene = newScene;
    camera = newCamera;
    renderer = newRenderer;
    
    
    // window.addEventListener('resize', handleResizeScoped);
    
    // Animation loop with performance optimizations
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      frameCount++;
      
      if (!materialUniforms || !renderer || !scene || !camera) return;

      // Update time uniform with reduced step for slower animations
      const timeStep = isMobile || isLowEndDevice ? 0.003 : 0.006;
      if (materialUniforms) materialUniforms.time.value += timeStep;
      
      // Only update mouse position every few frames to improve performance
      if (frameCount % (isMobile || isLowEndDevice ? 3 : 2) === 0) {
        mouse.position.x += (mouse.target.x - mouse.position.x) * 0.05;
        mouse.position.y += (mouse.target.y - mouse.position.y) * 0.05;
        
        // Update mouse uniforms
        if (materialUniforms) {
          materialUniforms.mousePosition.value.x = mouse.position.x;
          materialUniforms.mousePosition.value.y = mouse.position.y;
          materialUniforms.mouseActive.value = mouse.active ? 1.0 : 0.0;
        }
      }
      
      // Render scene
      renderer.render(scene, camera);
    };
    
    animate();

    // Return cleanup function for the effect that calls initThreeJs
    return () => {
        // window.removeEventListener('resize', handleResizeScoped);
        const currentAnimationFrameId = animationFrameId; // Capture value
        if (currentAnimationFrameId) cancelAnimationFrame(currentAnimationFrameId);
        animationFrameId = undefined; // Clear state

        if (renderer) {
            const currentRenderer = renderer; // Capture value
            currentRenderer.dispose();
            if (canvasContainer && canvasContainer.contains(renderer.domElement)) {
                canvasContainer.removeChild(currentRenderer.domElement);
            }
            renderer = undefined; // Clear state
        }
        scene = undefined; // Clear non-state variables
        camera = undefined; // Clear non-state variables
        materialUniforms = undefined; // Clear non-state variables
        sceneInitialized = false; // Reset init flag
    };
  }

  $effect(() => {
      const scale = isMobile ? 1.2 : 1.0;
      
      if (renderer) {
          renderer.setSize(window.innerWidth / scale, window.innerHeight / scale, true);
          
          // Ensure canvas size is always correct
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = '100%';
      }
      
      if (materialUniforms) {
          materialUniforms.resolution.value.set(window.innerWidth, window.innerHeight);
      }
  })
  
  // Add isSmallScreen detection for conditional rendering
  let isSmallScreen = $state(false);

  // Resize handler function
  function handleResize() {
    isSmallScreen = window.innerWidth < 640;
  }

  onMount(() => {
    let threeJsCleanup: (() => void) | undefined;
    
    // Run checks and setup that don't depend on Three.js immediately
    isSmallScreen = window.innerWidth < 640;
    detectPerformance();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Delay Three.js initialization
    const initTimeout = setTimeout(async () => {
        threeJsCleanup = await initThreeJs();
    }, 100);

    // Cleanup on unmount
    return () => {
      clearTimeout(initTimeout); // Clear timeout if component unmounts before init
      if (threeJsCleanup) {
        threeJsCleanup(); // Run the specific Three.js cleanup
      }
      
      // Remove general listeners
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  });

  // No need for separate onDestroy, cleanup is handled in mount's return function

</script>

<section id="hero" class="h-screen flex flex-col items-center justify-center relative overflow-hidden" class:low-performance={isLowEndDevice || isMobile}>
  <!-- Three.js blade runner background -->
  <div bind:this={canvasContainer} class="absolute inset-0 z-0 pointer-events-auto overflow-hidden"></div>
  
  <!-- Animated background grid (like other sections) -->
  <div class="absolute inset-0 grid grid-cols-[repeat(10,1fr)] sm:grid-cols-[repeat(20,1fr)] grid-rows-[repeat(10,1fr)] sm:grid-rows-[repeat(20,1fr)] opacity-[0.04] pointer-events-none z-[1]">
    {#each Array(isSmallScreen ? 100 : 400) as _, i}
      <div class="border-[0.5px] border-white/10"></div>
    {/each}
  </div>

  <!-- Floating particles (like swap section) -->
  <div class="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
    {#each Array(isSmallScreen ? 3 : 8) as _, i}
      <div class="absolute h-1 w-1 rounded-full bg-purple-400/30 will-change-transform will-change-opacity"
           style="top: {Math.random() * 100}%; left: {Math.random() * 100}%; animation: float {6 + Math.random() * 8}s ease-in-out infinite; animation-delay: {Math.random() * 8}s;"></div>
    {/each}
    {#each Array(isSmallScreen ? 2 : 5) as _, i}
      <div class="absolute h-[2px] w-[2px] rounded-full bg-indigo-400/40 will-change-transform will-change-opacity"
           style="top: {Math.random() * 100}%; left: {Math.random() * 100}%; animation: float-slow {10 + Math.random() * 10}s ease-in-out infinite; animation-delay: {Math.random() * 10}s;"></div>
    {/each}
  </div>

  <!-- Content layout with proper spacing -->
  <div class="relative !max-w-5xl z-10 container mx-auto px-4 sm:px-6 flex flex-col items-center justify-center h-full pt-10 sm:pt-0 transition-all duration-1000 ease-out {contentVisible ? 'opacity-100' : 'opacity-0 transform translate-y-8'}">
    
    <!-- Logo with CRT effect -->
    <div class="relative mb-5 sm:mb-10 w-full max-w-6xl">
      <!-- Logo container with scan effects -->
      <div class="relative flex justify-center perspective-[1000px]">
        <!-- Background effects positioned behind the logo -->
        <div class="absolute inset-0 logo-scanlines"></div>
        <div class="absolute inset-0 logo-noise"></div>
        
        <!-- Main logo -->
        <img 
          src="titles/logo-white-wide.png" 
          alt="KongSwap Logo" 
          class="kong-logo pt-12 w-full max-w-[400px] xs:max-w-[500px] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px] xl:max-w-[1000px] mx-auto relative z-[2]"
        />
        
        <!-- Neon reflection -->
        <div class="kong-logo-reflection"></div>
      </div>
    </div>
    
    <!-- Text with CRT phosphor glow effect -->
    <p class="phosphor-text text-sm sm:text-lg md:text-xl mb-7 sm:mb-12 max-w-sm sm:max-w-md md:max-w-2xl mx-auto text-center" data-text="The most advanced multi-chain DeFi hub in the world. Decentralized, DAO governed, and fully on-chain.">
      The most advanced multi-chain DeFi hub in the world. Decentralized, DAO governed, and fully on-chain.
    </p>
    
    <!-- Protocol Stats -->
    <div class="mx-auto mb-7 sm:mb-10 max-w-[850px] w-full transition-all duration-1000 ease-out delay-300 {contentVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-12'}">
      <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 sm:p-4 min-h-[70px] sm:min-h-[90px] relative transition-all duration-300 ease-in-out will-change-transform will-change-opacity hover:border-[#7B68EE]/30 hover:bg-white/[0.07] overflow-hidden screen-panel">
          <div class="relative z-10">
            <div class="text-[0.7rem] sm:text-[0.8rem] uppercase text-[#A1A7BC]/90 tracking-wider mb-1 text-shadow shadow-black/70 font-['BlenderPro','Rajdhani',monospace] text-center">Total Value Locked</div>
            <div class="panel-value crt-value text-lg sm:text-xl md:text-2xl">{formatNumber($tweenedTVL)}</div>
          </div>
          <div class="panel-scanlines"></div>
          <div class="panel-noise"></div>
        </div>
        
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 sm:p-4 min-h-[70px] sm:min-h-[90px] relative transition-all duration-300 ease-in-out will-change-transform will-change-opacity hover:border-[#7B68EE]/30 hover:bg-white/[0.07] overflow-hidden screen-panel">
          <div class="relative z-10">
            <div class="text-[0.7rem] sm:text-[0.8rem] uppercase text-[#A1A7BC]/90 tracking-wider mb-1 text-shadow shadow-black/70 font-['BlenderPro','Rajdhani',monospace] text-center">24h Volume</div>
            <div class="panel-value crt-value text-lg sm:text-xl md:text-2xl">{formatNumber($tweenedVolume)}</div>
          </div>
          <div class="panel-scanlines"></div>
          <div class="panel-noise"></div>
        </div>
        
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 sm:p-4 min-h-[70px] sm:min-h-[90px] relative transition-all duration-300 ease-in-out will-change-transform will-change-opacity hover:border-[#7B68EE]/30 hover:bg-white/[0.07] overflow-hidden screen-panel">
          <div class="relative z-10">
            <div class="text-[0.7rem] sm:text-[0.8rem] uppercase text-[#A1A7BC]/90 tracking-wider mb-1 text-shadow shadow-black/70 font-['BlenderPro','Rajdhani',monospace] text-center">24h Fees</div>
            <div class="panel-value crt-value text-lg sm:text-xl md:text-2xl">{formatNumber($tweenedFees)}</div>
          </div>
          <div class="panel-scanlines"></div>
          <div class="panel-noise"></div>
        </div>
        
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 sm:p-4 min-h-[70px] sm:min-h-[90px] relative transition-all duration-300 ease-in-out will-change-transform will-change-opacity hover:border-[#7B68EE]/30 hover:bg-white/[0.07] overflow-hidden screen-panel">
          <div class="relative z-10">
            <div class="text-[0.7rem] sm:text-[0.8rem] uppercase text-[#A1A7BC]/90 tracking-wider mb-1 text-shadow shadow-black/70 font-['BlenderPro','Rajdhani',monospace] text-center">Total Swaps</div>
            <div class="panel-value crt-value text-lg sm:text-xl md:text-2xl">{formatCount($tweenedSwaps)}</div>
          </div>
          <div class="panel-scanlines"></div>
          <div class="panel-noise"></div>
        </div>
      </div>
    </div>
    
    <div class="mt-7 sm:mt-10 transition-[opacity,transform] duration-500 ease-out delay-700 {showGetStarted && contentVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10 pointer-events-none'}">
      <LandingButton 
        onClick={navigateToSwap}
        buttonClass="text-base sm:text-lg px-5 bg-[#0D111F]/30 text-[#9370DB] border border-[#9370DB]/40 shadow-[0_0_10px_rgba(147,112,219,0.2),inset_0_0_5px_rgba(147,112,219,0.1)] backdrop-blur-md will-change-shadow hover:text-white hover:bg-[#9370DB]/80 hover:border-[#9370DB]/80 hover:shadow-[0_0_20px_rgba(147,112,219,0.6),0_0_35px_rgba(123,104,238,0.4)] hover:text-shadow sm:min-w-[180px] font-['Inter','Rajdhani','SF_Pro_Display',sans-serif] neon-button"
        textClass="px-5 py-3 sm:py-2"
        iconClass="w-5 h-5 sm:w-6 sm:h-6 ml-2 relative z-10"
      />
    </div>
    
    <!-- Improved scroll indicator with animation that matches other sections' style -->
    <div class="mt-10 sm:mt-14 md:mt-16 flex flex-col items-center opacity-70 transition-all duration-1000 ease-out delay-700 {contentVisible ? 'opacity-70' : 'opacity-0'}">
      <span class="text-[#A1A7BC] text-sm sm:text-base">Scroll to explore</span>
      <div class="mt-3 sm:mt-4 flex flex-col items-center">
        <ChevronDown size={isSmallScreen ? 22 : 26} class="text-[#7B68EE] opacity-60 chevron-animation-1" strokeWidth={2.5} />
        <ChevronDown size={isSmallScreen ? 20 : 24} class="text-[#9370DB] opacity-40 chevron-animation-2 -mt-1" strokeWidth={2} />
      </div>
    </div>
  </div>
  
  
  <!-- Screen overlay effects positioned above everything -->
  <div class="absolute inset-0 z-[20] pointer-events-none">
    <!-- Scanlines overlay - Made more subtle -->
    <div class="scanlines absolute inset-0"></div>
    <!-- Screen curvature & vignette - Made more subtle -->
    <div class="vignette absolute inset-0"></div>
  </div>
</section>

<style>
  @keyframes float {
    0% { transform: translateY(0px) translateX(0px); opacity: 0; }
    50% { opacity: 0.4; }
    100% { transform: translateY(-80px) translateX(15px); opacity: 0; }
  }
  
  @keyframes float-slow {
    0% { transform: translate(0, 0); opacity: 0.1; }
    50% { transform: translate(20px, -20px); opacity: 0.5; }
    100% { transform: translate(0, 0); opacity: 0.1; }
  }
  
  @keyframes move-chevron {
    0% { opacity: 0; transform: translateY(0); }
    25% { opacity: 1; }
    50% { opacity: 1; transform: translateY(10px); }
    75% { opacity: 1; transform: translateY(20px); }
    100% { opacity: 0; transform: translateY(30px); }
  }
  
  /* Chevron animations */
  .chevron-animation-1 {
    animation: move-chevron 2s ease-out infinite;
    will-change: transform, opacity;
  }
  
  .chevron-animation-2 {
    animation: move-chevron 2s ease-out 500ms infinite;
    will-change: transform, opacity;
  }
  
  /* Animation delay for second chevron */
  .animation-delay-500 {
    animation-delay: 500ms;
  }
  
  /* Add smooth scrolling to all sections */
  :global(html) {
    scroll-behavior: smooth;
  }
  
  /* New animation for connecting particles between sections */
  @keyframes connect-float {
    0% { transform: translateY(0); opacity: 0; }
    50% { transform: translateY(-30px); opacity: 0.7; }
    100% { transform: translateY(-60px); opacity: 0; }
  }
  
  /* Logo neon effect - enhanced with realistic tube glow */
  .kong-logo {
    filter: 
      drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))
      drop-shadow(0 0 4px rgba(123, 104, 238, 0.4))
      drop-shadow(0 0 8px rgba(123, 104, 238, 0.5))
      drop-shadow(0 0 14px rgba(123, 104, 238, 0.2));
    animation: logo-neon-pulse 3s ease-in-out infinite alternate;
    will-change: filter;
    mix-blend-mode: screen;
    opacity: 0.9;
    transform: translateZ(0);
  }
  
  @keyframes logo-neon-pulse {
    0% { 
      filter: 
        drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))
        drop-shadow(0 0 4px rgba(123, 104, 238, 0.4))
        drop-shadow(0 0 8px rgba(123, 104, 238, 0.5))
        drop-shadow(0 0 14px rgba(123, 104, 238, 0.2));
    }
    50% {
      filter: 
        drop-shadow(0 0 2px rgba(255, 255, 255, 0.7))
        drop-shadow(0 0 5px rgba(147, 112, 219, 0.5))
        drop-shadow(0 0 10px rgba(147, 112, 219, 0.6))
        drop-shadow(0 0 16px rgba(147, 112, 219, 0.3));
    }
    100% {
      filter: 
        drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))
        drop-shadow(0 0 4px rgba(123, 104, 238, 0.4))
        drop-shadow(0 0 8px rgba(123, 104, 238, 0.5))
        drop-shadow(0 0 14px rgba(123, 104, 238, 0.2));
    }
  }
  
  /* Neon reflection effect for logo */
  .kong-logo-reflection {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(to bottom, rgba(123, 104, 238, 0.3), transparent);
    filter: blur(5px);
    transform: scaleY(0.3);
    transform-origin: top;
    opacity: 0.5;
    border-radius: 50%;
    animation: reflection-pulse 3s ease-in-out infinite alternate;
    pointer-events: none;
    z-index: -1;
  }
  
  @keyframes reflection-pulse {
    0% {
      opacity: 0.5;
      background: linear-gradient(to bottom, rgba(123, 104, 238, 0.3), transparent);
    }
    50% {
      opacity: 0.6;
      background: linear-gradient(to bottom, rgba(147, 112, 219, 0.4), transparent);
    }
    100% {
      opacity: 0.5;
      background: linear-gradient(to bottom, rgba(123, 104, 238, 0.3), transparent);
    }
  }
  
  /* Add a horizontal scan line that moves across panels - simplified */
  .screen-panel::after {
    content: "";
    position: absolute;
    left: 0;
    width: 100%;
    height: 1px;
    background-color: rgba(123, 104, 238, 0.2);
    opacity: 0.5;
    z-index: 7;
    animation: horizontal-scan 6s infinite linear;
  }
  
  @keyframes horizontal-scan {
    0% {
      top: -1px;
      opacity: 0;
    }
    10% {
      opacity: 0.5;
    }
    80% {
      opacity: 0.5;
    }
    100% {
      top: 100%;
      opacity: 0;
    }
  }
  
  .screen-panel:nth-child(1)::after {
    animation-delay: 0s;
  }
  
  .screen-panel:nth-child(2)::after {
    animation-delay: 1s;
  }
  
  .screen-panel:nth-child(3)::after {
    animation-delay: 2s;
  }
  
  .screen-panel:nth-child(4)::after {
    animation-delay: 3s;
  }
  
  .neon-button-glow {
    position: absolute;
    inset: 0; /* Use inset for brevity */
    background: radial-gradient(
      circle at center,
      rgba(147, 112, 219, 0.3) 0%,
      transparent 70%
    );
    opacity: 0;
    z-index: 1;
    transition: opacity 0.3s ease;
  }
  
  .neon-button:hover .neon-button-glow {
    /* The hover effect for glow is now handled by the LandingButton component */
    /* opacity: 1; */ 
  }
  
  /* Scanlines overlay - more subtle */
  .scanlines {
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(147, 112, 219, 0.05) 50% /* Even more subtle */
    );
    background-size: 100% 3px; /* Smaller lines */
    pointer-events: none;
    z-index: 20;
    opacity: 0.1; /* Reduced opacity */
    mix-blend-mode: overlay;
  }
  
  /* Vignette effect - more subtle */
  .vignette {
    pointer-events: none;
    z-index: 21;
    box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.5); /* Further reduced spread/opacity */
    border-radius: 5px;
    background: radial-gradient(
      ellipse at center,
      transparent 75%, /* Increased transparent area */
      rgba(0, 0, 0, 0.3) 100% /* Reduced opacity */
    );
  }
  
  /* Phosphor CRT text effect - simplified and toned down */
  .phosphor-text {
    color: #B0B8D3; /* Adjusted base color */
    font-family: 'Courier New', monospace;
    line-height: 1.5;
    letter-spacing: 0.5px;
    text-shadow: 
      0 0 1px rgba(147, 112, 219, 0.5), /* Reduced glow */
      0 0 2px rgba(123, 104, 238, 0.3); /* Reduced glow */
    position: relative;
    transition: text-shadow 0.2s ease-out;
    will-change: text-shadow;
    transform: translateZ(0);
  }
  
  .phosphor-text:hover {
    text-shadow: 
      0 0 1px #D8DEFF, /* Lighter highlight */
      0 0 3px rgba(147, 112, 219, 0.7), /* Slightly stronger hover */
      0 0 5px rgba(123, 104, 238, 0.4);
  }
  
  /* CRT color fringing - Made more subtle */
  .phosphor-text::before {
    content: attr(data-text);
    position: absolute;
    left: -0.3px; /* Reduced shift */
    top: 0;
    color: rgba(255, 0, 100, 0.15); /* Reduced opacity */
    width: 100%;
    height: 100%;
    mix-blend-mode: screen;
    z-index: -1;
    opacity: 0.8; /* Added overall opacity */
  }
  
  .phosphor-text::after {
    content: attr(data-text);
    position: absolute;
    left: 0.3px; /* Reduced shift */
    top: 0;
    color: rgba(0, 164, 255, 0.15); /* Reduced opacity */
    width: 100%;
    height: 100%;
    mix-blend-mode: screen;
    z-index: -1;
    opacity: 0.8; /* Added overall opacity */
  }
  
  /* Enhanced CRT effect for stat values */
  .crt-value {
    background: linear-gradient(90deg, #7B68EE, #9370DB);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    position: relative;
    text-shadow: 
      0 0 2px rgba(255, 255, 255, 0.7),
      0 0 5px rgba(123, 104, 238, 0.5),
      0 0 8px rgba(147, 112, 219, 0.3);
    font-family: "BlenderPro", "Rajdhani", monospace;
    letter-spacing: 1px;
    text-align: center;
    animation: crt-value-flicker 8s infinite;
    font-weight: 700;
    line-height: 1.1;
    display: block;
  }
  
  @keyframes crt-value-flicker {
    0%, 98%, 100% {
      text-shadow: 
        0 0 2px rgba(255, 255, 255, 0.7),
        0 0 5px rgba(123, 104, 238, 0.5),
        0 0 8px rgba(147, 112, 219, 0.3);
    }
    98.5% {
      text-shadow: 
        0 0 2px rgba(255, 255, 255, 0.7),
        0 0 5px rgba(123, 104, 238, 0.7),
        0 0 10px rgba(147, 112, 219, 0.5);
    }
    99% {
      text-shadow: 
        0 0 2px rgba(255, 255, 255, 0.7),
        0 0 5px rgba(123, 104, 238, 0.5),
        0 0 8px rgba(147, 112, 219, 0.3);
    }
  }
  
  /* Simplified scanlines that match the main screen */
  .panel-scanlines {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(147, 112, 219, 0.15) 50%
    );
    background-size: 100% 4px;
    pointer-events: none;
    opacity: 0.15;
    mix-blend-mode: overlay;
    z-index: 5;
  }
  
  /* Simplified CRT noise effect */
  .panel-noise {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E");
    background-size: 150px;
    opacity: 0.08;
    mix-blend-mode: overlay;
    pointer-events: none;
    z-index: 6;
  }
  
  /* Add xs breakpoint for extra small screens */
  @media (min-width: 400px) {
    .xs\:max-w-\[450px\] {
      max-width: 450px;
    }
  }
  
  /* Mobile optimizations for the hero section */
  @media (max-width: 640px) {
    /* Adjust canvas rendering for better mobile fit */
    :global(#hero canvas) {
      object-fit: cover;
      height: 100% !important;
      width: 100% !important;
    }
  }
  
  /* Ensure canvas is properly sized */
  :global(#hero canvas) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Disable complex filter animation on low-performance devices */
  .low-performance .kong-logo {
    animation: none;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 4px rgba(123, 104, 238, 0.4)); /* Apply a simpler static filter */
    mix-blend-mode: screen; /* Keep blend mode */
    opacity: 0.9; /* Keep opacity */
  }
</style> 