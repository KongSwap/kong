<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  // Props
  let { 
    navigateToSwap,
    isVisible = false
  } = $props<{
    navigateToSwap: () => void;
    isVisible?: boolean;
  }>();
  
  // Animation state
  let hasTriggeredAnimation = $state(false);
  let contentVisible = $state(false);
  
  // Trigger animations when section becomes visible (using $effect)
  $effect(() => {
    if (isVisible && !hasTriggeredAnimation) {
      triggerAnimation();
    }
  });
  
  function triggerAnimation() {
    hasTriggeredAnimation = true;
    setTimeout(() => {
      contentVisible = true;
    }, 200);
  }
  
  // Grid interaction variables - use $state for reactive ones
  let gridContainer = $state<HTMLElement | undefined>(undefined);
  let mouseX = $state(0);
  let mouseY = $state(0);
  let mouseActive = $state(false);
  let gridCells: HTMLElement[] = []; // Not $state, mutated directly
  let cellMap = new Map(); // Not $state
  let animationFrame = $state<number | null>(null);
  let lastUpdateTime = $state(0);
  let currentHoveredCell = $state<HTMLElement | null>(null);
  let hoveredGroup = $state<HTMLElement[]>([]);
  const THROTTLE_MS = 50; // More aggressive throttling (~20fps is enough for this effect)
  const CELL_SIZE = 120; // Further increased cell size to reduce total number
  const MAX_CELLS = 200; // Lower cell count limit for better performance
  
  // Parameters for dynamic hover activation
  const HOVER_RADIUS = 250; // Radius to find potential neighbors for dynamic activation
  const MIN_ACTIVE_CELLS = 2; // Minimum cells in a dynamic hover group (including primary)
  const MAX_ACTIVE_CELLS = 5; // Maximum cells in a dynamic hover group
  
  // Device performance classification
  let isLowPerformanceDevice = $state(false);
  
  // Glitch effect variables
  let glitchActive = $state(false);
  let glitchInterval = $state<ReturnType<typeof setInterval> | null>(null);
  let isInViewport = $state(false);
  
  // Add variables for trail effect
  let mousePath = $state<{x: number, y: number, time: number}[]>([]);
  const MAX_PATH_POINTS = 5; // Limit the number of points to track
  
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
    const container = gridContainer; // Use local copy for check
    if (!browser || !container) return;
    
    // Clean up existing cells
    container.innerHTML = '';
    gridCells = [];
    cellMap.clear();
    
    // Calculate cell size and count based on container size
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
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

        // Add row and column data attributes for easier lookup
        cell.dataset.row = r.toString();
        cell.dataset.col = c.toString();
        
        // Attach listeners using helper function
        attachCellListeners(cell);
        
        fragment.appendChild(cell);
        gridCells.push(cell);
        
        // Store in map for O(1) lookup
        cellMap.set(`${r}-${c}`, cell);
      }
    }
    
    container.appendChild(fragment);
    container.dataset.initialized = "true";
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
  
  // Update cells based on mouse position - primarily for trail effect now
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
    
    // Ensure mouseActive check is still present for trail effect logic if added later
    if (!browser || !mouseActive) {
       animationFrame = requestAnimationFrame(updateCells);
       return;
    }

    // Removed logic that called findCellAtPosition, highlightCell, deactivateCell
    // updateCells should now only be responsible for time-based effects like the trail
    
    animationFrame = requestAnimationFrame(updateCells);
  }
  
  // Animation loop with timestamp
  function animateGrid(time: number) {
    if (!browser) return;
    updateCells(time);
  }
  
  // Update createTrailEffect to check against hoveredGroup
  function createTrailEffect() {
    if (mousePath.length < 2) return;
    
    for (let i = 0; i < mousePath.length - 1; i++) {
      const point = mousePath[i];
      const age = performance.now() - point.time;
      if (age > 300) continue;
      const cell = findCellAtPosition(point.x, point.y);
      
      // Skip if null or part of the currently hovered group
      if (!cell || hoveredGroup.includes(cell)) continue; 
      
      const opacity = Math.max(0, 1 - (age / 300));
      cell.style.setProperty('--trail-opacity', opacity.toString());
      cell.classList.add('trail-cell');
      
      setTimeout(() => {
        if (!hoveredGroup.includes(cell)) { // Check against hover group on removal too
          cell.classList.remove('trail-cell');
        }
      }, 300);
    }
  }
  
  // Restore simple mouse move logic, hover is handled by listeners
  let lastMoveTime = 0;
  function handleMouseMove(e: MouseEvent) {
    if (!isInViewport) return; 
    
    const now = performance.now();
    const effectiveThrottle = isLowPerformanceDevice ? THROTTLE_MS * 2 : THROTTLE_MS;
    if (now - lastMoveTime < effectiveThrottle) return;
    
    lastMoveTime = now;
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseActive = true;
    
    // Trail effect path update
    mousePath.push({x: mouseX, y: mouseY, time: now});
    if (mousePath.length > MAX_PATH_POINTS) {
      mousePath.shift();
    }
    if (!isLowPerformanceDevice) {
      createTrailEffect();
    }
  }
  
  // Restore handleMouseLeave to use resetCellStyle and clear hoveredGroup
  function handleMouseLeave() {
    mouseActive = false;
    if (hoveredGroup.length > 0) {
      hoveredGroup.forEach(resetCellStyle); // Use the style reset helper
      hoveredGroup = [];
    }
    currentHoveredCell = null; // Clear the primary hovered cell tracker
  }
  
  // Debounced window resize handler 
  let resizeTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
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
        currentHoveredCell = null;
        
        createGridCells();
        
        // Restart animation
        animationFrame = requestAnimationFrame(animateGrid);
        
        resizeTimeout = null;
      }
    }, 350);
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
        
        if (!wasInViewport && isInViewport) {
          if (gridContainer && !gridContainer.dataset.initialized) {
            createGridCells(); 
            // Start animation frame if needed for non-hover effects (like trail)
            if (!animationFrame) { 
               animationFrame = requestAnimationFrame(animateGrid);
            }
          }
        } else if (wasInViewport && !isInViewport) {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
          }
        }
      }, { 
        threshold: 0.1,
        rootMargin: '100px 0px'  
      });
      
      if (gridContainer) {
        observer.observe(gridContainer);
        // Add mouse move listener here, only when gridContainer is available
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseleave', handleMouseLeave);
      }
      
      window.addEventListener('resize', handleResize, { passive: true });
      
      // Ensure grid is created if initially in viewport
      if (!isLowPerformanceDevice && gridContainer) {
        const rect = gridContainer.getBoundingClientRect();
        if (
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          !gridContainer.dataset.initialized
        ) {
          isInViewport = true;
          createGridCells();
          if (!animationFrame) { 
             animationFrame = requestAnimationFrame(animateGrid);
          }
        }
      }
    }
  });
  
  onDestroy(() => {
    if (browser) {
      // Capture state values for cleanup
      const currentGlitchInterval = glitchInterval;
      const currentAnimationFrame = animationFrame;
      const currentResizeTimeout = resizeTimeout;

      if (currentGlitchInterval) clearInterval(currentGlitchInterval);
      if (currentAnimationFrame) cancelAnimationFrame(currentAnimationFrame);
      if (currentResizeTimeout) clearTimeout(currentResizeTimeout);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      
      // Reset state if needed
      glitchInterval = null;
      animationFrame = null;
      resizeTimeout = null;
    }
  });

  // --- Utility Functions ---

  // Fisher-Yates (aka Knuth) Shuffle
  function shuffleArray<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
  }
  
  // Function to find cells within a radius (similar to old neighbor logic)
  function findCellsInRadius(centerCell: HTMLElement, radius: number): HTMLElement[] {
    if (!gridContainer) return [];
    
    const nearbyCells: HTMLElement[] = [];
    const centerRect = centerCell.getBoundingClientRect();
    const centerX = centerRect.left + centerRect.width / 2;
    const centerY = centerRect.top + centerRect.height / 2;
    
    gridCells.forEach(cell => {
      if (cell === centerCell) return; // Skip the center cell itself
      
      const cellRect = cell.getBoundingClientRect();
      const cellX = cellRect.left + cellRect.width / 2;
      const cellY = cellRect.top + cellRect.height / 2;
      
      const dx = centerX - cellX;
      const dy = centerY - cellY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < radius) {
        nearbyCells.push(cell);
      }
    });
    
    return nearbyCells;
  }

  // --- Event Listener Logic ---
  function attachCellListeners(cell: HTMLElement) {
    // Restore direct mouse event listeners, modified for group hover
    cell.addEventListener('mouseenter', () => {
      // Clear previous hovered group styles
      if (hoveredGroup.length > 0) {
        hoveredGroup.forEach(resetCellStyle);
      }
      hoveredGroup = []; // Reset the group

      // --- Dynamic Group Selection ---
      const neighborsInRadius = findCellsInRadius(cell, HOVER_RADIUS);
      const potentialGroup = [cell, ...neighborsInRadius]; // Include self

      // Determine how many cells to activate (randomly between min/max)
      const numToActivate = Math.floor(Math.random() * (MAX_ACTIVE_CELLS - MIN_ACTIVE_CELLS + 1)) + MIN_ACTIVE_CELLS;
      
      // Shuffle the potential group and pick the desired number
      const shuffledGroup = shuffleArray(potentialGroup);
      hoveredGroup = shuffledGroup.slice(0, numToActivate);
      // --- End Dynamic Selection ---

      // Apply hover styles to the dynamically selected group
      hoveredGroup.forEach(applyHoverStyles);
      currentHoveredCell = cell; // Track the primary cell that triggered the hover
    });
    
    cell.addEventListener('mouseleave', (e) => {
        const cellBeingLeft = e.target as HTMLElement;
        const relatedTarget = e.relatedTarget as HTMLElement;

        // Only proceed if the cell being left was part of the active hover group
        if (hoveredGroup.includes(cellBeingLeft)) {
          let movingToAnotherCellInGroup = false;
          
          // Check if moving to another valid cell within the SAME group
          if (relatedTarget && relatedTarget.classList && relatedTarget.classList.contains('grid-cell') && hoveredGroup.includes(relatedTarget)) {
              movingToAnotherCellInGroup = true;
          }

          // If not moving to another cell within the same group, reset the entire group
          if (!movingToAnotherCellInGroup) {
              hoveredGroup.forEach(resetCellStyle);
              hoveredGroup = [];
              currentHoveredCell = null; // Clear tracker when group is deactivated
          }
        }
        // If the cell being left wasn't part of the group, do nothing.
        // If moving within the group, do nothing (mouseenter on the new cell handles activation).
    });
  }
  // --- End Event Listener Logic ---

  // Helper function to apply hover styles (restoring the previous inline style approach for hover)
  function applyHoverStyles(cell: HTMLElement) {
    const border = cell.querySelector('.cell-border') as HTMLElement;
    const dot = cell.querySelector('.cell-dot') as HTMLElement;

    if (border) {
      border.style.borderColor = 'rgba(0, 164, 255, 0.6)';
      border.style.boxShadow = '0 0 15px 8px rgba(0, 164, 255, 0.5), inset 0 0 8px 4px rgba(255, 0, 255, 0.5)';
    }

    if (dot) {
      dot.style.backgroundColor = 'rgba(0, 164, 255, 0.8)';
      dot.style.boxShadow = '0 0 20px 10px rgba(0, 164, 255, 0.5)';
      dot.style.transform = 'translate3d(-50%, -50%, 0) scale(2.5)';
    }

    const currentTransform = cell.style.transform;
    const baseTransform = currentTransform.replace(/ scale\([^)]*\)/, '');
    cell.style.transform = `${baseTransform} scale(1.03)`;
  }

  // Restore resetCellStyle (it was added before but let's ensure it's correct)
  function resetCellStyle(cell: HTMLElement) {
    const border = cell.querySelector('.cell-border') as HTMLElement;
    const dot = cell.querySelector('.cell-dot') as HTMLElement;
    
    if (border) {
      border.style.borderColor = 'rgba(0, 164, 255, 0.1)'; // Explicitly set default color
      border.style.boxShadow = 'none'; // Explicitly remove shadow
    }
    
    if (dot) {
      dot.style.backgroundColor = 'rgba(0, 164, 255, 0.2)'; // Explicitly set default color
      dot.style.boxShadow = 'none'; // Explicitly remove shadow
      dot.style.transform = 'translate3d(-50%, -50%, 0)'; // Explicitly set default transform
    }
    
    const currentTransform = cell.style.transform;
    const baseTransform = currentTransform.replace(/ scale\([^)]*\)/, '');
    cell.style.transform = baseTransform; // Remove scale only
  }
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
    <img src="/images/kongface-white.svg" alt="Kong logo watermark" class="w-full h-full" />
  </div>
  
  <div class="max-w-4xl mx-auto px-6 md:px-8 w-full z-30 text-center relative transition-all duration-1000 ease-out {contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} pointer-events-none">
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
        class="neon-button relative inline-flex items-center overflow-hidden pointer-events-auto"
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

<style lang="postcss" scoped>
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
</style> 