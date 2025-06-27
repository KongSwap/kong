<script lang="ts">
  import { AlertCircle, ChevronDown, ChevronUp, X, TrendingUp, Calculator, Trophy } from "lucide-svelte";
  import { browser } from "$app/environment";
  import Card from "$lib/components/common/Card.svelte";

  let isExpanded = $state(false);
  let shouldShow = $state(true);
  
  // Check localStorage on mount
  $effect(() => {
    if (browser) {
      const hiddenPref = localStorage.getItem('predict_hide_how_it_works');
      shouldShow = hiddenPref !== 'true';
    }
  });
  
  function handleDontShowAgain() {
    if (browser) {
      localStorage.setItem('predict_hide_how_it_works', 'true');
      shouldShow = false;
    }
  }
</script>

{#if shouldShow}
  <Card className="bg-kong-accent-blue/10 border-kong-accent-blue/20 w-full max-w-lg mx-auto">
    <!-- Collapsible header -->
    <button
      class="flex items-center justify-between w-full p-3 text-left hover:bg-kong-accent-blue/5 transition-colors"
      onclick={() => isExpanded = !isExpanded}
    >
      <div class="flex items-center gap-2">
        <AlertCircle class="w-4 h-4 text-kong-accent-blue flex-shrink-0" />
        <p class="text-sm font-medium text-kong-accent-blue">How prediction markets work</p>
      </div>
      <div class="flex items-center gap-2">
        {#if isExpanded}
          <ChevronUp class="w-4 h-4 text-kong-accent-blue" />
        {:else}
          <ChevronDown class="w-4 h-4 text-kong-accent-blue" />
        {/if}
      </div>
    </button>
    
    <!-- Expandable content -->
    {#if isExpanded}
      <div class="px-3 pb-3 pt-0 animate-fadeIn space-y-3">
        <div class="space-y-2 text-sm text-kong-text-secondary">
          <div class="flex items-start gap-2">
            <TrendingUp class="w-4 h-4 text-kong-accent-blue mt-0.5 flex-shrink-0" />
            <p><span class="font-medium">Predict outcomes:</span> Choose which outcome you think will happen and place your prediction with KONG tokens.</p>
          </div>
          <div class="flex items-start gap-2">
            <Calculator class="w-4 h-4 text-kong-accent-blue mt-0.5 flex-shrink-0" />
            <p><span class="font-medium">Dynamic probabilities:</span> The percentages update in real-time as more predictions come in, reflecting crowd wisdom.</p>
          </div>
          <div class="flex items-start gap-2">
            <Trophy class="w-4 h-4 text-kong-accent-blue mt-0.5 flex-shrink-0" />
            <p><span class="font-medium">Win rewards:</span> If your prediction is correct, you'll receive a payout based on the final probabilities when the market closes.</p>
          </div>
        </div>
        <button
          onclick={handleDontShowAgain}
          class="flex items-center gap-1.5 text-xs text-kong-text-secondary hover:text-kong-text-primary transition-colors mt-3"
        >
          <X class="w-3 h-3" />
          <span>Don't show this again</span>
        </button>
      </div>
    {/if}
  </Card>
{/if}

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.2s ease-out;
  }
</style>