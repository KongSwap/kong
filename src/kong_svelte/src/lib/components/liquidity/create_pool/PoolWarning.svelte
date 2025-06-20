<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  export let token0: Kong.Token;
  export let token1: Kong.Token;
</script>

<Panel variant="solid" type="secondary" className="bg-kong-warning/5 border-kong-warning/20">
  <div class="flex items-start gap-3">
    <div class="text-yellow-400">
      <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <div class="flex flex-col gap-1">
      <span class="warning-title">New Pool</span>
      <p class="warning-description">
        You are the first person to create a {token0.symbol}/{token1.symbol} pool. The initial price you set will determine the ratio between tokens.
      </p>
    </div>
  </div>
</Panel>

<style lang="postcss">
  .warning-icon {
    @apply w-6 h-6 text-yellow-500 flex-shrink-0 mt-1;
  }

  .warning-title {
    @apply block text-yellow-500 font-medium text-sm mb-1;
  }

  .warning-description {
    @apply text-white/70 text-sm leading-relaxed m-0;
  }
</style> 