<script lang="ts">
  // No props needed for this component
</script>

<div
  class="md:col-span-2 lg:col-span-2 bg-transparent flex flex-row items-center justify-center md:justify-start gap-3 sm:gap-6 md:gap-8 min-h-[280px] sm:min-h-[300px] md:min-h-0 md:h-[200px] lg:h-[220px] overflow-hidden md:py-0 px-2 sm:px-4 md:px-0"
>
  <div class="flex-shrink-0">
    <div class="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 kong-logo-mask"></div>
  </div>
  <div class="text-left min-w-0">
    <div class="font-bold leading-tight">
      <span class="text-kong-text-secondary text-xs sm:text-sm font-medium uppercase block">
        Explore the
      </span>
      <span class="relative bg-gradient-to-r from-kong-primary via-kong-secondary to-kong-primary bg-[length:300%_auto] bg-clip-text text-transparent text-3xl sm:text-4xl md:text-4xl lg:text-6xl font-black tracking-tight uppercase block animate-gradient-flow">
        bridgeless
      </span>
      <span class="text-kong-text-primary text-xl sm:text-2xl md:text-2xl lg:text-4xl block">
        future of DeFi
      </span>
    </div>
    <p class="mt-2 sm:mt-4 md:mt-3 text-sm sm:text-base md:text-sm lg:text-base text-kong-text-secondary">
      <span class="font-semibold text-kong-text-primary">No bridges. No wrapping. No hassle.</span>
    </p>
  </div>
</div>

<style>
  /* Gradient flow animation */
  @keyframes gradient-flow {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: -300% 50%;
    }
  }

  .animate-gradient-flow {
    animation: gradient-flow 5s linear infinite;
  }

  /* Use mask to apply kong-text-primary color to the SVG */
  .kong-logo-mask {
    background-color: rgb(var(--text-primary));
    -webkit-mask-image: url('/images/kongface-white.svg');
    mask-image: url('/images/kongface-white.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
</style>