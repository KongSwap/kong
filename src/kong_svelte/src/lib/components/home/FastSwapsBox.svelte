<script lang="ts">
  import { Zap, Activity, TrendingUp } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  import { onMount } from "svelte";
  
  let swapTime = $state(2.5);
  let isAnimating = $state(false);
  
  // Simulate real-time swap time updates
  onMount(() => {
    const interval = setInterval(() => {
      swapTime = 2.5; // Random between 1.8-2.4
      isAnimating = true;
      setTimeout(() => isAnimating = false, 300);
    }, 5000);
    
    return () => clearInterval(interval);
  });
</script>

<Card
  className="group relative overflow-hidden"
  isPadded={true}
>
  <!-- Animated background -->
  <div class="absolute inset-0">
    <div
      class="absolute bottom-0 left-0 w-32 h-32 bg-kong-warning/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"
    ></div>
    <div
      class="absolute top-0 right-0 w-24 h-24 bg-kong-warning/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700 delay-100"
    ></div>
  </div>

  <div class="relative z-10 h-full flex flex-col">
    <div class="flex items-start justify-between mb-2 sm:mb-4">
      <div>
        <h3 class="text-base sm:text-xl font-semibold text-kong-text-primary mb-0.5 sm:mb-1">
          Lightning Fast
        </h3>
        <p class="text-xs sm:text-sm text-kong-text-secondary">
          Execute swaps in seconds
        </p>
      </div>
      <div class="p-1.5 sm:p-2.5 bg-kong-warning/10 rounded-lg sm:rounded-xl group-hover:bg-kong-warning/20 transition-colors">
        <Zap class="w-4 h-4 sm:w-6 sm:h-6 text-kong-warning" />
      </div>
    </div>

    <div class="flex-1 flex flex-col gap-2 sm:gap-3">
      <!-- Main metric display -->
      <div class="bg-kong-bg-tertiary rounded-lg px-3 py-2 sm:p-4 min-h-[60px] sm:min-h-[80px] flex items-center justify-center">
        <div class="flex items-center gap-4">
          <div class="text-center">
            <span class="text-3xl sm:text-5xl font-bold text-kong-text-primary transition-all duration-300 {isAnimating ? 'scale-105' : ''}">
              {swapTime.toFixed(1)}s
            </span>
            <span class="text-xs sm:text-base text-kong-text-secondary block mt-0.5 sm:mt-1">Average swap time</span>
          </div>
        </div>
      </div>
      
      <!-- Stats -->
      <div class="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div class="text-center p-1.5 sm:p-2 bg-kong-bg-tertiary/10 rounded-md sm:rounded-lg">
          <div class="flex items-center justify-center gap-0.5 sm:gap-1">
            <TrendingUp class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-kong-success" />
            <span class="text-base sm:text-xl font-bold text-kong-success">99.8%</span>
          </div>
          <span class="text-[10px] sm:text-xs text-kong-text-secondary block">Success rate</span>
        </div>
        <div class="text-center p-1.5 sm:p-2 bg-kong-bg-tertiary/10 rounded-md sm:rounded-lg">
          <span class="text-base sm:text-xl font-bold text-kong-warning">1.2M+</span>
          <span class="text-[10px] sm:text-xs text-kong-text-secondary block">Total swaps</span>
        </div>
      </div>
    </div>
  </div>
</Card>