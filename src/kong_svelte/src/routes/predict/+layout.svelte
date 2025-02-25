<script lang="ts">
  import { page } from "$app/stores";
  import Panel from "$lib/components/common/Panel.svelte";

  let { children } = $props<{ children: any }>();
</script>

{#if process.env.DFX_NETWORK !== 'ic'}
  <!-- Regular prediction markets content -->
  <div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4">
    {@render children?.()}
  </div>
{:else}
  <!-- Coming Soon Display -->
  <div class="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[70vh] text-center">
    <Panel 
      variant="transparent" 
      type="main" 
      width="100%" 
      className="max-w-2xl p-8 flex flex-col items-center"
      transition="fade"
      transitionParams={{ duration: 400 }}
    >
      <!-- Icon/Graphic -->
      <div class="mb-6 inline-flex p-6 rounded-full bg-kong-bg-light/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 text-kong-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      
      <!-- Title -->
      <h1 class="text-3xl font-bold text-kong-text-primary mb-4">Prediction Markets Coming Soon!</h1>
      
      <!-- Description -->
      <p class="text-kong-text-secondary text-lg mb-8">
        We're preparing to launch prediction markets on KongSwap.
        Soon you'll be able to create markets and place bets on various outcomes!
      </p>
      
      <!-- Progress Indicator -->
      <div class="w-full bg-kong-border h-2 rounded-full mb-4 overflow-hidden">
        <div class="bg-kong-accent-purple h-full rounded-full w-full relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"></div>
        </div>
      </div>
      
      <p class="text-kong-text-secondary">Development in progress - 98% complete</p>
    </Panel>
  </div>
{/if}
