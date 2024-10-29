<script lang="ts">
  let clouds: Array<any>;
  clouds = Array.from({ length: 20 }, (_, i) => ({
    src: `/backgrounds/cloud${(i % 4) + 1}.webp`,
    top: `${Math.random() * 85}%`,
    left: Math.random() > 0.5 ? "-20%" : "120%",
    animationDuration: `${200 + Math.random() * 1200}s`,
    delay: `-${Math.random() * 1000}s`,
    direction: Math.random() > 0.5 ? 1 : -1,
    size: 0.7 + Math.random() * 1.3,
  }));
</script>

<div class="floating-clouds h-screen overflow-hidden z-[1]">
  {#each clouds as cloud}
    <img
      src={cloud.src}
      alt="Cloud"
      class="cloud"
      style="
        top: {cloud.top};
        left: {cloud.left};
        animation-duration: {cloud.animationDuration};
        animation-delay: {cloud.delay};
        animation-direction: {cloud.direction === 1 ? 'normal' : 'reverse'};
        transform: scale({cloud.size});
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
    animation-name: float;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  @keyframes float {
    from {
      transform: translateX(-200vw);
    }
    to {
      transform: translateX(200vw);
    }
  }
</style>
