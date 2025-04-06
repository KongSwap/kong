<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  export let navigateToSwap: () => void;
  export let isVisible = false;
  
  // Animation state
  let hasTriggeredAnimation = false;
  let contentVisible = false;
  
  // Trigger animations when section becomes visible
  $: if (isVisible && !hasTriggeredAnimation) {
    triggerAnimation();
  }
  
  function triggerAnimation() {
    hasTriggeredAnimation = true;
    setTimeout(() => {
      contentVisible = true;
    }, 200);
  }
  
  // Grid interaction variables
  let gridContainer: HTMLElement;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let gridCells: HTMLElement[] = [];
  let cellMap = new Map(); // Fast cell lookup by position
  let animationFrame: number | null = null;
  let lastUpdateTime = 0;
  let activeCell: HTMLElement | null = null;
  const THROTTLE_MS = 50; // More aggressive throttling (~20fps is enough for this effect)
  const CELL_SIZE = 120; // Further increased cell size to reduce total number
  const MAX_CELLS = 200; // Lower cell count limit for better performance
  
  // Device performance classification
  let isLowPerformanceDevice = false;
  
  // Glitch effect variables
  let glitchActive = false;
  let glitchInterval: ReturnType<typeof setInterval> | null = null;
  let isInViewport = false;
  
  // Add these variables for enhanced hover effect
  let lastHoveredCell: HTMLElement | null = null;
  let neighborCells: HTMLElement[] = [];
  const PROXIMITY_THRESHOLD = 300; // How far the effect spreads to neighboring cells
  
  // Performance detection function
  function detectPerformance() {
    if (!browser) return false;
    
    // Device checks - treat mobile devices as lower performance by default
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Simple performance check using device memory API if available
    if ('deviceMemory' in navigator) {
      // Less than 4GB of RAM suggests a lower-end device
      if ((navigator as any).deviceMemory < 4) {
        return true;
      }
    }
    
    // Hardware concurrency check (CPU cores)
    if ('hardwareConcurrency' in navigator) {
      if (navigator.hardwareConcurrency < 4) {
        return true;
      }
    }
    
    // Mobile devices without high hardware specs are considered low performance
    return isMobile;
  }
  
  // Glitch effect function for elements - now with viewport check
  function startGlitchEffect() {
    if (!browser) return;
    
    // Reduce glitch effect frequency on low-performance devices
    const interval = isLowPerformanceDevice ? 10000 + Math.random() * 15000 : 5000 + Math.random() * 10000;
    
    glitchInterval = setInterval(() => {
      if (!isInViewport) return; // Skip effect if not in viewport
      
      glitchActive = true;
      setTimeout(() => {
        glitchActive = false;
      }, 150 + Math.random() * 300);
    }, interval);
  }
  
  // Create interactive grid cells with cell count limitation and performance tiering
  function createGridCells() {
    if (!browser || !gridContainer) return;
    
    // Clean up existing cells
    gridContainer.innerHTML = '';
    gridCells = [];
    cellMap.clear();
    
    // Calculate cell size and count based on container size
    const containerWidth = gridContainer.offsetWidth;
    const containerHeight = gridContainer.offsetHeight;
    
    // Use even larger cells on low-performance devices
    const effectiveCellSize = isLowPerformanceDevice ? CELL_SIZE * 1.5 : CELL_SIZE;
    
    // Calculate grid dimensions, limiting total cells
    let columns = Math.ceil(containerWidth / effectiveCellSize) + 1;
    let rows = Math.ceil(containerHeight / effectiveCellSize) + 1;
    
    // Limit total cells for performance
    const totalCells = columns * rows;
    const effectiveMaxCells = isLowPerformanceDevice ? MAX_CELLS / 2 : MAX_CELLS;
    
    if (totalCells > effectiveMaxCells) {
      const scaleFactor = Math.sqrt(effectiveMaxCells / totalCells);
      columns = Math.floor(columns * scaleFactor);
      rows = Math.floor(rows * scaleFactor);
    }
    
    // Skip every other cell on low-performance devices for a sparser grid
    const skipFactor = isLowPerformanceDevice ? 2 : 1;
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Create grid cells
    for (let r = 0; r < rows; r += skipFactor) {
      for (let c = 0; c < columns; c += skipFactor) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        
        // Optimize by using transform instead of left/top for position
        // This allows the browser to optimize with the GPU
        cell.style.cssText = `
          position: absolute;
          width: ${effectiveCellSize}px;
          height: ${effectiveCellSize}px;
          transform: translate3d(${c * effectiveCellSize}px, ${r * effectiveCellSize}px, 0);
          opacity: 0.8;
          will-change: opacity, transform;
          contain: layout style paint;
        `;
        
        // Pre-create inner elements with minimal styles
        const innerBorder = document.createElement('div');
        innerBorder.className = 'cell-border';
        innerBorder.style.cssText = `
          position: absolute;
          inset: 0;
          border: 0.25px solid rgba(0, 164, 255, 0.1);
          transition: border-color 0.3s, box-shadow 0.3s;
          will-change: border-color, box-shadow;
        `;
        cell.appendChild(innerBorder);
        
        const dot = document.createElement('div');
        dot.className = 'cell-dot';
        dot.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background-color: rgba(0, 164, 255, 0.2);
          transform: translate3d(-50%, -50%, 0);
          transition: transform 0.3s, background-color 0.3s, box-shadow 0.3s;
          will-change: transform, background-color, box-shadow;
        `;
        cell.appendChild(dot);
        
        fragment.appendChild(cell);
        gridCells.push(cell);
        
        // Store in map for O(1) lookup
        cellMap.set(`${r}-${c}`, cell);
      }
    }
    
    gridContainer.appendChild(fragment);
    gridContainer.dataset.initialized = "true";
  }
  
  // Update the highlightCell function to add proximity effect to neighboring cells
  function highlightCell(cell: HTMLElement) {
    // If this is already the active cell, no need to update
    if (cell === activeCell) return;
    
    // Deactivate previous cell if exists
    if (activeCell) {
      deactivateCell(activeCell);
    }
    
    // Clear previous neighbor cells
    neighborCells.forEach(neighbor => {
      neighbor.classList.remove('neighbor-active');
      const neighborDot = neighbor.querySelector('.cell-dot') as HTMLElement;
      if (neighborDot) {
        neighborDot.classList.remove('neighbor-dot-active');
      }
    });
    neighborCells = [];
    
    // Use classList for toggling classes instead of inline styles when possible
    cell.classList.add('active');
    
    const border = cell.querySelector('.cell-border') as HTMLElement;
    if (border) {
      border.classList.add('border-active');
    }
    
    const dot = cell.querySelector('.cell-dot') as HTMLElement;
    if (dot) {
      dot.classList.add('dot-active');
    }
    
    // Add ripple effect
    addRippleEffect(cell);
    
    // Find and highlight neighboring cells with proximity effect
    if (!isLowPerformanceDevice) {
      highlightNeighborCells(cell);
    }
    
    activeCell = cell;
    lastHoveredCell = cell;
  }
  
  // Function to add ripple effect to cell
  function addRippleEffect(cell: HTMLElement) {
    if (isLowPerformanceDevice) return; // Skip on low-performance devices
    
    // Create ripple element
    const ripple = document.createElement('div');
    ripple.className = 'cell-ripple';
    
    // Position at center of cell
    const cellRect = cell.getBoundingClientRect();
    const size = Math.max(cellRect.width, cellRect.height) * 2;
    
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = '50%';
    ripple.style.top = '50%';
    
    // Add to cell and remove after animation
    cell.appendChild(ripple);
    setTimeout(() => {
      if (ripple.parentNode === cell) {
        cell.removeChild(ripple);
      }
    }, 1000);
  }
  
  // Function to find and highlight neighboring cells based on proximity
  function highlightNeighborCells(centerCell: HTMLElement) {
    if (!gridContainer || isLowPerformanceDevice) return;
    
    const centerRect = centerCell.getBoundingClientRect();
    const centerX = centerRect.left + centerRect.width / 2;
    const centerY = centerRect.top + centerRect.height / 2;
    
    // Check all cells for proximity effects
    gridCells.forEach(cell => {
      if (cell === centerCell) return; // Skip the center cell itself
      
      const cellRect = cell.getBoundingClientRect();
      const cellX = cellRect.left + cellRect.width / 2;
      const cellY = cellRect.top + cellRect.height / 2;
      
      // Calculate distance
      const dx = centerX - cellX;
      const dy = centerY - cellY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Apply proximity effect if within threshold
      if (distance < PROXIMITY_THRESHOLD) {
        // Calculate effect strength (closer = stronger)
        const effect = 1 - (distance / PROXIMITY_THRESHOLD);
        
        // Add proximity class with strength
        cell.classList.add('neighbor-active');
        cell.style.setProperty('--effect-strength', effect.toFixed(2));
        
        const dot = cell.querySelector('.cell-dot') as HTMLElement;
        if (dot) {
          dot.classList.add('neighbor-dot-active');
          dot.style.setProperty('--effect-strength', effect.toFixed(2));
        }
        
        neighborCells.push(cell);
      }
    });
  }
  
  // Reset a cell to default state (updated version)
  function deactivateCell(cell: HTMLElement) {
    cell.classList.remove('active');
    
    const border = cell.querySelector('.cell-border') as HTMLElement;
    if (border) {
      border.classList.remove('border-active');
    }
    
    const dot = cell.querySelector('.cell-dot') as HTMLElement;
    if (dot) {
      dot.classList.remove('dot-active');
    }
    
    // Also clear any ripple effects that might still be animating
    const ripples = cell.querySelectorAll('.cell-ripple');
    ripples.forEach(ripple => {
      if (ripple.parentNode === cell) {
        cell.removeChild(ripple);
      }
    });
  }
  
  // Find which cell the mouse is over - using O(1) lookup
  function findCellAtPosition(x: number, y: number): HTMLElement | null {
    if (!gridContainer || cellMap.size === 0) return null;
    
    const rect = gridContainer.getBoundingClientRect();
    const offsetX = x - rect.left;
    const offsetY = y - rect.top;
    
    // If outside grid, return null
    if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) {
      return null;
    }
    
    // Calculate row and column directly
    const effectiveCellSize = isLowPerformanceDevice ? CELL_SIZE * 1.5 : CELL_SIZE;
    const skipFactor = isLowPerformanceDevice ? 2 : 1;
    
    const col = Math.floor(offsetX / effectiveCellSize) * skipFactor;
    const row = Math.floor(offsetY / effectiveCellSize) * skipFactor;
    
    // O(1) lookup from map
    return cellMap.get(`${row}-${col}`) || null;
  }
  
  // Update cells based on mouse position - optimized with throttling
  function updateCells(time: number) {
    // Skip animation frame if not in viewport
    if (!isInViewport) {
      animationFrame = requestAnimationFrame(updateCells);
      return;
    }
    
    // Only update on throttle intervals
    const effectiveThrottle = isLowPerformanceDevice ? THROTTLE_MS * 2 : THROTTLE_MS;
    if (time - lastUpdateTime < effectiveThrottle) {
      animationFrame = requestAnimationFrame(updateCells);
      return;
    }
    
    lastUpdateTime = time;
    
    if (!browser || !mouseActive) {
      animationFrame = requestAnimationFrame(updateCells);
      return;
    }
    
    const targetCell = findCellAtPosition(mouseX, mouseY);
    
    if (targetCell) {
      highlightCell(targetCell);
    } else if (activeCell) {
      deactivateCell(activeCell);
      activeCell = null;
    }
    
    animationFrame = requestAnimationFrame(updateCells);
  }
  
  // Animation loop with timestamp
  function animateGrid(time: number) {
    if (!browser) return;
    updateCells(time);
  }
  
  // Mouse event handlers with more aggressive throttling
  let lastMoveTime = 0;
  function handleMouseMove(e: MouseEvent) {
    if (!isInViewport) return; // Skip processing if not in viewport
    
    const now = performance.now();
    const effectiveThrottle = isLowPerformanceDevice ? THROTTLE_MS * 2 : THROTTLE_MS;
    if (now - lastMoveTime < effectiveThrottle) return;
    
    lastMoveTime = now;
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseActive = true;
  }
  
  function handleMouseLeave() {
    mouseActive = false;
    if (activeCell) {
      deactivateCell(activeCell);
      activeCell = null;
    }
  }
  
  // Debounced window resize handler 
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  function handleResize() {
    if (!browser) return;
    
    // Debounce resize to avoid multiple rebuilds
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    
    resizeTimeout = setTimeout(() => {
      if (gridContainer) {
        // Cancel animation before recreating grid
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        
        // Reset active cell
        activeCell = null;
        
        createGridCells();
        
        // Restart animation
        animationFrame = requestAnimationFrame(animateGrid);
        
        resizeTimeout = null;
      }
    }, 350); // Further increased debounce time
  }
  
  // Use Intersection Observer for viewport detection
  let observer: IntersectionObserver | null = null;
  
  onMount(() => {
    if (browser) {
      // Detect device performance on mount
      isLowPerformanceDevice = detectPerformance();
      
      // Start glitch effect
      startGlitchEffect();
      
      // Use Intersection Observer for better performance
      observer = new IntersectionObserver((entries) => {
        const wasInViewport = isInViewport;
        isInViewport = entries[0].isIntersecting;
        
        // Only take action if viewport status changed
        if (!wasInViewport && isInViewport) {
          // Initialize grid when entering viewport
          if (!gridContainer.dataset.initialized) {
            createGridCells();
            animationFrame = requestAnimationFrame(animateGrid);
          }
        } else if (wasInViewport && !isInViewport) {
          // Optional: pause expensive animations when not in viewport
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
          }
        }
      }, { 
        threshold: 0.1,
        rootMargin: '100px 0px'  // Preload a bit before visible
      });
      
      if (gridContainer) {
        observer.observe(gridContainer);
      }
      
      // Add event listeners for window resize with passive option
      window.addEventListener('resize', handleResize, { passive: true });
      
      // For low performance devices, check if we're already in viewport
      // to initialize the grid immediately if needed
      if (isLowPerformanceDevice && gridContainer) {
        const rect = gridContainer.getBoundingClientRect();
        if (
          rect.top < window.innerHeight &&
          rect.bottom > 0
        ) {
          isInViewport = true;
          createGridCells();
          animationFrame = requestAnimationFrame(animateGrid);
        }
      }
    }
  });
  
  onDestroy(() => {
    if (browser) {
      if (glitchInterval) clearInterval(glitchInterval);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
    }
  });
</script>

<section id="cta" class="h-screen flex items-center justify-center relative overflow-hidden crt-flicker">
  <!-- Cyberpunk background - different from hero but similar vibe -->
  <div class="absolute inset-0 z-0 bg-[#0A1020] opacity-90"></div>
  
  <!-- Static grid background - explicitly visible -->
  <div class="absolute inset-0 z-5 static-grid pointer-events-none"></div>
  
  <!-- Interactive grid container -->
  <div bind:this={gridContainer} class="interactive-grid absolute inset-0 z-10 pointer-events-auto overflow-hidden" data-grid="true"></div>
  
  <!-- Binary rain effect -->
  <div class="absolute inset-0 z-1 binary-rain pointer-events-none opacity-20"></div>
  
  <!-- Diagonal neon glows -->
  <div class="absolute w-[800px] h-[800px] rounded-full opacity-20 bg-[radial-gradient(circle_at_center,rgba(255,0,255,0.8),rgba(255,0,255,0))] top-[-20%] right-[-20%] blur-xl"></div>
  <div class="absolute w-[600px] h-[600px] rounded-full opacity-15 bg-[radial-gradient(circle_at_center,rgba(0,164,255,0.7),rgba(0,164,255,0))] bottom-[-10%] left-[-10%] blur-xl"></div>
  
  <!-- Scanline and vignette effects -->
  <div class="absolute inset-0 z-5 scanlines pointer-events-none opacity-10 mix-blend-overlay"></div>
  <div class="absolute inset-0 z-5 vignette pointer-events-none rounded"></div>
  
  <!-- Kong logo watermark -->
  <div class="absolute top-[100px] right-[0px] w-[300px] h-[300px] z-1 animate-[float-slow_20s_ease-in-out_infinite_alternate] opacity-10">
    <img src="/images/kongface-white.svg" alt="" class="w-full h-full" />
  </div>
  
  <div class="max-w-4xl mx-auto px-6 md:px-8 w-full z-30 text-center relative transition-all duration-1000 ease-out {contentVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-12'}">
    <!-- Cyberpunk header with neon effect -->
    <h2 class="text-3xl md:text-5xl font-black mb-8 uppercase tracking-tight leading-none cyberpunk-title">
      <div class="relative inline-block leading-tight perspective-1000">
        <span class="neon-text neon-text-blue {glitchActive ? 'glitch-active' : ''}">Ready to revolutionize</span>
        <span class="neon-text-reflection neon-text-blue-reflection">Ready to revolutionize</span>
      </div>
      <div class="relative inline-block mt-2 leading-tight perspective-1000">
        <span class="neon-text neon-text-magenta {glitchActive ? 'glitch-active' : ''}">your trading?</span>
        <span class="neon-text-reflection neon-text-magenta-reflection">your trading?</span>
      </div>
    </h2>
    
    <p class="text-xl text-[#A1A7BC] max-w-3xl mx-auto mb-12 leading-relaxed cyberpunk-text">
      Join the thousands of professional and retail traders already leveraging KongSwap's advanced infrastructure.
    </p>
    
    <div class="flex flex-wrap gap-4 justify-center">
      <button 
        on:click={navigateToSwap}
        class="neon-button relative inline-flex items-center overflow-hidden"
      >
        <span class="neon-button-text text-nowrap">LAUNCH APP</span>
        <div class="neon-button-glow"></div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 ml-2 relative z-10">
          <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </div>
</section>

<svelte:window on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave} />

<style>
  /* Animation keyframes */
  @keyframes float-slow {
    0% { transform: translate(0, 0); }
    50% { transform: translate(30px, -30px); }
    100% { transform: translate(0, 0); }
  }
  
  /* CRT flicker */
  .crt-flicker {
    animation: crt-flicker 15s infinite;
  }
  
  @keyframes crt-flicker {
    0%, 100% { opacity: 0.98; }
    3% { opacity: 0.92; }
    5% { opacity: 0.98; }
    40% { opacity: 0.96; }
    45% { opacity: 0.98; }
    60% { opacity: 0.96; }
  }
  
  /* Scanlines overlay */
  .scanlines {
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(0, 0, 0, 0.2) 50%
    );
    background-size: 100% 4px;
    will-change: transform;
  }
  
  /* Vignette effect */
  .vignette {
    box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.9);
    background: radial-gradient(
      ellipse at center,
      transparent 60%,
      rgba(0, 0, 0, 0.6) 100%
    );
  }
  
  /* Binary rain effect for cyberpunk vibe */
  .binary-rain {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='2000' viewBox='0 0 100 2000'%3E%3Cstyle%3E text %7B fill: rgba(0,255,255,0.15); font-family: monospace; font-size: 14px; %7D %3C/style%3E%3Ctext x='10' y='20'%3E10%3C/text%3E%3Ctext x='30' y='40'%3E01%3C/text%3E%3Ctext x='50' y='60'%3E11%3C/text%3E%3Ctext x='70' y='80'%3E00%3C/text%3E%3Ctext x='20' y='100'%3E01%3C/text%3E%3Ctext x='40' y='120'%3E10%3C/text%3E%3Ctext x='60' y='140'%3E01%3C/text%3E%3Ctext x='80' y='160'%3E11%3C/text%3E%3Ctext x='10' y='180'%3E00%3C/text%3E%3Ctext x='30' y='200'%3E10%3C/text%3E%3C/svg%3E");
    animation: binary-fall 30s linear infinite;
    will-change: background-position;
  }
  
  @keyframes binary-fall {
    from { background-position: 0 0; }
    to { background-position: 0 2000px; }
  }

  /* For neon sign container */
  .perspective-1000 {
    perspective: 1000px;
  }
  
  /* Neon text effect */
  .neon-text {
    @apply relative inline-block font-black uppercase tracking-wider;
    -webkit-font-smoothing: subpixel-antialiased;
    letter-spacing: 2px;
    will-change: text-shadow, transform;
  }
  
  /* Neon color variations */
  .neon-text-blue {
    @apply text-white;
    text-shadow:
      0 0 5px rgba(255, 255, 255, 0.8),
      0 0 10px rgba(255, 255, 255, 0.5),
      0 0 15px rgba(0, 164, 255, 0.8),
      0 0 20px rgba(0, 164, 255, 0.8),
      0 0 25px rgba(0, 164, 255, 0.8),
      0 0 30px rgba(0, 164, 255, 0.6),
      0 0 35px rgba(0, 164, 255, 0.4);
    animation: neon-blue-tube 4s infinite alternate;
  }
  
  .neon-text-blue.glitch-active {
    animation: text-glitch 0.3s steps(2) infinite;
  }
  
  .neon-text-magenta {
    @apply text-white;
    text-shadow:
      0 0 5px rgba(255, 255, 255, 0.8),
      0 0 10px rgba(255, 255, 255, 0.5),
      0 0 15px rgba(255, 0, 255, 0.8),
      0 0 20px rgba(255, 0, 255, 0.8),
      0 0 25px rgba(255, 0, 255, 0.8),
      0 0 30px rgba(255, 0, 255, 0.6),
      0 0 35px rgba(255, 0, 255, 0.4);
    animation: neon-magenta-tube 4s infinite alternate;
    animation-delay: 1s;
  }
  
  .neon-text-magenta.glitch-active {
    animation: text-glitch-magenta 0.3s steps(2) infinite;
  }
  
  @keyframes text-glitch {
    0% {
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(0, 164, 255, 0.8),
        0 0 20px rgba(0, 164, 255, 0.8);
      transform: translateX(0);
    }
    25% {
      text-shadow:
        -2px 0 5px rgba(255, 255, 255, 0.8),
        2px 0 10px rgba(0, 255, 255, 0.5);
      transform: translateX(2px);
    }
    50% {
      text-shadow:
        2px 0 5px rgba(255, 255, 255, 0.8),
        -2px 0 10px rgba(0, 164, 255, 0.5);
      transform: translateX(-2px);
    }
    100% {
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(0, 164, 255, 0.8),
        0 0 20px rgba(0, 164, 255, 0.8);
      transform: translateX(0);
    }
  }
  
  @keyframes text-glitch-magenta {
    0% {
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(255, 0, 255, 0.8),
        0 0 20px rgba(255, 0, 255, 0.8);
      transform: translateX(0);
    }
    25% {
      text-shadow:
        -2px 0 5px rgba(255, 255, 255, 0.8),
        2px 0 10px rgba(255, 0, 255, 0.5);
      transform: translateX(2px);
    }
    50% {
      text-shadow:
        2px 0 5px rgba(255, 255, 255, 0.8),
        -2px 0 10px rgba(255, 0, 255, 0.5);
      transform: translateX(-2px);
    }
    100% {
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(255, 0, 255, 0.8),
        0 0 20px rgba(255, 0, 255, 0.8);
      transform: translateX(0);
    }
  }
  
  /* Neon flicker animations for tube-like effect */
  @keyframes neon-blue-tube {
    0%, 18%, 20%, 50.1%, 60%, 65.1%, 80%, 90.1%, 92% {
      @apply text-white;
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(0, 164, 255, 0.8),
        0 0 20px rgba(0, 164, 255, 0.8),
        0 0 25px rgba(0, 164, 255, 0.8),
        0 0 30px rgba(0, 164, 255, 0.6),
        0 0 35px rgba(0, 164, 255, 0.4);
    }
    18.1%, 20.1%, 30%, 50%, 60.1%, 65%, 80.1%, 90%, 92.1%, 100% {
      @apply text-white;
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(0, 164, 255, 0.8),
        0 0 20px rgba(0, 164, 255, 0.8),
        0 0 25px rgba(0, 164, 255, 0.8),
        0 0 30px rgba(0, 164, 255, 0.6),
        0 0 35px rgba(0, 164, 255, 0.4),
        0 0 40px rgba(0, 164, 255, 0.2);
    }
  }
  
  @keyframes neon-magenta-tube {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 91%, 93%, 95% {
      @apply text-white;
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(255, 0, 255, 0.8),
        0 0 20px rgba(255, 0, 255, 0.8),
        0 0 25px rgba(255, 0, 255, 0.8),
        0 0 30px rgba(255, 0, 255, 0.6),
        0 0 35px rgba(255, 0, 255, 0.4);
    }
    20%, 22%, 24%, 55%, 57%, 92%, 94%, 96% {
      color: #FFF0FF;
      text-shadow:
        0 0 5px rgba(255, 255, 255, 0.8),
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 15px rgba(255, 0, 255, 0.4),
        0 0 20px rgba(255, 0, 255, 0.4),
        0 0 25px rgba(255, 0, 255, 0.4),
        0 0 30px rgba(255, 0, 255, 0.3);
    }
  }
  
  /* Neon reflection effect */
  .neon-text-reflection {
    @apply absolute bottom-[-20px] left-0 right-0 block opacity-20 filter blur-[2px] pointer-events-none;
    transform: rotateX(180deg) scaleY(0.3) translateY(-20px);
    line-height: 1;
    will-change: opacity;
  }
  
  .neon-text-blue-reflection {
    @apply text-white;
    text-shadow:
      0 0 5px rgba(255, 255, 255, 0.4),
      0 0 8px rgba(0, 164, 255, 0.4),
      0 0 12px rgba(0, 164, 255, 0.4);
    animation: neon-reflection 4s infinite alternate;
  }
  
  .neon-text-magenta-reflection {
    @apply text-white;
    text-shadow:
      0 0 5px rgba(255, 255, 255, 0.4),
      0 0 8px rgba(255, 0, 255, 0.4),
      0 0 12px rgba(255, 0, 255, 0.4);
    animation: neon-reflection 4s infinite alternate;
    animation-delay: 1s;
  }
  
  @keyframes neon-reflection {
    0%, 100% {
      opacity: 0.2;
    }
    50% {
      opacity: 0.1;
    }
  }
  
  /* Neon button - modernized for better UI */
  .neon-button {
    position: relative;
    background: rgba(0, 10, 30, 0.3);
    color: #00D8FF;
    border: 1px solid rgba(0, 216, 255, 0.4);
    border-radius: 4px;
    padding: 12px 28px;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    overflow: hidden;
    transition: all 0.3s ease;
    box-shadow: 
      0 0 10px rgba(0, 216, 255, 0.2),
      inset 0 0 5px rgba(0, 216, 255, 0.1);
    backdrop-filter: blur(4px);
    font-family: 'Inter', 'Rajdhani', 'SF Pro Display', sans-serif;
    will-change: transform, box-shadow, color, background, border-color;
  }
  
  .neon-button:hover {
    color: white;
    background: rgba(0, 216, 255, 0.8);
    border-color: rgba(0, 216, 255, 0.8);
    box-shadow: 
      0 0 15px rgba(0, 216, 255, 0.5),
      0 0 30px rgba(0, 216, 255, 0.3),
      inset 0 0 10px rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
  }
  
  .neon-button:active {
    transform: translateY(1px);
    box-shadow: 
      0 0 8px rgba(0, 216, 255, 0.3),
      inset 0 0 4px rgba(0, 216, 255, 0.1);
  }
  
  .neon-button-text {
    position: relative;
    z-index: 10;
  }
  
  .neon-button-glow {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
      circle at center,
      rgba(0, 216, 255, 0.3) 0%,
      transparent 70%
    );
    opacity: 0;
    z-index: 1;
    transition: opacity 0.3s ease;
    will-change: opacity, transform;
  }
  
  .neon-button:hover .neon-button-glow {
    opacity: 1;
    animation: pulse-glow 2s infinite;
  }
  
  /* Secondary neon button */
  .neon-button-secondary {
    position: relative;
    background: rgba(0, 10, 30, 0.3);
    color: #FF00FF;
    border: 1px solid rgba(255, 0, 255, 0.4);
    border-radius: 4px;
    padding: 12px 28px;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    overflow: hidden;
    transition: all 0.3s ease;
    box-shadow: 
      0 0 10px rgba(255, 0, 255, 0.2),
      inset 0 0 5px rgba(255, 0, 255, 0.1);
    backdrop-filter: blur(4px);
    font-family: 'Inter', 'Rajdhani', 'SF Pro Display', sans-serif;
    will-change: transform, box-shadow, color, background, border-color;
  }
  
  .neon-button-secondary:hover {
    color: white;
    background: rgba(255, 0, 255, 0.8);
    border-color: rgba(255, 0, 255, 0.8);
    box-shadow: 
      0 0 15px rgba(255, 0, 255, 0.5),
      0 0 30px rgba(255, 0, 255, 0.3),
      inset 0 0 10px rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
  }
  
  .neon-button-secondary:active {
    transform: translateY(1px);
    box-shadow: 
      0 0 8px rgba(255, 0, 255, 0.3),
      inset 0 0 4px rgba(255, 0, 255, 0.1);
  }
  
  .neon-button-secondary .neon-button-glow {
    background: radial-gradient(
      circle at center,
      rgba(255, 0, 255, 0.3) 0%,
      transparent 70%
    );
  }
  
  .neon-button-secondary:hover .neon-button-glow {
    opacity: 1;
    animation: pulse-glow-magenta 2s infinite;
  }
  
  @keyframes pulse-glow {
    0% {
      opacity: 0.7;
      transform: scale(1);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.7;
      transform: scale(1);
    }
  }
  
  @keyframes pulse-glow-magenta {
    0% {
      opacity: 0.7;
      transform: scale(1);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.7;
      transform: scale(1);
    }
  }
  
  /* Cyberpunk text style */
  .cyberpunk-text {
    text-shadow: 0 0 2px rgba(255, 255, 255, 0.3);
    animation: text-flicker 8s infinite alternate;
  }
  
  @keyframes text-flicker {
    0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% {
      opacity: 0.99;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.3);
    }
    20%, 21.999%, 63%, 63.999%, 65%, 69.999% {
      opacity: 0.9;
      text-shadow: none;
    }
  }
  
  /* Interactive grid override to enable GPU acceleration */
  .interactive-grid {
    transform: translateZ(0);
    will-change: transform;
    container-type: size;
  }
  
  /* Highlighter element will use transforms for better performance */
  .highlighter {
    will-change: transform, opacity;
  }
  
  /* Grid cell optimizations */
  .grid-cell {
    will-change: transform, opacity;
    contain: layout style paint;
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  
  .grid-cell.active {
    opacity: 1;
    z-index: 21;
    transform: scale(1.05);
  }
  
  /* Neighboring cell effect */
  .grid-cell.neighbor-active {
    z-index: 20;
    opacity: calc(0.8 + (var(--effect-strength) * 0.2));
    transform: scale(calc(1 + (var(--effect-strength) * 0.03)));
  }
  
  /* Use CSS classes instead of inline styles for better performance */
  .border-active {
    border-color: rgba(0, 164, 255, 0.8) !important;
    box-shadow: 0 0 20px 20px rgba(0, 164, 255, 0.9), inset 0 0 15px 10px rgba(255, 0, 255, 0.9) !important;
  }
  
  .dot-active {
    background-color: rgba(0, 164, 255, 1) !important;
    box-shadow: 0 0 25px 15px rgba(0, 164, 255, 0.9) !important;
    transform: translate3d(-50%, -50%, 0) scale(3.5) !important;
  }
  
  /* Neighbor dot effect with variable intensity based on proximity */
  .neighbor-dot-active {
    background-color: rgba(0, 164, 255, calc(0.2 + (var(--effect-strength) * 0.8))) !important;
    box-shadow: 0 0 calc(var(--effect-strength) * 15px) calc(var(--effect-strength) * 10px) rgba(0, 164, 255, calc(0.3 + (var(--effect-strength) * 0.6))) !important;
    transform: translate3d(-50%, -50%, 0) scale(calc(1 + (var(--effect-strength) * 2.5))) !important;
  }
  
  /* Ripple effect styling */
  .cell-ripple {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(0, 216, 255, 0.7) 0%,
      rgba(0, 216, 255, 0.3) 30%,
      rgba(0, 216, 255, 0.1) 70%,
      transparent 100%
    );
    transform: translate(-50%, -50%) scale(0);
    opacity: 0.8;
    pointer-events: none;
    animation: ripple-effect 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    will-change: transform, opacity;
  }
  
  @keyframes ripple-effect {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0.8;
    }
    70% {
      opacity: 0.4;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }
</style> 