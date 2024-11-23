<script lang="ts">
  import cloud1 from '$lib/assets/clouds/cloud1.webp';
  import cloud2 from '$lib/assets/clouds/cloud2.webp';
  import cloud4 from '$lib/assets/clouds/cloud4.webp';

  interface Cloud {
    src: string;
    top: string;
    left: string;
    duration: string;
    delay: string;
    scale: number;
    opacity: number;
  }

  const CLOUD_IMAGES = [cloud1, cloud2, cloud4];
  const NUM_CLOUDS = 10;

  const clouds: Cloud[] = Array.from({ length: NUM_CLOUDS }, () => {
    const isLeftToRight = Math.random() > 0.5;
    return {
      src: CLOUD_IMAGES[Math.floor(Math.random() * CLOUD_IMAGES.length)],
      top: `${Math.random() * 70}%`,
      left: isLeftToRight ? '-20%' : '120%',
      duration: `${150 + Math.random() * 200}s`,
      delay: `-${Math.random() * 200}s`,
      scale: 0.6 + Math.random() * 0.8,
      opacity: 0.4 + Math.random() * 0.3
    };
  });
</script>

<div class="clouds-container">
  {#each clouds as cloud}
    <img
      src={cloud.src}
      alt=""
      class="cloud"
      style="
        --top: {cloud.top};
        --left: {cloud.left};
        --duration: {cloud.duration};
        --delay: {cloud.delay};
        --scale: {cloud.scale};
        --opacity: {cloud.opacity};
      "
    />
  {/each}
</div>

<style lang="postcss">
  .clouds-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    overflow: hidden;
  }

  .cloud {
    position: absolute;
    top: var(--top);
    left: var(--left);
    transform: scale(var(--scale));
    opacity: var(--opacity);
    animation: float var(--duration) linear infinite;
    animation-delay: var(--delay);
    will-change: transform;
    filter: brightness(1.1) contrast(0.95);
    image-rendering: pixelated;
  }

  @keyframes float {
    from {
      transform: translateX(0) scale(var(--scale));
    }
    to {
      transform: translateX(140vw) scale(var(--scale));
    }
  }

  /* Optimize performance */
  @media (prefers-reduced-motion: reduce) {
    .cloud {
      animation: none;
    }
  }
</style>
