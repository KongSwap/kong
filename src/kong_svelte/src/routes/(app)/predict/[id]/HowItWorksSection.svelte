<script lang="ts">
  import { HelpCircle, ChevronDown, ChevronUp, X, TrendingUp, Calculator, Trophy, Sparkles } from "lucide-svelte";
  import { browser } from "$app/environment";
  import Card from "$lib/components/common/Card.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
    import { goto } from "$app/navigation";

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
  <Card className="border-kong-border/60 bg-kong-bg-secondary/50 backdrop-blur-sm w-full max-w-lg mx-auto hover:border-kong-border/80 transition-all duration-200 relative overflow-hidden">
    <!-- Subtle gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-br from-kong-accent-blue/5 to-transparent pointer-events-none"></div>
    
    <!-- Collapsible header -->
    <button
      class="relative flex items-center justify-between w-full p-4 text-left group hover:bg-kong-accent-blue/5 transition-all duration-200 rounded-t-kong-roundness"
      onclick={() => isExpanded = !isExpanded}
    >
      <div class="flex items-center gap-3">
        <div class="relative">
          <HelpCircle class="w-5 h-5 text-kong-accent-blue transition-transform duration-200 group-hover:scale-110" />
          <Sparkles class="w-3 h-3 text-kong-accent-yellow absolute -top-1 -right-1 animate-pulse" />
        </div>
        <div>
          <p class="text-sm font-semibold text-kong-text-primary">How prediction markets work</p>
          {#if !isExpanded}
            <p class="text-xs text-kong-text-secondary mt-0.5">Click to learn the basics</p>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-[10px] font-medium text-kong-accent-blue bg-kong-accent-blue/10 px-2 py-0.5 rounded-full">
          {isExpanded ? 'HIDE' : 'LEARN'}
        </div>
        {#if isExpanded}
          <ChevronUp class="w-4 h-4 text-kong-text-secondary transition-transform duration-200 group-hover:text-kong-accent-blue" />
        {:else}
          <ChevronDown class="w-4 h-4 text-kong-text-secondary transition-transform duration-200 group-hover:text-kong-accent-blue" />
        {/if}
      </div>
    </button>
    
    <!-- Expandable content -->
    {#if isExpanded}
      <div class="px-6 pb-4 pt-0 relative">
        <div class="space-y-3 mt-3">
          <!-- Step 1 -->
          <div class="flex items-start gap-3 group hover:translate-x-1 transition-transform duration-200">
            <div class="bg-gradient-to-br from-kong-accent-blue to-kong-accent-blue/80 p-2 rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200">
              <TrendingUp class="w-4 h-4 text-white" />
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-kong-text-primary mb-0.5">Predict outcomes</p>
              <p class="text-xs text-kong-text-secondary leading-relaxed">Choose which outcome you think will happen and place your prediction with KONG tokens.</p>
            </div>
          </div>
          
          <!-- Step 2 -->
          <div class="flex items-start gap-3 group hover:translate-x-1 transition-transform duration-200">
            <div class="bg-gradient-to-br from-kong-accent-yellow to-kong-accent-yellow/80 p-2 rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200">
              <Calculator class="w-4 h-4 text-white" />
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-kong-text-primary mb-0.5">Dynamic probabilities</p>
              <p class="text-xs text-kong-text-secondary leading-relaxed">The percentages update in real-time as more predictions come in, reflecting crowd wisdom.</p>
            </div>
          </div>
          
          <!-- Step 3 -->
          <div class="flex items-start gap-3 group hover:translate-x-1 transition-transform duration-200">
            <div class="bg-gradient-to-br from-kong-success to-kong-success/80 p-2 rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200">
              <Trophy class="w-4 h-4 text-white" />
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-kong-text-primary mb-0.5">Win rewards</p>
              <p class="text-xs text-kong-text-secondary leading-relaxed">If your prediction is correct, you'll receive a payout based on the final probabilities when the market closes.</p>
            </div>
          </div>
        </div>
        
        <!-- Divider -->
        <div class="h-px bg-kong-border/40 my-4"></div>
        
        <!-- Don't show again button -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-kong-text-disabled cursor-pointer" onclick={() => goto("/predict/faq")}>Learn more</span>
          <ButtonV2
            onclick={handleDontShowAgain}
            variant="transparent"
            size="xs"
            theme="muted"
            className="hover:bg-kong-error/10 hover:text-kong-error group"
          >
            <div class="flex items-center gap-1.5">
              <X class="w-3 h-3 transition-transform duration-200 group-hover:rotate-90" />
              <span>Don't show again</span>
            </div>
          </ButtonV2>
        </div>
      </div>
    {/if}
  </Card>
{/if}

