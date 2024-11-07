<script lang="ts">
  import cloud1 from '$lib/assets/clouds/cloud1.webp';
  import cloud2 from '$lib/assets/clouds/cloud2.webp';
  import cloud3 from '$lib/assets/clouds/cloud3.webp';
  import cloud4 from '$lib/assets/clouds/cloud4.webp';

  interface Cloud {
    src: string;
    top: string;
    left: string;
    animationDuration: string;
    delay: string;
    direction: number;
    size: number;
  }

  const clouds: Array<Cloud> = Array.from({ length: 14 }, (_, i) => ({
    src: [cloud1, cloud2, cloud3, cloud4][i % 4],
    top: `${Math.random() * 85}%`,
    left: Math.random() > 0.5 ? '-20%' : '120%',
    animationDuration: `${200 + Math.random() * 900}s`,
    delay: `-${Math.random() * 1000}s`,
    direction: Math.random() > 0.5 ? 1 : -1,
    size: 0.7 + Math.random() * 1.3,
  }));
</script>

<div class="floating-clouds overflow-hidden z-[0] bg-transparent">
  {#each clouds as cloud}
    <img
      src={cloud.src}
      alt="Cloud"
      class="cloud"
      style="
        --top: {cloud.top};
        --left: {cloud.left};
        --animation-duration: {cloud.animationDuration};
        --animation-delay: {cloud.delay};
        --animation-direction: {cloud.direction === 1 ? 'normal' : 'reverse'};
        --scale: {cloud.size};
      "
    />
  {/each}
</div>

<style scoped>
  .floating-clouds {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  .cloud {
    position: absolute;
    top: var(--top);
    left: var(--left);
    animation-name: float;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-duration: var(--animation-duration);
    animation-delay: var(--animation-delay);
    animation-direction: var(--animation-direction);
    transform: scale(var(--scale));
    will-change: transform;
  }

  @keyframes float {
    from {
      transform: translateX(-120vw);
    }
    to {
      transform: translateX(130vw);
    }
  }
</style>
