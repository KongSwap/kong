<script lang="ts">
  import { tooltip as tooltipAction } from "$lib/actions/tooltip";

  // Define props using the $props rune
  type TokenImagesProps = {
    tokens: Kong.Token[];
    size: number;
    containerClass?: string;
    imageWrapperClass?: string;
    overlap?: boolean;
    tooltip?: {
      text: string;
      direction: "top" | "bottom" | "left" | "right";
    };
    maxDisplay?: number;
    countBgColor?: string;
    countTextColor?: string;
    showSymbolFallback?: boolean;
    showNetworkIcon?: boolean;
  };

  let { 
    tokens = [], 
    size = 48, 
    containerClass = "", 
    imageWrapperClass = "", 
    overlap = false,
    maxDisplay = 5,
    countBgColor = "bg-kong-primary",
    countTextColor = "text-white",
    tooltip = { text: "", direction: "top" as const },
    showSymbolFallback = true,
    showNetworkIcon = false
  }: TokenImagesProps = $props();

  // Filter out invalid tokens and memoize result
  const validTokens = $derived(tokens.filter((token): token is Kong.Token => {
    return token && typeof token === "object";
  }));
  
  // Calculate displayed tokens and remaining count
  const displayedTokens = $derived(validTokens.slice(0, maxDisplay));
  const remainingCount = $derived(validTokens.length > maxDisplay ? validTokens.length - maxDisplay : 0);

  // Calculate tooltip content with total count info when needed
  const tooltipText = $derived(tooltip.text || "");
  const tooltipContent = $derived(
    remainingCount > 0 
      ? `${tooltipText}${tooltipText ? ' • ' : ''}${validTokens.length} tokens total`
      : tooltipText
  );

  // Track loading state for each token
  let imageLoadingStatus: Record<string, boolean> = {};

  // Handle image error with proper typing
  function handleImageError(
    e: Event & { currentTarget: EventTarget & HTMLImageElement },
    token: Kong.Token
  ) {
    console.error(`Failed to load image: ${e.currentTarget.src}`);
    imageLoadingStatus[token.address || token.symbol] = false;
  }

  // Handle image loading success
  function handleImageLoad(token: Kong.Token) {
    imageLoadingStatus[token.address || token.symbol] = true;
  }

  // Check if image exists for a token
  function hasValidImage(token: Kong.Token): boolean {
    return !!(token.logo_url);
  }
</script>

<div
  use:tooltipAction={{...tooltip, text: tooltipContent}}
  class="flex items-center {containerClass} p-0 m-0 group"
>
  {#each displayedTokens as token, index (token.address || token.symbol)}
    <div
      style="height: {size}px; width: {size}px; z-index: {displayedTokens.length - index}; transform: translateX(0); transition: transform 0.15s ease-in-out;{overlap && index < displayedTokens.length - 1 ? `margin-right: -${Math.floor(size * 0.25)}px;` : ''}"
      class="flex justify-center items-center rounded-full {imageWrapperClass} relative group-hover:hover:translate-y-[-2px]"
    >
      {#if token?.logo_url}
        <img
          class="w-full h-full rounded-full bg-kong-bg-secondary ring-1 ring-opacity-90"
          src={token.logo_url}
          alt={token.name}
          loading="eager"
          on:error={(e) => handleImageError(e as (Event & { currentTarget: EventTarget & HTMLImageElement }), token)}
          on:load={() => handleImageLoad(token)}
        />
      {:else}
        <div class="w-full h-full rounded-full bg-kong-text-primary/10 flex items-center justify-center ring-2 ring-opacity-90">
          <span 
            class="text-kong-primary text-center" 
            style="font-size: min(calc({size}px * 0.5), 1rem);"
          >
            {size < 36 && token.symbol.length > 1 ? token.symbol[0] : token.symbol}
          </span>
        </div>
      {/if}
      {#if showNetworkIcon || (size > 24 && !overlap)}
        <div 
          class="absolute -bottom-0.5 shadow -right-[0.15rem] border border-kong-bg-secondary p-[0.04rem] text-sm text-gray-200 rounded-full bg-kong-bg-secondary bg-gradient-to-r from-kong-primary to-kong-primary/50 flex items-center justify-center"
          style="width: {Math.min(size * 0.46, 28)}px; height: {Math.min(size * 0.46, 28)}px;"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={Math.min(size * 0.55, 28)} 
            height={Math.min(size * 0.55, 28)} 
            viewBox="0 0 32 32"
          >
            <path fill="currentColor" d="M23.282 9.01c-2.34-.12-4.42.88-5.78 2.53c0 0-1.53 1.98-1.53 1.97c0 0-1.93 2.53-1.92 2.53l-1.66 2.18l-.13.17c-.95 1.27-2.63 1.98-4.4 1.46a3.92 3.92 0 0 1-2.69-2.88a3.985 3.985 0 0 1 3.87-4.9c1.21 0 2.11.51 2.73 1.05c.66.58 1.67.49 2.21-.21c.47-.61.41-1.49-.15-2.01c-3.16-2.9-9.14-2.24-11.05 1.79c-2.48 5.23 1.3 10.39 6.26 10.39c2.18 0 4.13-.97 5.42-2.53l.43-.56s1.09-1.43 1.09-1.42c0 0 1.93-2.53 1.92-2.53l1.69-2.21l.12-.15c.87-1.18 2.37-1.85 4.02-1.53c1.46.29 2.67 1.43 3.03 2.88c.66 2.63-1.32 5-3.85 5c-1.19 0-2.09-.51-2.71-1.06a1.52 1.52 0 0 0-2.21.22c-.49.64-.4 1.53.2 2.07c.93.83 2.52 1.84 4.72 1.84c4.2 0 7.55-3.69 6.98-8c-.44-3.32-3.28-5.92-6.61-6.09"/>
          </svg>
        </div>
      {/if}
    </div>
  {/each}
  
  {#if remainingCount > 0}
    <div
      style="height: {size}px; width: {size}px; z-index: 0;{overlap ? `margin-right: -${Math.floor(size * 0.25)}px;` : ''}"
      class="flex items-center justify-center rounded-full {countBgColor} relative border border-kong-border shadow-md group-hover:hover:translate-y-[-2px] transition-transform duration-150"
    >
      <span class="text-[.625rem] font-bold {countTextColor}">+{remainingCount}</span>
    </div>
  {/if}
</div>
