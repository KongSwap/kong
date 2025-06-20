<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { fade } from 'svelte/transition';
  import { fetchTokensByCanisterId } from '$lib/api/tokens';
  import { onMount } from 'svelte';
  
  let {
    pending,  // { message: string; created_at: bigint; id: string }
    avatar,   // string
  } = $props<{
    pending: { message: string; created_at: bigint; id: string };
    avatar: string;
  }>();

  // Constants
  const DEFAULT_IMAGE = '/tokens/not_verified.webp';
  
  // State
  let tokenCache = $state(new Map());
  let processedMessage = $derived(processMessageContent(pending.message));
  let timeString = $derived(new Date(Number(pending.created_at / BigInt(1000000))).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  }));

  // Extract canister IDs from message for token lookups
  function extractCanisterIds(content: string) {
    const matches = [];
    const tokenRegex = /\/price\s+([a-zA-Z0-9-]+)/g;
    let match;
    
    while ((match = tokenRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  // Initialize token data
  onMount(async () => {
    const canisterIds = extractCanisterIds(pending.message);
    if (canisterIds.length > 0) {
      try {
        const tokens = await fetchTokensByCanisterId(canisterIds);
        tokens.forEach(token => {
          tokenCache.set(token.address, token);
        });
      } catch (error) {
        console.error('Error fetching token data:', error);
      }
    }
  });

  function processMessageContent(content: string) {
    // Changed to match Telegram-style commands: /price canister-id
    const tokenRegex = /\/price\s+([a-zA-Z0-9-]+)/g;
    
    return content.replace(tokenRegex, (match, canisterId) => {
      const token = tokenCache.get(canisterId);
      
      // Fallback token display when data is not available
      if (!token) {
        return `<span class="bg-kong-primary/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1 border border-kong-primary/20 align-text-bottom mx-0.5 text-xs">
          <span class="flex items-center gap-0.5">
            <img 
              src="${DEFAULT_IMAGE}" 
              alt="Loading token" 
              class="w-3.5 h-3.5 rounded-full"
              onerror="this.src='${DEFAULT_IMAGE}'"
            />
            ${canisterId.slice(0, 5).toUpperCase()}
          </span>
          <span class="flex items-center gap-0.5">
            <span class="w-2 h-2 rounded-full border border-kong-text-secondary/40 border-t-transparent animate-spin ml-1"></span>
          </span>
        </span>`;
      }
      
      // Get token logo URL or fallback
      const logoUrl = token.logo_url || DEFAULT_IMAGE;
      
      // Format price and determine price change direction
      const price = token.metrics?.price ? parseFloat(token.metrics.price).toFixed(2) : "?.??";
      const priceChange = token.metrics?.price_change_24h ? parseFloat(token.metrics.price_change_24h).toFixed(3) : "0.00";
      const direction = !token.metrics?.price_change_24h ? "neutral" 
                      : parseFloat(token.metrics.price_change_24h) > 0 ? "up" 
                      : parseFloat(token.metrics.price_change_24h) < 0 ? "down" 
                      : "neutral";
      
      // Choose arrow and color based on price direction
      const arrowIcon = direction === "up" 
        ? `<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
        : direction === "down"
          ? `<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`
          : `<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      
      const priceChangeClass = direction === "up" 
        ? "text-kong-success" 
        : direction === "down" 
          ? "text-kong-error" 
          : "text-kong-text-secondary";
      
      const formattedChange = priceChange.startsWith("-") ? priceChange : `+${priceChange}`;
      
      return `<span class="bg-kong-primary/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1 border border-kong-primary/20 align-text-bottom mx-0.5 text-xs">
        <span class="flex items-center gap-0.5">
          <img 
            src="${logoUrl}" 
            alt="${token.symbol || token.name || 'Token'}" 
            class="w-3.5 h-3.5 rounded-full"
            onerror="this.src='${DEFAULT_IMAGE}'"
          />
          ${token.symbol || token.name || canisterId.slice(0, 5).toUpperCase()}
        </span>
        <span class="flex items-center gap-0.5">
          $${price}
          <span class="${priceChangeClass} flex items-center gap-0.5">(${formattedChange}%)${arrowIcon}</span>
        </span>
      </span>`;
    });
  }
</script>

<div class="flex flex-col items-end" transition:fade={{ duration: 150 }}>
  <div class="flex items-end gap-1.5 max-w-[85%]">
    <div class="bg-kong-primary/10 text-white rounded-t-md rounded-bl-md rounded-br-sm px-3 py-2 opacity-70 relative">
      <p class="text-sm break-words leading-relaxed">{@html processedMessage}</p>
      
      <div class="flex items-center gap-1 text-xs text-kong-text-secondary mt-0.5">
        <span class="opacity-70">Sending</span>
        <span class="w-2 h-2 rounded-full border border-kong-text-secondary/40 border-t-transparent animate-spin"></span>
        <span class="ml-0.5 whitespace-nowrap">{timeString}</span>
      </div>
    </div>
  </div>
</div>

<style scoped lang="postcss">
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 