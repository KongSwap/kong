<script lang="ts">
  import { CircleHelp, Wand } from "lucide-svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { truncateAddress } from "$lib/utils/principalUtils";

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
          class="max-h-36 max-w-xl object-cover rounded-lg mb-1"
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
        class="text-xl sm:text-2xl lg:text-3xl font-semibold text-kong-text-primary"
      >
        {market.question}
      </h1>
    </div>
    
    <!-- Category and Creator Badges -->
    <div class="flex items-center gap-2">
      {#if market.category}
        <Badge variant="gray" size="sm">
          {#if 'AI' in market.category}
            AI
          {:else if 'Memes' in market.category}
            Memes
          {:else if 'Crypto' in market.category}
            Crypto
          {:else if 'Politics' in market.category}
            Politics
          {:else if 'Other' in market.category}
            Other
          {/if}
        </Badge>
      {/if}
      
      {#if market.creator}
        <a href="/wallets/{market.creator.toText()}" class="inline-block">
          <Badge variant="purple" size="sm" class="hover:opacity-80 transition-opacity cursor-pointer">
            Created by {truncateAddress(market.creator.toText())}
          </Badge>
        </a>
      {/if}
    </div>
    
  </div>
</div>
