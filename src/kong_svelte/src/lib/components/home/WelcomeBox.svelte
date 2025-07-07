<script lang="ts">
  // No props needed for this component
</script>

<div
  class="md:col-span-2 lg:col-span-2 bg-transparent flex flex-row items-center justify-center md:justify-start gap-6 md:gap-8 min-h-[300px] md:min-h-0 md:h-[200px] lg:h-[220px] overflow-hidden md:py-0 px-4 md:px-0"
>
  <div class="">
    <img src="/images/kongface-white.svg" alt="Kong Logo" class="w-32 h-32 md:w-36 md:h-36 lg:w-40 lg:h-40" />
  </div>
  <div class="text-left">
    <div class="font-bold leading-tight">
      <span class="text-kong-text-secondary text-sm font-medium uppercase block">
        Explore the
      </span>
      <span class="relative bg-gradient-to-r from-kong-primary via-kong-secondary to-kong-primary bg-[length:300%_auto] bg-clip-text text-transparent text-4xl sm:text-5xl md:text-4xl lg:text-6xl font-black tracking-tight uppercase block animate-gradient-flow">
        bridgeless
      </span>
      <span class="text-kong-text-primary text-2xl sm:text-3xl md:text-2xl lg:text-4xl block">
        future of DeFi
      </span>
    </div>
    <p class="mt-4 md:mt-3 text-base md:text-sm lg:text-base text-kong-text-secondary">
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
    animation: gradient-flow 4s linear infinite;
  }
</style>