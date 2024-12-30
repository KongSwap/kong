<!-- PageWrapper.svelte -->
<script lang="ts">
  export let page: string;
  let mouseX = 0;
  let mouseY = 0;

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

  function handleMouseMove(e: MouseEvent) {
    // Reduce the movement amount for subtler effect
    mouseX = (e.clientX / window.innerWidth - 1) * 20;
    mouseY = (e.clientY / window.innerHeight - 1) * 20;
  }
</script>

<svelte:window on:mousemove={handleMouseMove}/>

<div class="page-wrapper">
  <!-- Move the background elements into a separate container -->
  <div class="background-container">
    <div class="dark-gradient" />
    <div 
      class="nebula-effect"
      style="
        transform: translate({mouseX * 0.5}px, {mouseY * 0.5}px);
        --blue-x: {nebulaPositions.blue.x}%;
        --blue-y: {nebulaPositions.blue.y}%;
        --purple1-x: {nebulaPositions.purple1.x}%;
        --purple1-y: {nebulaPositions.purple1.y}%;
        --purple2-x: {nebulaPositions.purple2.x}%;
        --purple2-y: {nebulaPositions.purple2.y}%;
        --purple3-x: {nebulaPositions.purple3.x}%;
        --purple3-y: {nebulaPositions.purple3.y}%;
      "
    />
    
    <!-- Add stars -->
    <div 
      class="stars"
      style="transform: translate({mouseX * 0.2}px, {mouseY * 0.2}px)"
    >
      {#each Array(200) as _, i}
        <div 
          class="star"
          style="
            --size: {0.8 + Math.random() * 1.8}px;
            --top: {Math.random() * 100}%;
            --left: {Math.random() * 100}%;
            --brightness: {0.5 + Math.random() * 0.5};"
        />
      {/each}
    </div>

    <!-- Add skyline -->
    <div class="skyline-wrapper">
      <img 
        src="/backgrounds/skyline.svg" 
        alt="Skyline" 
        class="skyline"
      />
    </div>
  </div>
  
  <div class="ticker-wrapper">
    <slot />
  </div>
  <div class="content-wrapper">
    <!-- Rest of the content -->
  </div>
  <div class="grass-silhouette" />
  <div class="tree-silhouette" />
</div>

<style lang="postcss">
  .page-wrapper {
    @apply flex flex-col w-full;
    min-height: 100vh;
    position: relative;
    z-index: 0;
  }

  /* Background container to manage layers */
  .background-container {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
  }

  /* Dark theme gradient */
  .dark-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgb(2, 6, 23) 0%,
      rgb(10, 15, 35) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  /* Show dark gradient only in dark mode */
  :global(:root.dark) .dark-gradient {
    opacity: 1;
  }

  /* Nebula effect */
  .nebula-effect {
    position: absolute;
    inset: 0;
    opacity: 0;
    filter: blur(100px);
    transform: translateY(-20%);
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
      ),
      radial-gradient(
        circle at 50% 50%,
        rgba(15, 23, 42, 0.2),
        transparent 70%
      );
    transition: opacity 0.3s ease, transform 0.2s ease-out;
  }

  /* Show nebula only in dark mode */
  :global(:root.dark) .nebula-effect {
    opacity: 0.15;
  }

  /* Light theme sky gradient */
  :global(:root:not(.dark)) .background-container::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg, 
      rgb(181, 218, 255) 0%,
      rgb(165, 199, 236) 85%,
      rgb(204, 221, 237) 100%
    );
  }

  .ticker-wrapper {
    @apply w-full;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .content-wrapper {
    @apply flex-1;
  }

  /* Tree silhouette for light theme */
  :global(:root:not(.dark)) .tree-silhouette {
    position: fixed;
    bottom: 2rem;
    right: 10%;
    width: 200px;
    height: 300px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 160' preserveAspectRatio='none'%3E%3Cpath fill='%23436B35' d='M45,160 L55,160 L52,60 C52,60 45,50 50,30 C55,10 48,0 50,0 C52,0 45,10 50,30 C55,50 48,60 48,60 L45,160'/%3E%3Cpath fill='%235A8C47' d='M20,80 C20,40 50,20 50,20 C50,20 80,40 80,80 C80,120 50,110 50,110 C50,110 20,120 20,80 Z'/%3E%3Cpath fill='%236EA358' d='M30,60 C30,30 50,10 50,10 C50,10 70,30 70,60 C70,90 50,85 50,85 C50,85 30,90 30,60 Z'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: bottom;
    pointer-events: none;
    z-index: 1;
  }

  /* Grass silhouette for light theme */
  :global(:root:not(.dark)) .grass-silhouette {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 180px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'%3E%3Cpath fill='%2392C584' fill-opacity='0.2' d='M0,160 C120,160 180,110 240,110 C300,110 360,160 420,160 C480,160 540,110 600,110 C660,110 720,160 780,160 C840,160 900,110 960,110 C1020,110 1080,160 1140,160 C1200,160 1260,110 1320,110 C1380,110 1440,160 1440,160 L1440,320 L0,320 Z'/%3E%3Cpath fill='%2375B465' fill-opacity='0.3' d='M0,180 C60,180 120,140 180,140 C240,140 300,180 360,180 C420,180 480,140 540,140 C600,140 660,180 720,180 C780,180 840,140 900,140 C960,140 1020,180 1080,180 C1140,180 1200,140 1260,140 C1320,140 1380,180 1440,180 L1440,320 L0,320 Z'/%3E%3Cpath fill='%235AA349' fill-opacity='0.4' d='M0,220 C40,220 60,200 120,200 C180,200 240,220 300,220 C360,220 420,200 480,200 C540,200 600,220 660,220 C720,220 780,200 840,200 C900,200 960,220 1020,220 C1080,220 1140,200 1200,200 C1260,200 1320,220 1380,220 C1410,220 1430,200 1440,200 L1440,320 L0,320 Z'/%3E%3Cpath fill='%23508B3F' fill-opacity='0.5' d='M0,240 C30,240 45,230 90,230 C135,230 180,240 225,240 C270,240 315,230 360,230 C405,230 450,240 495,240 C540,240 585,230 630,230 C675,230 720,240 765,240 C810,240 855,230 900,230 C945,230 990,240 1035,240 C1080,240 1125,230 1170,230 C1215,230 1260,240 1305,240 C1350,240 1395,230 1440,230 L1440,320 L0,320 Z'/%3E%3C/svg%3E");
    background-size: cover;
    background-position: center;
    pointer-events: none;
    z-index: 0;
  }

  /* Add some grass blades */
  :global(:root:not(.dark)) .grass-silhouette::after {
    content: '';
    position: absolute;
    bottom: 40px;
    left: 0;
    right: 0;
    height: 60px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100'%3E%3Cg fill='%23508B3F' fill-opacity='0.3'%3E%3Cpath d='M0,50 L10,0 L20,50 L30,10 L40,50 L50,0 L60,50 L70,20 L80,50 L90,0 L100,50'/%3E%3C/g%3E%3C/svg%3E");
    background-size: 100px 100%;
    background-repeat: repeat-x;
    animation: sway 8s ease-in-out infinite alternate;
  }

  @keyframes sway {
    from {
      transform: translateX(-10px) scaleY(0.95);
    }
    to {
      transform: translateX(10px) scaleY(1.05);
    }
  }

  /* Hide grass and tree silhouettes in dark theme */
  :global(:root.dark) .grass-silhouette,
  :global(:root.dark) .tree-silhouette {
    display: none;
  }

  /* Stars styling */
  .stars {
    position: absolute;
    inset: 0;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.2s ease-out;
  }

  .star {
    position: absolute;
    width: var(--size);
    height: var(--size);
    background: white;
    border-radius: 50%;
    top: var(--top);
    left: var(--left);
    opacity: var(--brightness);
    box-shadow: 0 0 2px white;
  }

  /* Skyline styling */
  .skyline-wrapper {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 30vh;
    z-index: 2;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .skyline {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: bottom;
    transition: transform 0.2s ease-out;
  }

  /* Show elements in dark mode */
  :global(:root.dark) .stars,
  :global(:root.dark) .skyline-wrapper {
    opacity: 0.8;
  }

  /* Increase nebula opacity in dark mode */
  :global(:root.dark) .nebula-effect {
    opacity: 0.3;
  }
</style>
