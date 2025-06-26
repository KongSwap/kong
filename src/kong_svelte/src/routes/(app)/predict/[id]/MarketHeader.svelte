<script lang="ts">
  import { CircleHelp, Wand } from "lucide-svelte";

  let { market } = $props();
  
  let imageError = $state(false);

  // Handle image load error
  function handleImageError() {
    imageError = true;
  }

  // Validate image URL
  function isValidImageUrl(url: string): boolean {
    if (!url || url.length === 0) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
</script>

<div class="mb-8">
  <div class="flex items-center justify-center flex-col gap-3 sm:gap-4 max-w-full">
    <div
      class={isValidImageUrl(market.image_url) && !imageError
        ? "rounded-kong-roundness"
        : "mb-2 rounded-lg flex items-center justify-center"}
    >
      {#if isValidImageUrl(market.image_url) && !imageError}
        <img
          src={market.image_url}
          alt={market.category || "Market"}
          class="w-24 h-24 sm:w-20 sm:h-20 object-cover rounded-lg"
          loading="lazy"
          onerror={handleImageError}
        />
      {:else}
        <Wand
          class="text-kong-text-secondary/60 w-24 h-24 sm:w-20 sm:h-20 bg-kong-bg-tertiary p-4 rounded-lg"
        />
      {/if}
    </div>
    <div class="flex">
      <h1
        class="text-xl sm:text-2xl lg:text-3xl font-bold text-kong-text-primary leading-tight"
      >
        {market.question}
      </h1>
    </div>
    
  </div>
</div>
