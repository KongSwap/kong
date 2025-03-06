<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight, Sparkles, Zap, Flame, Rocket, Copy, Check, Clock, Target, Award, Hourglass } from "lucide-svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/services/auth";
  import { idlFactory as tokenIdlFactory } from "../../../../../../src/declarations/token_backend/token_backend.did.js";
  import { toastStore } from "$lib/stores/toastStore";

  export let tokens = [];
  export let loading = false;

  // Enhanced token data with info from get_info
  let enhancedTokens = [];
  let loadingTokenInfo = true;

  // Generate a random gradient for tokens without logos
  function getRandomGradient() {
    const gradients = [
      "from-pink-600 to-purple-600",
      "from-blue-600 to-cyan-600",
      "from-green-600 to-teal-600",
      "from-yellow-600 to-orange-600",
      "from-red-600 to-pink-600",
      "from-indigo-600 to-blue-600"
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }

  // Generate a random emoji for tokens
  function getRandomEmoji() {
    const emojis = ["💰", "🚀", "💎", "🔥", "⚡", "🌊", "🦈", "💸", "🤑", "🏆"];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  // Get a random animation class
  function getRandomAnimation() {
    const animations = [
      "animate-pulse-fast", 
      "animate-pulse-subtle", 
      "animate-bounce", 
      "animate-spin-slow", 
      "animate-glow"
    ];
    return animations[Math.floor(Math.random() * animations.length)];
  }

  // Helper function to format block time
  function formatBlockTime(seconds) {
    if (!seconds) return "0s";
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds}s` 
        : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 
        ? `${hours}h ${minutes}m` 
        : `${hours}h`;
    }
  }

  // Helper function to format block reward
  function formatBlockReward(reward, decimals, ticker) {
    if (!reward) return "0";
    try {
      const formattedValue = formatBalance(reward, decimals);
      return `${formattedValue} ${ticker}`;
    } catch (error) {
      console.error("Error formatting block reward:", error);
      return `${reward} ${ticker}`;
    }
  }

  // Get token info from canister - fast version without mining info
  async function getTokenInfo(token) {
    try {
      // Create actor - get info only, skip mining info and block time
      const actor = auth.getActor(token.principal, tokenIdlFactory, { anon: true });
      
      // Get only the basic token info, skip mining info for speed
      const info = await actor.get_info();
      
      if (info?.Ok) {
        // Construct the token info, without mining/block data
        const tokenInfo = {
          ...token,
          ...info.Ok,
          infoLoaded: true,
          // We're skipping mining info and block time checks for speed
          miningInfo: null,
          averageBlockTime: null,
          // Preserve existing random elements or generate new ones if they don't exist
          randomGradient: token.randomGradient || getRandomGradient(),
          randomEmoji: token.randomEmoji || getRandomEmoji(),
          randomAnimation: token.randomAnimation || getRandomAnimation(),
          socialLinks: info.Ok.social_links?.[0] || []
        };
        
        // Process logo - support both string and array formats
        if (info.Ok.logo && typeof info.Ok.logo === 'string') {
          tokenInfo.logo = [info.Ok.logo];
        } else if (info.Ok.logo && info.Ok.logo.length > 0) {
          tokenInfo.logo = info.Ok.logo;
        }
        
        return tokenInfo;
      }
      
      // Return basic info if request failed
      return {
        ...token,
        infoLoaded: false,
        miningInfo: null,
        averageBlockTime: null,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomEmoji: token.randomEmoji || getRandomEmoji(),
        randomAnimation: token.randomAnimation || getRandomAnimation()
      };
    } catch (error) {
      // Just return the token with random visuals on error
      return {
        ...token,
        infoLoaded: false,
        miningInfo: null,
        averageBlockTime: null,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomEmoji: token.randomEmoji || getRandomEmoji(),
        randomAnimation: token.randomAnimation || getRandomAnimation()
      };
    }
  }

  // Load token info for all tokens - fast version
  async function loadAllTokenInfo() {
    loadingTokenInfo = true;
    try {
      // Load all tokens in parallel for maximum speed
      const promises = tokens.map(token => getTokenInfo(token));
      enhancedTokens = await Promise.all(promises);
    } catch (error) {
      console.error("Error loading token info:", error);
      enhancedTokens = tokens.map(token => ({
        ...token,
        infoLoaded: false,
        miningInfo: null,
        averageBlockTime: null,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomEmoji: token.randomEmoji || getRandomEmoji(),
        randomAnimation: token.randomAnimation || getRandomAnimation()
      }));
    } finally {
      loadingTokenInfo = false;
    }
  }

  function handleTokenClick(tokenPrincipal) {
    if (tokenPrincipal) {
      goto(`/launch/token/${tokenPrincipal}`);
    }
  }

  // Function to copy text to clipboard
  async function copyToClipboard(text, tokenName) {
    try {
      await navigator.clipboard.writeText(text);
      toastStore.success(`Copied ID for ${tokenName}`);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toastStore.error('Failed to copy to clipboard');
    }
  }

  // Modify reactive statement to prevent unnecessary reloads
  let prevTokensLength = 0;
  $: if (tokens && tokens.length > 0 && tokens.length !== prevTokensLength) {
    prevTokensLength = tokens.length;
    loadAllTokenInfo();
  }

  onMount(() => {
    // Initial load will be handled by the reactive statement
  });
</script>

<div class="grid gap-4">
  {#if loading || loadingTokenInfo}
    <Panel>
      <div class="flex flex-col gap-4 animate-pulse">
        <div class="w-1/4 h-6 rounded bg-kong-background-secondary"></div>
        <div class="w-1/2 h-4 rounded bg-kong-background-secondary"></div>
      </div>
    </Panel>
  {:else if enhancedTokens.length === 0}
    <Panel>
      <div class="py-8 text-center text-kong-text-primary/60">
        No tokens found
      </div>
    </Panel>
  {:else}
    {#each enhancedTokens as token}
      <Panel>
        <button
          class="w-full text-left transition-all duration-300 rounded-lg hover:scale-[1.01] hover:shadow-glow relative overflow-hidden group"
          on:click={() => handleTokenClick(token.principal.toString())}
        >
          <!-- Background with logo pattern or gradient -->
          <div class="absolute inset-0 opacity-10 bg-repeat z-0 group-hover:opacity-20 transition-opacity duration-300"
               style={token.logo && token.logo.length > 0 && token.logo[0] ? `background-image: url(${token.logo[0]}); background-size: 50px;` : ''}>
          </div>
          
          <!-- Gradient overlay -->
          <div class={`absolute inset-0 bg-gradient-to-r ${token.randomGradient} opacity-20 group-hover:opacity-30 transition-opacity duration-300 z-0`}></div>
          
          <!-- Content -->
          <div class="relative z-10 p-4">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                {#if token.logo && ((Array.isArray(token.logo) && token.logo.length > 0 && token.logo[0]) || typeof token.logo === 'string')}
                  <div class="relative">
                    <img
                      src={Array.isArray(token.logo) ? token.logo[0] : token.logo}
                      alt={token.name}
                      class="w-16 h-16 rounded-full border-2 border-white/20 shadow-glow"
                      on:error={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none'; 
                        const sibling = target.nextElementSibling as HTMLElement;
                        if (sibling) sibling.style.display = 'flex';
                      }}
                    />
                    <div class={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-r ${token.randomGradient} text-white text-xs ${token.randomAnimation}`}>
                      {token.randomEmoji}
                    </div>
                    <!-- Fallback if image fails to load -->
                    <div class={`hidden relative items-center justify-center w-16 h-16 text-3xl font-bold rounded-full bg-gradient-to-r ${token.randomGradient} text-white shadow-glow`}>
                      {token.ticker[0]}
                      <div class={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white text-xs ${token.randomAnimation}`} style={`color: var(--tw-gradient-to);`}>
                        {token.randomEmoji}
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class={`relative flex items-center justify-center w-16 h-16 text-3xl font-bold rounded-full bg-gradient-to-r ${token.randomGradient} text-white shadow-glow`}>
                    {token.ticker[0]}
                    <div class={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white text-xs ${token.randomAnimation}`} style={`color: var(--tw-gradient-to);`}>
                      {token.randomEmoji}
                    </div>
                  </div>
                {/if}
                <div>
                  <h3 class="text-xl font-extrabold flex items-center gap-2">
                    {token.name}
                    <Sparkles size={16} class={`text-yellow-400 ${token.randomAnimation}`} />
                  </h3>
                  <p class="text-sm font-bold text-white/70 flex items-center gap-1">
                    ${token.ticker}
                    <span class="px-1.5 py-0.5 text-xs rounded bg-white/10 ml-1">
                      {token.decimals} decimals
                    </span>
                  </p>
                </div>
              </div>
              
              <!-- Mining info removed for speed -->
              
              <div class="flex items-center gap-8">
                <div class="text-right">
                  <p class="text-sm text-white/70">Total Supply</p>
                  <p class="font-bold text-lg flex items-center gap-1">
                    {formatBalance(token.total_supply, token.decimals)} 
                    <span class="text-white/90">{token.ticker}</span>
                    <Flame size={16} class="text-orange-400 animate-pulse" />
                  </p>
                </div>
                <div class="bg-white/10 p-2 rounded-full group-hover:bg-white/20 transition-colors duration-300">
                  <ArrowRight size={20} class="text-white" />
                </div>
              </div>
            </div>
            
            <!-- Mining info removed for speed -->
            
            <!-- Additional token info -->
            {#if token.infoLoaded}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-white/10">
                <div class="bg-black/20 p-3 rounded-lg group relative">
                  <p class="text-sm text-white/70 flex items-center gap-1">
                    <Rocket size={14} class="text-blue-400" /> Mining ID
                  </p>
                  <div class="flex items-center gap-2">
                    <p class="font-bold text-xs md:text-sm break-all pr-2">
                      {token.principal.toString()}
                    </p>
                    <button 
                      class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-kong-primary-500 flex-shrink-0"
                      on:click|stopPropagation={(e) => {
                        e.preventDefault();
                        copyToClipboard(token.principal.toString(), token.name);
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                
                <div class="bg-black/20 p-3 rounded-lg group relative">
                  <p class="text-sm text-white/70 flex items-center gap-1">
                    <Rocket size={14} class="text-blue-400" /> Ledger ID
                  </p>
                  <div class="flex items-center gap-2">
                    {#if token.ledger_id?.[0]}
                      <p class="font-bold text-xs md:text-sm break-all pr-2">
                        {token.ledger_id[0].toString()}
                      </p>
                      <button 
                        class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-kong-primary-500 flex-shrink-0"
                        on:click|stopPropagation={(e) => {
                          e.preventDefault();
                          copyToClipboard(token.ledger_id[0].toString(), token.name);
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    {:else}
                      <p class="font-bold text-white/60 italic">
                        Not yet started
                      </p>
                    {/if}
                  </div>
                </div>
                
                <div class="bg-black/20 p-3 rounded-lg">
                  <p class="text-sm text-white/70">Social Links</p>
                  <p class="font-bold">
                    {Array.isArray(token.socialLinks) ? token.socialLinks.length : 0} links
                  </p>
                </div>
              </div>
            {/if}
          </div>
        </button>
      </Panel>
    {/each}
  {/if}
</div>

<style>
  @keyframes spin-slow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.7)); }
    50% { filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.9)); }
  }
  
  :global(.animate-spin-slow) {
    animation: spin-slow 3s linear infinite;
  }
  
  :global(.animate-glow) {
    animation: glow 2s ease-in-out infinite;
  }
  
  :global(.shadow-glow) {
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
  }
</style>
