<script lang="ts">
  import Card from "$lib/components/common/Card.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { Rocket, Info, ArrowRight } from "lucide-svelte";
  import type { Market } from "$lib/types/predictionMarket";

  let { market, formattedMinInitialBetString, onSelectOutcome } =
    $props<{
      market: Market;
      formattedMinInitialBetString: string;
      onSelectOutcome: (outcomeIndex: number) => void;
    }>();
    
  // Derive outcomes from market
  let outcomes = $derived(market?.outcomes || []);
</script>

<div class="relative">
  <!-- Glow effect -->
  <div class="absolute -inset-[2px] bg-gradient-to-r from-kong-primary/50 via-kong-success/50 to-kong-warning/50 rounded-kong-roundness blur-sm animate-pulse"></div>
  
  <Card
    className="relative p-6 bg-gradient-to-br from-kong-primary/5 to-kong-primary/5 !border-2 !border-kong-success/40 shadow-lg shadow-kong-success/20"
  >
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-start gap-3">
      <div class="relative">
        <div class="absolute inset-0 rounded-kong-roundness bg-kong-primary/30 blur-md animate-pulse"></div>
        <div class="relative p-3 rounded-kong-roundness bg-gradient-to-br from-kong-primary/30 to-kong-success/20 border border-kong-primary/30">
          <Rocket class="w-6 h-6 text-kong-primary" />
        </div>
      </div>
      <div class="flex-1">
        <h3 class="text-xl font-semibold text-kong-text-primary mb-1">
          Activate Your Market
        </h3>
        <p class="text-sm text-kong-text-secondary">
          Place the first bet of {formattedMinInitialBetString} to make this market
          live and visible to everyone
        </p>
      </div>
    </div>

    <!-- Info Box -->
    <div
      class="flex items-start gap-2 p-3 rounded-kong-roundness bg-kong-bg-secondary/50 border border-kong-border/50"
    >
      <Info class="w-4 h-4 text-kong-text-secondary mt-0.5 flex-shrink-0" />
      <div class="text-sm text-kong-text-secondary">
        <p class="font-medium mb-1">Why activation is required:</p>
        <ul class="space-y-1 list-disc list-inside">
          <li>Ensures market creators have stake in the market</li>
          <li>Provides initial liquidity for other participants</li>
          <li>Prevents spam market creation</li>
        </ul>
      </div>
    </div>

    <!-- Outcomes Selection -->
    <div class="space-y-3">
      <h4 class="text-sm font-medium text-kong-text-secondary">
        Choose an outcome to activate with:
      </h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each outcomes as outcome, index}
          <button
            onclick={() => onSelectOutcome(index)}
            class="group relative p-4 rounded-kong-roundness bg-kong-bg-secondary/80 hover:bg-kong-primary/10 border-2 border-kong-border hover:border-kong-primary transition-all duration-200 transform hover:scale-[1.02] hover:shadow-md"
          >
            <!-- Hover glow effect -->
            <div class="absolute inset-0 rounded-kong-roundness opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            
            <div class="relative flex items-center justify-between">
              <div class="text-left">
                <p
                  class="font-semibold text-base text-kong-text-primary"
                >
                  {outcome}
                </p>
                <p class="text-xs text-kong-text-secondary mt-1">
                  Activate with {formattedMinInitialBetString}
                </p>
              </div>
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-kong-primary/10 group-hover:bg-kong-primary/20 transition-all">
                <ArrowRight
                  class="w-5 h-5 text-kong-primary transition-all group-hover:translate-x-0.5"
                />
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Additional Info -->
    <div
      class="text-xs text-kong-text-secondary text-center pt-2 border-t border-kong-border/30"
    >
      <p>
        Once activated, your market will be visible on the main page and open
        for predictions
      </p>
    </div>
  </div>
  </Card>
</div>

<style>
  @keyframes glow-pulse {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
  }
  
  .animate-pulse {
    animation: glow-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
