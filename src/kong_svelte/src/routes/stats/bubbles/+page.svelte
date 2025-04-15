<script lang="ts">
  import { goto } from "$app/navigation";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import * as THREE from 'three';
  import { onMount } from 'svelte';
  // Add TextureLoader for loading images
  import { TextureLoader } from 'three';
  // Add Object Pool implementation for better memory management
  class ObjectPool<T> {
    private pool: T[] = [];
    private createFn: () => T;
    
    constructor(createFn: () => T, initialSize: number = 0) {
      this.createFn = createFn;
      // Pre-populate the pool
      for (let i = 0; i < initialSize; i++) {
        this.pool.push(this.createFn());
      }
    }
    
    get(): T {
      if (this.pool.length > 0) {
        return this.pool.pop()!;
      }
      return this.createFn();
    }
    
    release(obj: T): void {
      this.pool.push(obj);
    }
    
    clear(): void {
      this.pool = [];
    }
  }

  // Simple quadtree implementation for collision detection
  class QuadTree {
    private boundary: { x: number, y: number, width: number, height: number };
    private capacity: number;
    private points: Array<{x: number, y: number, data: any}> = [];
    private divided: boolean = false;
    private northwest?: QuadTree;
    private northeast?: QuadTree;
    private southwest?: QuadTree;
    private southeast?: QuadTree;

    constructor(boundary: { x: number, y: number, width: number, height: number }, capacity: number = 4) {
      this.boundary = boundary;
      this.capacity = capacity;
    }

    insert(point: {x: number, y: number, data: any}): boolean {
      // If point is not in boundary, don't insert
      if (!this.contains(point)) {
        return false;
      }

      // If there's space in this node, add the point
      if (this.points.length < this.capacity && !this.divided) {
        this.points.push(point);
        return true;
      }

      // Otherwise, subdivide and add to appropriate quadrant
      if (!this.divided) {
        this.subdivide();
      }

      return (
        this.northwest?.insert(point) ||
        this.northeast?.insert(point) ||
        this.southwest?.insert(point) ||
        this.southeast?.insert(point) ||
        false
      );
    }

    queryRange(range: { x: number, y: number, radius: number }): Array<{x: number, y: number, data: any}> {
      const found: Array<{x: number, y: number, data: any}> = [];
      
      // If range doesn't intersect boundary, return empty array
      if (!this.intersects(range)) {
        return found;
      }

      // Check points in this quad
      for (const point of this.points) {
        if (this.pointInRange(point, range)) {
          found.push(point);
        }
      }

      // If this quad has been subdivided, check each child
      if (this.divided) {
        found.push(...this.northwest!.queryRange(range));
        found.push(...this.northeast!.queryRange(range));
        found.push(...this.southwest!.queryRange(range));
        found.push(...this.southeast!.queryRange(range));
      }

      return found;
    }

    contains(point: {x: number, y: number}): boolean {
      return (
        point.x >= this.boundary.x - this.boundary.width &&
        point.x <= this.boundary.x + this.boundary.width &&
        point.y >= this.boundary.y - this.boundary.height &&
        point.y <= this.boundary.y + this.boundary.height
      );
    }

    intersects(range: { x: number, y: number, radius: number }): boolean {
      // Check if range intersects boundary
      const dx = Math.abs(range.x - this.boundary.x);
      const dy = Math.abs(range.y - this.boundary.y);

      // Too far away
      if (dx > (this.boundary.width + range.radius)) return false;
      if (dy > (this.boundary.height + range.radius)) return false;

      // Close enough
      if (dx <= this.boundary.width) return true;
      if (dy <= this.boundary.height) return true;

      // Check corner distance
      const cornerDistSq = Math.pow(dx - this.boundary.width, 2) + 
                           Math.pow(dy - this.boundary.height, 2);
      
      return cornerDistSq <= Math.pow(range.radius, 2);
    }

    pointInRange(point: {x: number, y: number}, range: { x: number, y: number, radius: number }): boolean {
      const distSq = Math.pow(point.x - range.x, 2) + Math.pow(point.y - range.y, 2);
      return distSq <= Math.pow(range.radius, 2);
    }

    subdivide(): void {
      const x = this.boundary.x;
      const y = this.boundary.y;
      const w = this.boundary.width / 2;
      const h = this.boundary.height / 2;

      const nw = { x: x - w/2, y: y - h/2, width: w, height: h };
      const ne = { x: x + w/2, y: y - h/2, width: w, height: h };
      const sw = { x: x - w/2, y: y + h/2, width: w, height: h };
      const se = { x: x + w/2, y: y + h/2, width: w, height: h };

      this.northwest = new QuadTree(nw, this.capacity);
      this.northeast = new QuadTree(ne, this.capacity);
      this.southwest = new QuadTree(sw, this.capacity);
      this.southeast = new QuadTree(se, this.capacity);

      this.divided = true;

      // Move existing points to children
      for (const point of this.points) {
        this.insert(point);
      }
      this.points = [];
    }
  }

  // Types
  interface Token {
    address: string;
    symbol?: string;
    logo_url?: string;
    metrics?: {
      volume_24h?: number | string | null;
      tvl?: number | string | null;
      price_change_24h?: number | string | null;
      price?: number | string | null;
      [key: string]: any; // Allow for other properties
    };
  }

  interface BubblePosition {
    x: number;
    y: number;
    vx: number;
    vy: number;
    targetX?: number; // Target X for smooth transitions
    targetY?: number; // Target Y for smooth transitions
    mesh?: THREE.Mesh;
    textSprite?: THREE.Sprite;
    logoSprite?: THREE.Sprite;
    bubbleSize?: number; // Cache the bubble size calculation
    logoSize?: number; // Cache the logo size calculation
    fontSize?: { symbolSize: number; priceSize: number }; // Cache font size calculations
    // Add tracking for visibility and rendering state
    isVisible?: boolean;
    needsUpdate?: boolean;
  }

  // State
  let tokens = $state<Token[]>([]); // Use defined Token type
  let bubblePositions = $state<Array<BubblePosition>>([]); // Physics state + mesh reference
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let containerElement = $state<HTMLElement | undefined>(undefined);
  let animationFrameId = $state<number | undefined>(undefined);
  let isInitialized = $state(false);
  let isMobile = $state(false);
  let maxTokens = $state(100);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let hoveredToken = $state<string | null>(null); // Track currently hovered token address
  let isLowPowerDevice = $state(false); // Flag for low-power devices
  let lastFrameTime = $state(0); // For frame rate limiting
  let targetFPS = $state(60); // Target frame rate
  let bubbleSizeCache = $state<Record<string, number>>({}); // Cache for bubble size calculations

  // Three.js specific state
  let scene = $state<THREE.Scene | null>(null);
  let camera = $state<THREE.OrthographicCamera | null>(null);
  let renderer = $state<THREE.WebGLRenderer | null>(null);
  let materials = $state<Record<string, THREE.MeshBasicMaterial>>({});
  const bubbleGeometry = new THREE.CircleGeometry(0.5, 16); // Base geometry (radius 0.5), scale mesh later

  // Object pools for performance
  let positionPool = $state<ObjectPool<BubblePosition> | null>(null);
  let textureCache = $state<Record<string, THREE.Texture>>({});
  let spritePool = $state<ObjectPool<THREE.Sprite> | null>(null);
  let materialPool = $state<ObjectPool<THREE.MeshBasicMaterial> | null>(null);
  
  // Texture loader for token logos
  let textureLoader = $state<TextureLoader | null>(null);
  
  // Rendering optimization flags
  let lastRenderTime = $state(0);
  let renderDelta = $state(0);
  let isRendering = $state(false);
  let renderQueue = $state<Set<number>>(new Set());
  
  // Frame timing and metrics
  let frameCount = $state(0);
  let lastFpsTime = $state(0);
  let fps = $state(0);
  
  // Track if we're using WebGL renderer completely
  let usingWebGLRenderer = $state(false);
  let glRenderer = $state<THREE.WebGLRenderer | null>(null);
  
  // Memoization cache
  let memoizationCache = $state<Record<string, any>>({});

  // Navigation handler
  function navigateToToken(address: string) {
    // Defer navigation to avoid state mutations in event handlers
    setTimeout(() => {
      goto(`/stats/${address}`);
    }, 0);
  }

  // Define non-reactive handlers for events
  function handleTokenHover(address: string) {
    // Use a function to update the state to avoid the state_unsafe_mutation error
    setTimeout(() => {
      hoveredToken = address;
    }, 0);
  }
  
  function handleTokenUnhover() {
    // Use a function to update the state to avoid the state_unsafe_mutation error
    setTimeout(() => {
      hoveredToken = null;
    }, 0);
  }
  
  // Improved device performance detection to avoid state mutations in reactive contexts
  function detectDevicePerformance() {
    if (typeof window !== 'undefined') {
      // Check for low-end devices based on navigator info or screen size
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isOldDevice = /iphone.*(7|8|9|10|11|12|13)_|ipad.*(mini|air|pro.first|pro.second)/i.test(userAgent);
      
      // Collect changes first
      const newSettings = {
        isLowPower: isMobileDevice || isOldDevice || (window.innerWidth * window.innerHeight < 500000),
        fps: 60,
        tokens: maxTokens
      };
      
      // Set values based on conditions
      if (newSettings.isLowPower) {
        newSettings.fps = 30;
        if (isMobile && newSettings.tokens > 15) {
          newSettings.tokens = 15;
        }
      }
      
      // Apply all changes at once
      isLowPowerDevice = newSettings.isLowPower;
      targetFPS = newSettings.fps;
      if (maxTokens !== newSettings.tokens) {
        maxTokens = newSettings.tokens;
      }
    }
  }

  // Helper Functions
  function formatCurrency(value: number | string | null | undefined): string {
    if (value == null) return '$0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '$0';
    
    // Format based on magnitude
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(2)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(2)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(2)}K`;
    
    // Use more precision for smaller values - always use decimal notation
    if (numValue < 0.0001) {
      // For extremely small values, use 8 decimal places
      return `$${numValue.toFixed(8)}`;
    }
    if (numValue < 0.01) {
      // Use 6 decimal places for very small values
      return `$${numValue.toFixed(6)}`;
    }
    if (numValue < 1) {
      // Use 4 decimal places for values between 0.01 and 1
      return `$${numValue.toFixed(4)}`;
    }
    
    // Standard 2 decimal places for values >= 1
    return `$${numValue.toFixed(2)}`;
  }

  function calcBubbleSize(token: Token): number {
    // Check cache first
    const cacheKey = `${token.address}-${containerWidth}-${containerHeight}`;
    if (bubbleSizeCache[cacheKey] !== undefined) {
      return bubbleSizeCache[cacheKey];
    }

    // Get price change data
    const changePercent = token?.metrics?.price_change_24h;
    const numericValue = typeof changePercent === "string"
      ? parseFloat(changePercent)
      : changePercent;
    
    // Calculate size based on price change percentage (absolute value)
    const absVal = Math.abs(numericValue || 0);
    
    // Dynamic base size based on container dimensions and token count
    if (containerWidth && containerHeight && tokens.length) {
      // Calculate available area and desired coverage
      const screenArea = containerWidth * containerHeight;
      const tokenCount = tokens.length;
      
      // Target a specific density - adjust these values to change how filled the screen appears
      const desiredCoverage = 0.4; // 40% of screen covered by bubbles
      
      // Calculate ideal average bubble size for desired coverage
      // We divide by pi/4 because circles only cover ~78.5% of their bounding square
      const idealArea = (screenArea * desiredCoverage) / (tokenCount * (Math.PI / 4));
      const idealDiameter = Math.sqrt(idealArea);
      
      // Calculate minimum size based on screen dimensions
      const screenSize = Math.sqrt(screenArea);
      const minBaseSizeByScreen = screenSize * (isMobile ? 0.12 : 0.1); // Increased from 0.06 to 0.12 for mobile
      
      // Set bounds for minimum size
      const absoluteMinSize = isMobile ? 120 : 100; // Increased from 100 to 120 for mobile
      const minBaseSize = Math.max(absoluteMinSize, minBaseSizeByScreen);
      
      // Limit how large bubbles can get on very large screens or with few tokens
      const maxBaseDiameter = Math.min(220, screenSize * 0.15); // Max 15% of screen dimension, capped at 220px
      const baseSize = Math.min(maxBaseDiameter, Math.max(minBaseSize, idealDiameter * 0.65));
      
      // Use the calculated base size plus variation for price change
      const result = baseSize + absVal * (isMobile ? 2 : 3);
      
      // Cache the result using a function to avoid template expression mutation
      const cacheResult = () => {
        bubbleSizeCache[cacheKey] = result;
      };
      setTimeout(cacheResult, 0);
      
      return result;
    }
    
    // Fallback to fixed size if container dimensions not available yet
    const baseSize = isMobile ? 70 : 100;
    const result = baseSize + absVal * (isMobile ? 2 : 3);
    
    // Cache the fallback result
    const cacheFallbackResult = () => {
      bubbleSizeCache[cacheKey] = result;
    };
    setTimeout(cacheFallbackResult, 0);
    
    return result;
  }

  function getBubbleColor(changePercent: number | string | null | undefined): string {
    const numericValue =
      typeof changePercent === "string"
        ? parseFloat(changePercent)
        : changePercent;
    
    // Handle missing values
    if (numericValue == null || isNaN(numericValue)) return 'rgb(var(--text-secondary) / 0.8)';
    
    // Special case for zero or very small changes (absolute value less than 0.05%)
    if (Math.abs(numericValue) < 0.05) return 'rgb(var(--bg-dark) / 0.8)';
    
    // Otherwise use green for positive, red for negative
    return numericValue > 0 ? 'rgb(var(--accent-green) / 0.8)' : 'rgb(var(--accent-red) / 0.8)';
  }

  function getColorKey(changePercent: number | string | null | undefined): string {
    const numericValue =
      typeof changePercent === "string"
        ? parseFloat(changePercent)
        : changePercent;
        
    // Handle missing values
    if (numericValue == null || isNaN(numericValue)) return 'neutral';
    
    // Special case for zero or very small changes
    if (Math.abs(numericValue) < 0.05) return 'zero';
    
    // Otherwise use positive/negative keys
    return numericValue > 0 ? 'positive' : 'negative';
  }

  function calcLogoSize(bubbleSize: number) {
    // Scale logo size based on bubble size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    // Adjust scale factor based on screen size - larger screens get smaller relative logos
    const scaleFactor = isMobile ? 0.4 : Math.max(0.25, Math.min(0.35, 0.35 - (screenSize - 1000) / 20000));
    return Math.max(20, bubbleSize * scaleFactor);
  }

  function calcFontSize(bubbleSize: number) {
    // Adjust font scaling based on screen size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    const screenFactor = screenSize > 0 ? Math.min(1.2, Math.max(1, 1 + (screenSize - 1000) / 10000)) : 1;
    const mobileScale = isMobile ? 0.85 : 1;
    const sizeScale = Math.pow(bubbleSize / 100, 0.8) * screenFactor;
    
    // Slightly smaller relative font sizes on very large screens
    const symbolSize = Math.max(
      0.45,
      Math.min(1.3, bubbleSize * 0.06 * mobileScale * sizeScale),
    );
    const priceSize = Math.max(
      0.35,
      Math.min(1.1, bubbleSize * 0.045 * mobileScale * sizeScale),
    );
    return { symbolSize, priceSize };
  }

  function getSymbolStyle(symbol: string | undefined, fontSize: number) {
    if (symbol && symbol.length > 4) {
      // Adjust reduction more gradually for larger screens
      const reductionBase = containerWidth > 1200 ? 0.8 : 0.9;
      const reductionFactor = Math.min(0.7, reductionBase - (symbol.length - 4) * 0.05);
      return `font-size: ${fontSize * reductionFactor}rem; letter-spacing: -0.5px;`;
    }
    return `font-size: ${fontSize}rem;`;
  }

  function ensureMaterials() {
    // Only create if they don't exist
    if (Object.keys(materials).length === 0) {
      console.log("Creating materials");
      // Get colors from CSS variables using theme values
      let positiveColor = 0x00ff00; // Default green fallback
      let negativeColor = 0xff0000; // Default red fallback
      let neutralColor = 0x808080; // Default gray fallback
      let zeroColor = 0x101010; // Default dark fallback

      try {
          if (typeof getComputedStyle !== 'undefined') {
            const style = getComputedStyle(document.documentElement);
            // Use theme color variables from tailwind config
            positiveColor = new THREE.Color(style.getPropertyValue('--accent-green').trim() || 
                                          'rgb(var(--accent-green))').getHex();
            negativeColor = new THREE.Color(style.getPropertyValue('--accent-red').trim() || 
                                          'rgb(var(--accent-red))').getHex();
            neutralColor = new THREE.Color(style.getPropertyValue('--text-secondary').trim() || 
                                         'rgb(var(--text-secondary))').getHex();
            zeroColor = new THREE.Color(style.getPropertyValue('--bg-dark').trim() || 
                                      'rgb(var(--bg-dark))').getHex();
          }
      } catch (e) {
          console.warn("Could not parse CSS variables for theme colors, using defaults.", e);
      }

      // Create new materials object
      const newMaterials = {
        positive: new THREE.MeshBasicMaterial({ color: positiveColor, transparent: true, opacity: 0.8 }),
        negative: new THREE.MeshBasicMaterial({ color: negativeColor, transparent: true, opacity: 0.8 }),
        neutral: new THREE.MeshBasicMaterial({ color: neutralColor, transparent: true, opacity: 0.8 }),
        zero: new THREE.MeshBasicMaterial({ color: zeroColor, transparent: true, opacity: 0.8 })
      };
      
      // Update state in a deferred way
      setTimeout(() => {
        materials = newMaterials;
      }, 0);
    }
  }

  // Memoize expensive calculations
  function memoize<T>(fn: (...args: any[]) => T, keyFn: (...args: any[]) => string): (...args: any[]) => T {
    return (...args: any[]): T => {
      const key = keyFn(...args);
      if (memoizationCache[key] === undefined) {
        const result = fn(...args);
        // Defer the cache update to avoid state mutations in template expressions
        setTimeout(() => {
          memoizationCache[key] = result;
        }, 0);
        return result;
      }
      return memoizationCache[key];
    };
  }
  
  // Memoized versions of expensive calculations
  const calcBubbleSizeMemoized = memoize(calcBubbleSize, 
    (token: Token) => `bubbleSize-${token.address}-${containerWidth}-${containerHeight}`);
  
  const calcLogoSizeMemoized = memoize(calcLogoSize,
    (bubbleSize: number) => `logoSize-${bubbleSize}-${containerWidth}-${containerHeight}`);
    
  const calcFontSizeMemoized = memoize(calcFontSize,
    (bubbleSize: number) => `fontSize-${bubbleSize}-${containerWidth}-${containerHeight}`);
    
  const getBubbleColorMemoized = memoize(getBubbleColor,
    (changePercent: number | string | null | undefined) => 
      `bubbleColor-${typeof changePercent === 'string' ? changePercent : String(changePercent)}`);

  // Initialize Three.js rendering system
  function initThreeJS() {
    if (scene) return; // Already initialized
    
    // Initialize pools
    positionPool = new ObjectPool<BubblePosition>(() => ({
      x: 0, y: 0, vx: 0, vy: 0, isVisible: false, needsUpdate: true
    }));
    
    spritePool = new ObjectPool<THREE.Sprite>(() => new THREE.Sprite(
      new THREE.SpriteMaterial({ color: 0xffffff, transparent: true })
    ));
    
    materialPool = new ObjectPool<THREE.MeshBasicMaterial>(() => 
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8 })
    );
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create orthographic camera
    const aspect = containerWidth / containerHeight;
    camera = new THREE.OrthographicCamera(
      -containerWidth / 2, containerWidth / 2, 
      containerHeight / 2, -containerHeight / 2, 
      0.1, 1000
    );
    camera.position.z = 100;
    
    // Create WebGL renderer with transparency
    if (!glRenderer) {
      glRenderer = new THREE.WebGLRenderer({ 
        antialias: !isLowPowerDevice,
        alpha: true,
        powerPreference: isLowPowerDevice ? 'low-power' : 'high-performance'
      });
      
      glRenderer.setSize(containerWidth, containerHeight);
      glRenderer.setPixelRatio(window.devicePixelRatio > 2 && isLowPowerDevice ? 2 : window.devicePixelRatio);
      glRenderer.setClearColor(0x000000, 0); // Transparent background
      
      // Append to container
      if (containerElement) {
        containerElement.appendChild(glRenderer.domElement);
        // Apply styles to the canvas
        const canvas = glRenderer.domElement;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none'; // Let events go through to the DOM elements
      }
    }
    
    // Initialize texture loader
    textureLoader = new TextureLoader();
    
    // Create the basic materials
    ensureMaterials();
    
    usingWebGLRenderer = true;
    console.log("Three.js initialized with WebGL renderer");
  }
  
  // Create or update Three.js meshes for bubbles
  function updateThreeMeshes() {
    if (!scene || !tokens.length || !bubblePositions.length) return;
    
    // Check if the number of meshes matches the number of tokens
    const adjustMeshCount = () => {
      const currentMeshCount = scene.children.length;
      
      // Add missing meshes
      if (currentMeshCount < tokens.length) {
        for (let i = currentMeshCount; i < tokens.length; i++) {
          if (!bubblePositions[i].mesh) {
            // Create mesh
            const geometry = bubbleGeometry.clone();
            const material = materials[getColorKey(tokens[i]?.metrics?.price_change_24h)].clone();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.z = 0;
            scene.add(mesh);
            bubblePositions[i].mesh = mesh;
          }
        }
      }
      // Remove extra meshes
      else if (currentMeshCount > tokens.length) {
        for (let i = tokens.length; i < currentMeshCount; i++) {
          if (scene.children[i]) {
            scene.remove(scene.children[i]);
          }
        }
      }
    };
    
    adjustMeshCount();
    
    // Update mesh positions, sizes, and materials
    for (let i = 0; i < tokens.length; i++) {
      const pos = bubblePositions[i];
      if (!pos || !pos.mesh) continue;
      
      const token = tokens[i];
      const colorKey = getColorKey(token?.metrics?.price_change_24h);
      
      // Only update when necessary
      if (pos.needsUpdate) {
        // Use cached or calculate size
        const bubbleSize = pos.bubbleSize ?? calcBubbleSizeMemoized(token);
        const scale = bubbleSize / 100; // Normalize to base size
        
        // Update position and scale
        pos.mesh.position.set(pos.x - containerWidth/2, -pos.y + containerHeight/2, 0);
        pos.mesh.scale.set(scale, scale, 1);
        
        // Update material if needed
        if (pos.mesh.material !== materials[colorKey]) {
          pos.mesh.material = materials[colorKey];
        }
        
        // Mark as updated
        pos.needsUpdate = false;
      }
    }
  }
  
  // Handle WebGL rendering loop
  function renderThreeScene() {
    if (!isRendering) return;
    
    const currentTime = performance.now();
    renderDelta = currentTime - lastRenderTime;
    
    // Calculate FPS
    frameCount++;
    if (currentTime - lastFpsTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (currentTime - lastFpsTime));
      frameCount = 0;
      lastFpsTime = currentTime;
    }
    
    // Update meshes if needed
    updateThreeMeshes();
    
    // Render scene
    if (glRenderer && scene && camera) {
      glRenderer.render(scene, camera);
    }
    
    lastRenderTime = currentTime;
    requestAnimationFrame(renderThreeScene);
  }
  
  // Start WebGL rendering loop
  function startRendering() {
    if (isRendering) return;
    isRendering = true;
    lastRenderTime = performance.now();
    lastFpsTime = lastRenderTime;
    frameCount = 0;
    renderThreeScene();
  }
  
  // Stop WebGL rendering loop
  function stopRendering() {
    isRendering = false;
  }

  // Core Logic Functions (adapted for runes)
  function initializePositions() {
    // Guard against running before container/tokens/dimensions are ready
    if (!containerElement || tokens.length === 0 || containerWidth === 0 || containerHeight === 0) {
        console.warn("Skipping initializePositions: prerequisites not met.", { hasContainer: !!containerElement, tokenCount: tokens.length, width: containerWidth, height: containerHeight });
        return null;
    }

    const width = containerWidth;
    const height = containerHeight;
    const numTokens = tokens.length;
    
    // Adjust grid layout based on container aspect ratio
    const aspectRatio = width / height;
    const colToRowRatio = Math.sqrt(numTokens * aspectRatio);
    const cols = Math.ceil(Math.sqrt(numTokens * colToRowRatio));
    const rows = Math.ceil(numTokens / cols);

    // Precalculate bubble sizes once to improve performance
    const tokenSizes = tokens.map(token => calcBubbleSize(token));
    const maxBubbleSize = Math.max(0, ...tokenSizes);

    const cellWidth = Math.max(maxBubbleSize * 1.2, width / cols);
    const cellHeight = Math.max(maxBubbleSize * 1.2, height / rows);
    const margin = maxBubbleSize / 2;
    const usableWidth = width - margin * 2;
    const usableHeight = height - margin * 2;

    // Create new positions array
    return tokens.map((token, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const randomAngle = Math.random() * Math.PI * 2;
      const randomRadius = Math.random() * cellWidth * 0.3;
      const offsetX = Math.cos(randomAngle) * randomRadius;
      const offsetY = Math.sin(randomAngle) * randomRadius;
      const baseX = margin + (usableWidth * (col + 0.5)) / cols;
      const baseY = margin + (usableHeight * (row + 0.5)) / rows;
      
      // Precalculate sizes for better performance
      const bubbleSize = tokenSizes[index];
      const logoSize = calcLogoSize(bubbleSize);
      const fontSize = calcFontSize(bubbleSize);

      return {
        x: baseX + offsetX,
        y: baseY + offsetY,
        targetX: baseX + offsetX, // Initialize target to current position
        targetY: baseY + offsetY, // Initialize target to current position
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        bubbleSize,
        logoSize,
        fontSize
      };
    });
  }

  function updatePositions() {
    if (!bubblePositions.length || !tokens.length || bubblePositions.length !== tokens.length) return;
    
    // Frame rate limiting
    const now = performance.now();
    const elapsed = now - lastFrameTime;
    const frameInterval = 1000 / targetFPS;
    
    // Skip frame if not enough time has passed
    if (elapsed < frameInterval) {
      animationFrameId = requestAnimationFrame(updatePositions);
      return;
    }
    
    // Update last frame time with adjustment to avoid drift
    lastFrameTime = now - (elapsed % frameInterval);
    
    // Optimize parameters for low-power devices
    const damping = isLowPowerDevice ? 0.92 : 0.95;
    const repulsionStrength = isLowPowerDevice ? 1.8 : 2.2;
    
    // Scale minimum distance between bubbles based on screen size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    const minDistance = screenSize > 0 
      ? Math.max(20, Math.min(40, 30 * (screenSize / 1200))) 
      : 25;
    
    const maxSpeed = isLowPowerDevice ? 4 : 5;
    const velocitySmoothing = isLowPowerDevice ? 0.8 : 0.7;
    
    // Scale float strength with screen size - larger screens get slightly more movement
    const baseFloatStrength = isLowPowerDevice ? 0.03 : 0.05;
    const floatStrength = screenSize > 0 
      ? baseFloatStrength * Math.max(0.8, Math.min(1.2, screenSize / 1200))
      : baseFloatStrength;
    
    const time = Date.now() / 1000; // Current time in seconds for oscillation

    // Update bubbles in fewer iterations on low-power devices
    const updateStep = isLowPowerDevice ? 3 : 1; // Increased step for low-power devices
    
    // Create a new array to avoid direct state mutation
    const updatedPositions = [...bubblePositions];

    // Find maximum bubble size for quadtree radius calculations
    let maxBubbleSize = 0;
    for (const pos of bubblePositions) {
      if (pos.bubbleSize && pos.bubbleSize > maxBubbleSize) {
        maxBubbleSize = pos.bubbleSize;
      }
    }
    
    // Create quadtree with boundaries matching container
    const quadtree = new QuadTree({ 
      x: containerWidth / 2, 
      y: containerHeight / 2, 
      width: containerWidth / 2, 
      height: containerHeight / 2 
    }, 8); // Higher capacity for better performance

    // Insert all bubbles into quadtree
    for (let i = 0; i < bubblePositions.length; i++) {
      const pos = bubblePositions[i];
      // Skip missing tokens or positions without metrics
      if (!tokens[i]?.metrics) continue;
      
      // Use cached bubble size if available, otherwise calculate and cache
      const bubbleSize = pos.bubbleSize ?? calcBubbleSizeMemoized(tokens[i]);
      
      quadtree.insert({
        x: pos.x,
        y: pos.y,
        data: { index: i, size: bubbleSize }
      });
    }
    
    // Track which positions need visual updates
    const needsVisualUpdate = new Set<number>();
    
    for (let i = 0; i < bubblePositions.length; i += updateStep) {
      const pos = bubblePositions[i];
      // Ensure token exists at this index, defensively
      if (!tokens[i]?.metrics) continue;
      
      // Use cached bubble size if available, otherwise calculate and cache
      const bubbleSize = pos.bubbleSize ?? calcBubbleSizeMemoized(tokens[i]);
      const radius = bubbleSize / 2;

      let forceX = 0; // Accumulate forces
      let forceY = 0;

      // Add gentle floating motion using sine waves with offset based on index
      // This creates a more natural, continuous bubble-like movement
      const phase = i * 0.2; // Different phase for each bubble
      forceX += Math.sin(time * 0.5 + phase) * floatStrength;
      forceY += Math.cos(time * 0.3 + phase * 1.5) * floatStrength;

      // Smooth transition to target position if it exists and not too close already
      if (pos.targetX !== undefined && pos.targetY !== undefined) {
        const dx = pos.targetX - pos.x;
        const dy = pos.targetY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Only apply transition force if we're not very close to target
        if (dist > 1.0) {
          // Use a weaker pull for large distances to prevent sudden jumps
          const transitionSpeed = Math.min(0.08, 0.5 / dist);
          forceX += dx * transitionSpeed;
          forceY += dy * transitionSpeed;
        } else {
          // If we're close enough, snap to target and clear it
          const newPos = {...updatedPositions[i]};
          newPos.x = pos.targetX;
          newPos.y = pos.targetY;
          newPos.targetX = undefined;
          newPos.targetY = undefined;
          newPos.needsUpdate = true;
          needsVisualUpdate.add(i);
          updatedPositions[i] = newPos;
          continue;
        }
      }

      // Use quadtree for collision detection - much more efficient than checking all pairs
      const searchRadius = bubbleSize / 2 + maxBubbleSize / 2 + minDistance;
      const nearbyBubbles = quadtree.queryRange({ 
        x: pos.x, 
        y: pos.y, 
        radius: searchRadius 
      });

      // Process repulsion from nearby bubbles only
      for (const nearby of nearbyBubbles) {
        const j = nearby.data.index;
        if (i === j) continue; // Skip self
        
        // Get the other bubble's position
        const pos2 = bubblePositions[j];
        if (!pos2) continue; // Safety check
        
        // Use cached size or get from nearby data
        const size2 = nearby.data.size;
        
        const dx = pos2.x - pos.x;
        const dy = pos2.y - pos.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        distance = Math.max(0.1, distance); // Prevent division by zero
        const minDist = (bubbleSize + size2) / 2 + minDistance;

        if (distance < minDist) {
          const overlap = Math.min(1, (minDist - distance) / minDist);
          const force = repulsionStrength * overlap * overlap; // squared overlap for stronger push at close distance
          forceX -= (dx / distance) * force;
          forceY -= (dy / distance) * force;
        }
      }

      // Boundary forces (smoother version)
      const boundaryMargin = radius + 10;
      const boundaryForce = isLowPowerDevice ? 0.6 : 0.7;

      if (pos.x < boundaryMargin) {
        forceX += boundaryForce * (boundaryMargin - pos.x);
      }
      if (pos.x > containerWidth - boundaryMargin) {
        forceX -= boundaryForce * (pos.x - (containerWidth - boundaryMargin));
      }
      if (pos.y < boundaryMargin) {
        forceY += boundaryForce * (boundaryMargin - pos.y);
      }
      if (pos.y > containerHeight - boundaryMargin) {
        forceY -= boundaryForce * (pos.y - (containerHeight - boundaryMargin));
      }

      // Performance optimization: Skip bubbles that are far off-screen
      const offScreenDistance = Math.max(bubbleSize, 100);
      if (pos.x < -offScreenDistance || 
          pos.x > containerWidth + offScreenDistance || 
          pos.y < -offScreenDistance || 
          pos.y > containerHeight + offScreenDistance) {
        // If bubble is far off-screen, give it a strong force toward the center
        const centerForce = 0.2;
        forceX += (containerWidth / 2 - pos.x) * centerForce;
        forceY += (containerHeight / 2 - pos.y) * centerForce;
      }

      // Create a new position object to avoid mutating state directly
      const newPos = {...updatedPositions[i]};
      
      // Apply forces to velocity with smoothing
      newPos.vx = pos.vx * velocitySmoothing + forceX * (1 - velocitySmoothing);
      newPos.vy = pos.vy * velocitySmoothing + forceY * (1 - velocitySmoothing);

      // Apply damping
      newPos.vx *= damping;
      newPos.vy *= damping;

      // Limit speed
      const speed = Math.sqrt(newPos.vx * newPos.vx + newPos.vy * newPos.vy);
      if (speed > maxSpeed) {
        newPos.vx = (newPos.vx / speed) * maxSpeed;
        newPos.vy = (newPos.vy / speed) * maxSpeed;
      }

      // Calculate if position changed enough to need visual update
      // Only update visuals if position changed by at least 0.5px for performance
      const oldX = pos.x;
      const oldY = pos.y;
      
      // Update position
      newPos.x += newPos.vx;
      newPos.y += newPos.vy;
      
      // Check if we need to update the visual (mesh positions)
      if (Math.abs(newPos.x - oldX) > 0.5 || Math.abs(newPos.y - oldY) > 0.5) {
        newPos.needsUpdate = true;
        needsVisualUpdate.add(i);
      }
      
      // Cache calculated sizes if not already cached
      if (!newPos.bubbleSize) newPos.bubbleSize = bubbleSize;
      if (!newPos.logoSize) newPos.logoSize = calcLogoSizeMemoized(bubbleSize);
      if (!newPos.fontSize) newPos.fontSize = calcFontSizeMemoized(bubbleSize);
      
      // Replace the original position with our updated one
      updatedPositions[i] = newPos;
    }
    
    // Update the state array with our new positions
    bubblePositions = updatedPositions;
    
    // Update render queue with indices that need visual updates
    renderQueue = needsVisualUpdate;

    // Always keep animation running for constant gentle movement
    animationFrameId = requestAnimationFrame(updatePositions);
  }

  async function loadTokens() {
    // Set loading state in a deferred way
    setTimeout(() => {
      loading = true;
    }, 0);

    try {
      // Use requestIdleCallback if available for non-critical operations
      const useIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
      
      const response = await fetchTokens();
      
      // Filter tokens in a more efficient way
      const processTokens = () => {
        const fetchedTokens = response.tokens
          .filter(
            (token) =>
              Number(token.metrics?.volume_24h) > 0 &&
              Number(token.metrics?.tvl) > 100,
          )
          // Use the current $state value of maxTokens
          .slice(0, maxTokens);

        // Check if the actual set of token addresses has changed - use Map for faster lookups
        const oldAddresses = new Map(tokens.map(t => [t.address, t]));
        const newAddressSet = new Set(fetchedTokens.map((t: Token) => t.address));
        
        // Quick comparison of address sets
        const sizeChanged = oldAddresses.size !== newAddressSet.size;
        const contentChanged = !sizeChanged && 
          fetchedTokens.some((t: Token) => !oldAddresses.has(t.address));
        
        const shouldReplaceTokens = sizeChanged || contentChanged || tokens.length === 0;

        // Update state in a deferred way
        setTimeout(() => {
          if (shouldReplaceTokens) {
            // If token set changed or it's the initial load, replace tokens and reset initialization
            tokens = fetchedTokens;
            isInitialized = false; // This will trigger the initialization effect
            // Clear potentially mismatched positions
            bubblePositions = [];
            // Reset error state on successful load/reset
            error = null;
            // Clear bubble size cache when tokens change
            memoizationCache = {};
            bubbleSizeCache = {};
          } else {
            // Optimized token data update - avoid recreating objects when possible
            const updatedTokens = tokens.map(oldToken => {
              const updatedTokenData = fetchedTokens.find(t => t.address === oldToken.address);
              // Return same object if no changes, otherwise create new one with updated metrics
              if (!updatedTokenData) return oldToken;
              
              // Only create new object if metrics actually changed - with proper type casting
              const oldMetrics = (oldToken.metrics || {}) as Token['metrics'];
              const newMetrics = (updatedTokenData.metrics || {}) as Token['metrics'];
              
              // Safe comparison using nullish coalescing
              const metricsChanged = 
                (oldMetrics?.price ?? null) !== (newMetrics?.price ?? null) ||
                (oldMetrics?.price_change_24h ?? null) !== (newMetrics?.price_change_24h ?? null) ||
                (oldMetrics?.volume_24h ?? null) !== (newMetrics?.volume_24h ?? null) ||
                (oldMetrics?.tvl ?? null) !== (newMetrics?.tvl ?? null);
                
              return metricsChanged ? { ...oldToken, metrics: newMetrics } : oldToken;
            });
            
            tokens = updatedTokens;
            error = null;
          }
          // Update loading state
          loading = false;
        }, 0);
      };
      
      if (useIdleCallback) {
        // Use idle callback for non-blocking processing
        (window as any).requestIdleCallback(() => processTokens());
      } else {
        // Fall back to direct processing
        processTokens();
      }
    } catch (e) {
      console.error("Error loading tokens:", e);
      
      // Update error state in a deferred way
      setTimeout(() => {
        error = "Failed to load token data";
        loading = false;
      }, 0);
    }
  }
  
  // Add function to optimize logo loading
  function preloadTokenLogos() {
    if (!textureLoader || !tokens.length) return;
    
    // Only preload a reasonable number at a time
    const maxPreload = isLowPowerDevice ? 5 : 15;
    let preloadCount = 0;
    
    // Process logos in chunks during idle time
    const processNextBatch = (startIndex = 0) => {
      if (startIndex >= tokens.length) return;
      
      const useIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
      const endIndex = Math.min(startIndex + maxPreload, tokens.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const token = tokens[i];
        if (!token?.logo_url || textureCache[token.logo_url]) continue;
        
        // Preload texture
        textureLoader.load(token.logo_url, texture => {
          textureCache[token.logo_url] = texture;
        });
        preloadCount++;
      }
      
      // Schedule next batch if needed
      if (endIndex < tokens.length) {
        if (useIdleCallback) {
          (window as any).requestIdleCallback(() => processNextBatch(endIndex));
        } else {
          setTimeout(() => processNextBatch(endIndex), 100);
        }
      }
    };
    
    // Start preloading
    processNextBatch();
  }

  // Effect for setup, teardown, and managing resize/intervals
  $effect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        // Use RAF to batch resize operations
        requestAnimationFrame(() => {
          // Collect all changes before applying them
          let changes = {
            mobile: window.innerWidth < 768,
            maxTokens: maxTokens,
            width: containerWidth,
            height: containerHeight,
            clearCache: false
          };
          
          // Detect device performance once (doesn't mutate state directly now)
          detectDevicePerformance();
          
          // Update mobile status and related settings
          if (isMobile !== changes.mobile) {
            changes.clearCache = true;
            changes.maxTokens = changes.mobile ? 
              (isLowPowerDevice ? 15 : 20) : 
              (isLowPowerDevice ? 50 : 100);
          }
          
          // Process container dimensions
          if (containerElement) {
            const rect = containerElement.getBoundingClientRect();
            // Prevent setting 0x0 dimensions initially if element isn't ready
            if (rect.width > 0 && rect.height > 0) {
              // Only update if dimensions changed significantly (more than 5px)
              if (Math.abs(containerWidth - rect.width) > 5 || Math.abs(containerHeight - rect.height) > 5) {
                changes.width = rect.width;
                changes.height = rect.height;
                changes.clearCache = true;
              }
            } else if (containerWidth !== 0 || containerHeight !== 0) {
              // If element becomes 0x0 (e.g., display:none), reset dimensions
              changes.width = 0;
              changes.height = 0;
            }
          }
          
          // Apply all changes at once, but defer the state update
          setTimeout(() => {
            if (changes.clearCache) {
              memoizationCache = {};
              bubbleSizeCache = {};
            }
            if (isMobile !== changes.mobile) {
              isMobile = changes.mobile;
            }
            if (maxTokens !== changes.maxTokens) {
              maxTokens = changes.maxTokens;
            }
            if (containerWidth !== changes.width) {
              containerWidth = changes.width;
            }
            if (containerHeight !== changes.height) {
              containerHeight = changes.height;
            }
          }, 0);
        });
      }
    };

    handleResize(); // Initial call
    loadTokens(); // Initial load

    // Use debounced resize handler to reduce performance impact
    let resizeTimeout: number | undefined;
    let rafId: number | undefined;
    
    const debouncedResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (rafId) cancelAnimationFrame(rafId);
      
      resizeTimeout = window.setTimeout(() => {
        rafId = requestAnimationFrame(handleResize);
      }, 100);
    };
    
    window.addEventListener("resize", debouncedResize, { passive: true });
    
    // Reduce data refresh frequency for low-power devices
    const refreshInterval = isLowPowerDevice ? 60000 : 30000;
    const interval = setInterval(loadTokens, refreshInterval);

    let resizeObserver: ResizeObserver | undefined;
    if (containerElement) {
      resizeObserver = new ResizeObserver(entries => {
        // Use requestAnimationFrame to batch DOM measurements
        if (rafId) cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(() => handleResize());
      });
      resizeObserver.observe(containerElement);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("resize", debouncedResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      clearInterval(interval);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined; // Reset state
      }
      console.log("Cleanup effect ran.");
    };
  });

  // Effect for initializing positions and starting animation when conditions are met
  $effect(() => {
    // Check if we are ready to initialize *and* haven't initialized yet
    if (containerElement && tokens.length > 0 && containerWidth > 0 && containerHeight > 0 && !isInitialized) {
      console.log("Dependencies met for initialization.");
      
      // Initialize Three.js if needed
      if (!scene && usingWebGLRenderer) {
        initThreeJS();
        startRendering();
      }
      
      // Preload logos in the background
      preloadTokenLogos();
      
      const newPositions = initializePositions();
      if (newPositions) {
        bubblePositions = newPositions;
        isInitialized = true;
        console.log("Positions initialized.");
      }

      // Initialize the last frame time
      lastFrameTime = performance.now();
      
      // Start the animation loop *after* initialization
      if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear previous frame just in case
      animationFrameId = requestAnimationFrame(updatePositions);
      console.log("Animation loop started.");
    } else if (isInitialized && tokens.length > 0 && !animationFrameId && containerWidth > 0 && containerHeight > 0) {
        // If initialized, have tokens, but animation isn't running (e.g., after stopping), restart it.
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(updatePositions);
    } else if ((tokens.length === 0 || containerWidth === 0 || containerHeight === 0) && animationFrameId) {
        // If conditions to run animation are no longer met, stop it.
        console.log("Stopping animation loop due to missing prerequisites.");
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
    }
  });

  // Add effect for automatic resource cleanup
  $effect(() => {
    // Clear memoization cache when token count changes significantly
    // to prevent memory leaks from cached values for removed tokens
    if (tokens.length && bubblePositions.length && 
        Math.abs(tokens.length - Object.keys(memoizationCache).length / 4) > 20) {
      setTimeout(() => {
        // Keep only relevant entries
        const newCache: Record<string, any> = {};
        const addresses = new Set(tokens.map(t => t.address));
        
        // Only keep entries for current tokens
        Object.entries(memoizationCache).forEach(([key, value]) => {
          // Check if key contains a token address, and if so, whether that token is still present
          const shouldKeep = !key.includes('bubbleSize-') || 
                             addresses.has(key.split('bubbleSize-')[1]?.split('-')[0]);
          if (shouldKeep) {
            newCache[key] = value;
          }
        });
        
        memoizationCache = newCache;
      }, 0);
    }
  });

  // Remove onDestroy as cleanup is handled by $effect return function

  $effect(() => {
    if (!scene || !renderer || !isInitialized || !tokens.length || !bubblePositions.length || !Object.keys(materials).length) {
        // Clear scene if prerequisites lost (e.g., tokens cleared)
        if (scene && scene.children.length > 0) {
            while(scene.children.length > 0){ scene.remove(scene.children[0]); }
        }
    }
  });

  onMount(() => {
    // Initialize Three.js after DOM is ready
    if (containerElement && containerWidth > 0 && containerHeight > 0) {
      initThreeJS();
      startRendering();
    }
  });
</script>

<svelte:head>
  <title>Market Bubbles - KongSwap</title>
</svelte:head>

<div class="bubbles-container" bind:this={containerElement}>
  {#if loading && !tokens.length}
    <div class="loading">Loading tokens...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <!-- Show bubbles using the optimized hybrid approach -->
    {#each tokens as token, i}
      {@const bubblePos = bubblePositions[i] ?? {} as BubblePosition}
      {@const bubbleSize = bubblePos.bubbleSize ?? calcBubbleSizeMemoized(token)}
      {@const logoSize = bubblePos.logoSize ?? calcLogoSizeMemoized(bubbleSize)}
      {@const fontSize = bubblePos.fontSize ?? calcFontSizeMemoized(bubbleSize)}
      {@const bubbleColor = getBubbleColorMemoized(token?.metrics?.price_change_24h)}
      {@const colorKey = getColorKey(token?.metrics?.price_change_24h)}
      {@const hoverColor = colorKey === "positive"
        ? "rgb(var(--accent-green-hover) / 0.8)"
        : colorKey === "negative"
          ? "rgb(var(--accent-red-hover) / 0.8)"
          : colorKey === "zero"
            ? "rgb(var(--bg-light) / 0.8)"
            : "rgb(var(--text-primary) / 0.8)"}
      {@const isHovered = hoveredToken === token.address}
      
      <!-- Only render DOM elements for mouse interaction and text/logos -->
      <div
        class="bubble-hitbox {isHovered ? 'bubble-hovered' : ''}"
        on:click={() => navigateToToken(token.address)}
        on:mouseenter={() => handleTokenHover(token.address)}
        on:mouseleave={() => handleTokenUnhover()}
        style="
          width: {bubbleSize}px;
          height: {bubbleSize}px;
          transform: translate3d(
            {(bubblePos.x || 0) - bubbleSize / 2}px,
            {(bubblePos.y || 0) - bubbleSize / 2}px,
            0
          );
          will-change: transform;
          opacity: {usingWebGLRenderer ? 1 : 0.95};
          pointer-events: auto;
        "
      >
        <!-- Only render bubble background in DOM if WebGL isn't active -->
        {#if !usingWebGLRenderer}
          <div
            class="bubble"
            style="
              width: 100%;
              height: 100%;
              background-color: {bubbleColor};
              --hover-color: {hoverColor};
            "
          ></div>
        {/if}
        
        <!-- Always render text and logos in DOM for better quality -->
        <div class="token-label" style="pointer-events: none;">
          {#if token?.logo_url}
            <img
              src={token.logo_url}
              alt={token.symbol}
              class="token-logo"
              loading="lazy"
              style="width: {logoSize}px; height: {logoSize}px;"
            />
          {/if}
          <span
            class="token-symbol"
            style={getSymbolStyle(token?.symbol, fontSize.symbolSize)}
          >{token?.symbol}</span>
          {#if token?.metrics?.price_change_24h != null}
            <span
              class="price-change"
              style="font-size: {fontSize.priceSize}rem;"
            >
              {typeof token.metrics.price_change_24h === "number"
                ? token.metrics.price_change_24h.toFixed(2)
                : parseFloat(token.metrics.price_change_24h).toFixed(2)}%
            </span>
          {/if}
        </div>
        
        {#if isHovered}
        <div class="bubble-tooltip">
          <div class="tooltip-content">
            <div class="tooltip-row">
              <span class="tooltip-label">Volume:</span>
              <span class="tooltip-value">{formatCurrency(token?.metrics?.volume_24h)}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">TVL:</span>
              <span class="tooltip-value">{formatCurrency(token?.metrics?.tvl)}</span>
            </div>
            {#if token?.metrics?.price}
            <div class="tooltip-row">
              <span class="tooltip-label">Price:</span>
              <span class="tooltip-value">{formatCurrency(token?.metrics?.price)}</span>
            </div>
            {/if}
          </div>
        </div>
        {/if}
      </div>
    {/each}
  {/if}
  
  <!-- Canvas debugging overlay (only in dev) -->
  {#if import.meta.env?.DEV && fps > 0}
    <div class="debug-overlay">
      <span>FPS: {fps}</span>
    </div>
  {/if}
</div>

<style scoped>
  .bubbles-container {
    position: relative;
    width: 100%;
    height: 85vh;
    overflow: hidden;
    /* Add touch handling for mobile */
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .bubble {
    position: absolute;
    border-radius: 50%;
    color: #fff;
    font-size: 0.9rem;
    text-align: center;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    /* Add hardware acceleration */
    will-change: transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    /* Remove transition for smoother animation - already removed */
    pointer-events: none; /* Hitbox handles pointer events */
    transition: transform 0.2s ease-out;
  }

  .bubble-hitbox {
    position: absolute;
    cursor: pointer;
    transform-origin: center center;
    will-change: transform, opacity;
    transition: transform 0.15s ease-out;
    z-index: 1; /* Base z-index for all bubbles */
    /* Hardware acceleration for smoother animations */
    transform: translate3d(0, 0, 0);
    contain: layout style paint; /* Contain rendering for better performance */
  }

  /* Add new style for hovered bubbles */
  .bubble-hovered {
    z-index: 100 !important; /* Higher z-index when hovered */
  }

  .bubble-hitbox:hover {
    transform: translate3d(calc(var(--x, 0) - var(--bubble-size, 0) / 2), 
                         calc(var(--y, 0) - var(--bubble-size, 0) / 2), 
                         0) scale(1.1);
  }
  
  .bubble-hitbox:hover .bubble {
    transform: scale(1.1);
    background-color: var(--hover-color) !important;
  }

  .token-label {
    max-width: 90%;
    /* Adjust padding for mobile */
    padding: clamp(0.15rem, 2vw, 0.25rem);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    will-change: transform;
    -webkit-font-smoothing: antialiased;
    contain: content; /* Contain content for better performance */
  }

  .token-logo {
    border-radius: 50%;
    margin-bottom: clamp(0.15em, 1.5vw, 0.25em);
    object-fit: contain;
    will-change: transform; /* Hint for hardware acceleration */
    transform: translateZ(0); /* Force GPU rendering */
  }

  .token-symbol {
    font-weight: bold;
    margin-bottom: clamp(0.1em, 1vw, 0.15em);
    line-height: 1;
    /* Prevent text wrapping */
    white-space: nowrap;
  }

  .price-change {
    opacity: 0.9;
    line-height: 1;
  }

  .bubble-tooltip {
    position: absolute;
    top: 105%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgb(var(--bg-dark) / 0.95); /* More opaque background */
    border: 1px solid rgb(var(--border) / 0.8);
    border-radius: 8px;
    padding: calc(0.5rem + 0.2vw) calc(0.75rem + 0.3vw); /* Responsive padding */
    z-index: 1000;
    width: max-content;
    min-width: clamp(160px, 12vw, 220px); /* Responsive min-width */
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4); /* Stronger shadow */
    color: rgb(var(--text-primary));
    font-size: clamp(0.85rem, 0.75rem + 0.3vw, 1rem); /* Responsive font size */
    pointer-events: none;
    opacity: 0;
    animation: fadeIn 0.2s forwards;
    will-change: transform, opacity;
    contain: content; /* Optimize rendering */
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  .tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .tooltip-label {
    color: rgb(var(--text-secondary));
    font-weight: 500;
  }

  .tooltip-value {
    color: rgb(var(--text-primary));
    font-weight: 600;
  }
  
  /* Debug overlay for performance monitoring */
  .debug-overlay {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    font-size: 12px;
    font-family: monospace;
    z-index: 9999;
  }

  /* Add mobile-specific styles */
  @media (max-width: 768px) {
    .bubbles-container {
      height: 80vh; /* Slightly shorter on mobile */
    }

    .bubble-hitbox:hover .bubble {
      transform: none; /* Disable hover effect on mobile */
    }

    .bubble:active {
      transform: scale(1.05); /* Use active state instead of hover */
      background-color: var(--hover-color) !important;
    }
    
    .bubble-tooltip {
      display: none; /* Hide tooltips on mobile */
    }
  }

  .loading,
  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.2rem;
    color: var(--text-color);
  }

  .error {
    color: var(--error-color);
  }
</style>
