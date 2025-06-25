<script lang="ts">
  import { CircleHelp } from "lucide-svelte";

  let { market } = $props();
</script>

<div class="!rounded animate-fadeIn mb-2">
  <div class="flex items-center gap-3 sm:gap-4">
    <div
      class="{market.image_url ? '' : 'p-3 bg-kong-bg-secondary/50 rounded-lg flex items-center justify-center'}"
    >
    {#if market.image_url && market.image_url.length > 0}
      <img src={market.image_url} alt="Market Icon" class="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg">
    {:else}
      <CircleHelp
        class="text-kong-text-secondary/60 w-10 h-10 sm:w-12 sm:h-12"
      />
    {/if}
    </div>
    <div class="flex-1">
      <h1
        class="text-xl sm:text-2xl lg:text-3xl font-bold text-kong-text-primary leading-tight"
      >
        {market.question}
      </h1>
    </div>
  </div>
</div> 