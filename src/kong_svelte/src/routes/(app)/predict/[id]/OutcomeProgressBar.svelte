<script lang="ts">
  export let percentage: number;

  $: colorClass = percentage >= 75
    ? 'from-emerald-500/50 to-emerald-400/30'
    : percentage >= 50
      ? 'from-kong-accent-green/50 to-kong-accent-green/30'
      : percentage >= 25
        ? 'from-yellow-500/50 to-yellow-400/30'
        : 'from-red-500/50 to-red-400/30';
</script>

<div
  class="relative h-1 sm:h-1.5 my-2 rounded-full bg-gradient-to-r {colorClass} animate-progress-grow overflow-hidden"
  style="width: {percentage}%;"
>
  <div class="absolute inset-0 animate-laser-glow"></div>
</div>

<style lang="postcss">
  @keyframes progress-grow {
    from {
      transform: scaleX(0);
      transform-origin: left;
    }
    to {
      transform: scaleX(1);
      transform-origin: left;
    }
  }

  @keyframes laser-glow {
    0% {
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--laser-color) 50%,
        transparent 100%
      );
      transform: translateX(-100%);
    }
    100% {
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--laser-color) 50%,
        transparent 100%
      );
      transform: translateX(100%);
    }
  }

  :global(.animate-progress-grow) {
    animation: progress-grow 1s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(.animate-laser-glow) {
    animation: laser-glow 1.5s ease-in-out infinite;
    content: "";
    position: absolute;
    inset: 0;
    --laser-color: rgba(68, 255, 131, 0.5);
  }

  /* Green theme colors */
  :global(.from-emerald-500\/50 .animate-laser-glow) {
    --laser-color: rgba(16, 185, 129, 0.5);
  }
  :global(.from-kong-accent-green\/50 .animate-laser-glow) {
    --laser-color: rgba(68, 255, 131, 0.5);
  }
  :global(.from-yellow-500\/50 .animate-laser-glow) {
    --laser-color: rgba(234, 179, 8, 0.5);
  }
  :global(.from-red-500\/50 .animate-laser-glow) {
    --laser-color: rgba(239, 68, 68, 0.5);
  }
</style> 