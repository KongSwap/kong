<script lang="ts">
  let { children } = $props();

  function tvOut(node: HTMLElement, { 
    duration = 300,
  }) {
    return {
      duration,
      css: (t: number) => {
        // t goes from 1 to 0
        const scaleY = t; // Compress to a line
        const staticIntensity = t < 0.5 ? 1 : 0;
        
        node.style.setProperty('--noise-opacity', String(staticIntensity));
        
        return `
          transform: scaleY(${scaleY * 0.05 + 0.01});
          transform-origin: center;
        `;
      }
    };
  }

  function tvIn(node: HTMLElement, { 
    duration = 300,
  }) {
    return {
      duration,
      css: (t: number) => {
        // t goes from 0 to 1
        const scaleY = 1 - t; // Start compressed, expand to full
        const staticIntensity = t < 0.5 ? 1 : 0;
        
        node.style.setProperty('--noise-opacity', String(staticIntensity));
        
        return `
          transform: scaleY(${scaleY * 0.05 + 0.01});
          transform-origin: center;
        `;
      }
    };
  }
</script>

{#key children}
  <div
    class="tv-screen"
    in:tvIn={{duration: 300}}
    out:tvOut={{duration: 300}}
  >
    {@render children()}
  </div>
{/key}

<style>
  .tv-screen {
    position: relative;
    width: 100%;
    min-height: 100vh;
    background: black;
  }

  .tv-screen::before {
    content: "";
    position: fixed;
    top: -50%;
    left: -50%;
    width: 200vw;
    height: 200vh;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
    animation: staticNoise 0.02s infinite steps(1);
    opacity: var(--noise-opacity, 0);
    pointer-events: none;
    mix-blend-mode: screen;
    z-index: 9999;
  }

  @keyframes staticNoise {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(-10px, 5px); }
    20% { transform: translate(10px, -5px); }
    30% { transform: translate(-5px, -10px); }
    40% { transform: translate(5px, 10px); }
    50% { transform: translate(-10px, -5px); }
    60% { transform: translate(10px, 5px); }
    70% { transform: translate(-5px, 10px); }
    80% { transform: translate(5px, -10px); }
    90% { transform: translate(-10px, -5px); }
  }

  .tv-screen::after {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 2px;
    background: rgba(255, 255, 255, 0.9);
    animation: scanline 0.05s linear infinite;
    pointer-events: none;
    opacity: var(--noise-opacity, 0);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
    z-index: 9999;
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
</style>
