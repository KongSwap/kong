<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight, Sparkles, Zap, Flame, Rocket, Copy, Check, Clock, Target, Award, Hourglass, Activity, BarChart3 } from "lucide-svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/services/auth";
  import { idlFactory as tokenIdlFactory } from "../../../../../../src/declarations/token_backend/token_backend.did.js";
  import { toastStore } from "$lib/stores/toastStore";

  export let tokens = [];
  export let loading = false;

  // Enhanced token data with info from get_info and get_metrics
  let enhancedTokens = [];
  let loadingTokenInfo = true;

  // Generate a random gradient for tokens without logos
  function getRandomGradient() {
    const gradients = [
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }

  // Generate a random icon for tokens
  function getRandomIcon() {
    const icons = ["star", "bolt", "circle", "triangle", "square", "diamond", "check", "hash"];
    return icons[Math.floor(Math.random() * icons.length)];
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
    if (!seconds) return "N/A";
    
    return seconds.toFixed(2) + "s";
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

  // Format circulation percentage
  function formatCirculationPercentage(circulating, total) {
    if (!circulating || !total || total === 0) return "0%";
    const percentage = (Number(circulating) / Number(total)) * 100;
    return percentage.toFixed(2) + "%";
  }

  // Get token info from canister - enhanced version with block time and metrics
  async function getTokenInfo(token) {
    try {
      // Create actor - anonymous for public data
      const actor = auth.getActor(token.principal, tokenIdlFactory, { anon: true });
      
      // Fetch all data in parallel for maximum efficiency
      const [infoResult, blockTimeResult, metricsResult] = await Promise.all([
        actor.get_info().catch(() => ({ Err: "Failed to fetch info" })),
        actor.get_average_block_time([15]).catch(() => ({ Err: "Failed to fetch block time" })),
        actor.get_metrics().catch(() => ({ Err: "Failed to fetch metrics" }))
      ]);
      
      // Process basic info
      const info = infoResult?.Ok || null;
      
      // Process block time
      const blockTime = blockTimeResult?.Ok || null;
      
      // Process metrics
      const metrics = metricsResult?.Ok || null;
      
      // Calculate mining progress percentage if metrics available
      const miningProgress = metrics ? 
        formatCirculationPercentage(metrics.circulating_supply, metrics.total_supply) : null;
      
      // Generate random visual elements if not already present
      const randomGradient = token.randomGradient || getRandomGradient();
      const randomIcon = token.randomIcon || getRandomIcon();
      const randomAnimation = token.randomAnimation || getRandomAnimation();
      
      // Construct the enhanced token object
      const tokenInfo = {
        ...token,
        ...(info || {}),
        infoLoaded: !!info,
        averageBlockTime: blockTime,
        metrics: metrics,
        miningProgress,
        randomGradient,
        randomIcon,
        randomAnimation,
        name: info?.name || token.name || "Unknown Token",
        ticker: info?.ticker || token.ticker || "???"
      };
      
      // Process logo - support both string and array formats
      if (info?.logo && typeof info.logo === 'string') {
        tokenInfo.logo = [info.logo];
      } else if (info?.logo && info.logo.length > 0) {
        tokenInfo.logo = info.logo;
      }
      
      return tokenInfo;
    } catch (error) {
      console.error("Error fetching token info:", error);
      // Return basic token with random visuals on error
      return {
        ...token,
        infoLoaded: false,
        averageBlockTime: null,
        metrics: null,
        miningProgress: null,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
        // Ensure name and ticker have default values to prevent null reference errors
        name: token.name || "Unknown Token",
        ticker: token.ticker || "???"
      };
    }
  }

  // Load token info for all tokens - optimized version
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
        averageBlockTime: null,
        metrics: null,
        miningProgress: null,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
        // Ensure name and ticker have default values to prevent null reference errors
        name: token.name || "Unknown Token",
        ticker: token.ticker || "???"
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

  // Generate a dynamic pattern based on token metrics
  function getDynamicPattern(token) {
    // Use block time to influence pattern density
    const blockTime = token.averageBlockTime || 10;
    const patternSize = Math.max(10, Math.min(30, blockTime * 2));
    
    // Use circulation percentage to influence pattern opacity
    const circulationPct = token.miningProgress ? 
      parseFloat(token.miningProgress) : 50;
    const patternOpacity = Math.max(0.05, Math.min(0.2, circulationPct / 500));
    
    return `background-size: ${patternSize}px ${patternSize}px; opacity: ${patternOpacity};`;
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

<div class="space-y-3">
  {#if loading || loadingTokenInfo}
    <Panel variant="transparent" type="main">
      <div class="flex flex-col gap-4 animate-pulse">
        <div class="w-1/4 h-6 rounded bg-kong-background-secondary"></div>
        <div class="w-1/2 h-4 rounded bg-kong-background-secondary"></div>
      </div>
    </Panel>
  {:else if enhancedTokens.length === 0}
    <Panel variant="transparent" type="main">
      <div class="py-2 text-center text-kong-text-primary/60">
        No tokens found
      </div>
    </Panel>
  {:else}
    {#each enhancedTokens as token}
      <Panel 
        variant="transparent" 
        type="main" 
        className="token-panel hover:border-green-500/30 transition-all duration-200 overflow-hidden"
        unpadded={true}
        animated={true}
      >
        <button
          class="w-full text-left relative overflow-hidden group rounded-xl"
          on:click={() => handleTokenClick(token.principal.toString())}
        >
          <!-- Solid background with stronger gradient -->
          <div class={`absolute inset-0 bg-gradient-to-r ${token.randomGradient} opacity-20 group-hover:opacity-25 transition-opacity duration-300 z-0`}></div>
          
          <!-- Content -->
          <div class="relative z-10 p-4">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                {#if token.logo && ((Array.isArray(token.logo) && token.logo.length > 0 && token.logo[0]) || typeof token.logo === 'string')}
                  <div class="relative">
                    <img
                      src={Array.isArray(token.logo) ? token.logo[0] : token.logo}
                      alt={token.name}
                      class="w-16 h-16 rounded-full border-2 border-green-500/30 shadow-glow object-cover"
                      on:error={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none'; 
                        const sibling = target.nextElementSibling as HTMLElement;
                        if (sibling) sibling.style.display = 'flex';
                      }}
                    />
                    <!-- Mining progress indicator around logo -->
                    {#if token.miningProgress}
                      <svg class="absolute inset-0 w-16 h-16 -rotate-90">
                        <circle 
                          cx="32" 
                          cy="32" 
                          r="30" 
                          fill="none" 
                          stroke="rgba(16, 185, 129, 0.2)" 
                          stroke-width="3"
                        />
                        <circle 
                          cx="32" 
                          cy="32" 
                          r="30" 
                          fill="none" 
                          stroke="#10b981" 
                          stroke-width="3"
                          stroke-dasharray="188.5"
                          stroke-dashoffset={188.5 - (188.5 * parseFloat(token.miningProgress) / 100)}
                          class="transition-all duration-1000 ease-out"
                        />
                      </svg>
                    {/if}
                    <div class={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-r from-green-600 to-green-400 text-white text-xs ${token.randomAnimation}`}>
                      <span class="text-xs font-bold">{token.ticker[0]}</span>
                    </div>
                    <!-- Fallback if image fails to load -->
                    <div class={`hidden relative items-center justify-center w-16 h-16 text-3xl font-bold rounded-full bg-gradient-to-r from-green-600 to-green-400 text-white shadow-glow`}>
                      {token.ticker[0]}
                      <div class={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white text-xs ${token.randomAnimation}`} style={`color: #10b981;`}>
                        <span class="text-xs font-bold">{token.ticker[0]}</span>
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class={`relative flex items-center justify-center w-16 h-16 text-3xl font-bold rounded-full bg-gradient-to-r from-green-600 to-green-400 text-white shadow-glow`}>
                    {token.ticker[0]}
                    <div class={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white text-xs ${token.randomAnimation}`} style={`color: #10b981;`}>
                      <span class="text-xs font-bold">{token.ticker[0]}</span>
                    </div>
                  </div>
                {/if}
                <div>
                  <h3 class="text-xl font-extrabold flex items-center gap-2">
                    {#if !token.infoLoaded && loadingTokenInfo}
                      <span class="animate-pulse">Loading token...</span>
                    {:else}
                      {token.name}
                    {/if}
                    {#if token.averageBlockTime}
                      <span class="text-xs font-normal px-1.5 py-0.5 rounded bg-green-900/30 text-green-400">
                        <span class="flex items-center gap-1">
                          <Clock size={10} /> {formatBlockTime(token.averageBlockTime)}
                        </span>
                      </span>
                    {/if}
                  </h3>
                  <p class="text-sm font-bold text-white/80 flex items-center gap-1">
                    ${token.ticker}
                    <span class="px-1.5 py-0.5 text-xs rounded bg-green-900/20 text-green-400 ml-1">
                      {token.decimals}d
                    </span>
                    
                    <!-- Mining progress percentage in header -->
                    {#if token.miningProgress}
                      <span class="ml-2 px-1.5 py-0.5 text-xs rounded bg-green-900/30 text-green-400 flex items-center gap-1">
                        <Target size={10} /> {token.miningProgress} mined
                      </span>
                    {/if}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-xs text-white/70">Total Supply</p>
                  <p class="font-bold text-sm flex items-center gap-1">
                    {formatBalance(token.total_supply, token.decimals)} 
                    <span class="text-white/90">{token.ticker}</span>
                  </p>
                </div>
                <div class="bg-green-900/20 p-1.5 rounded-full group-hover:bg-green-800/30 transition-colors duration-300">
                  <ArrowRight size={16} class="text-green-400" />
                </div>
              </div>
            </div>
            
            {#if token.infoLoaded}
              <!-- Token IDs section -->
              <div class="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-green-900/30">
                <Panel variant="transparent" type="secondary" className="group/field relative bg-black/10" unpadded={false}>
                  <div class="py-1">
                    <p class="text-xs text-white/70 flex items-center gap-1 mb-1">
                      <Rocket size={12} class="text-green-400" /> Mining ID
                    </p>
                    <div class="flex items-center gap-1">
                      <p class="font-bold text-sm truncate pr-1">
                        {token.principal.toString().substring(0, 18)}...
                      </p>
                      <button 
                        class="opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 hover:text-green-400 flex-shrink-0"
                        on:click|stopPropagation={(e) => {
                          e.preventDefault();
                          copyToClipboard(token.principal.toString(), token.name);
                        }}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </Panel>
                
                <Panel variant="transparent" type="secondary" className="group/field relative bg-black/10" unpadded={false}>
                  <div class="py-1">
                    <p class="text-xs text-white/70 flex items-center gap-1 mb-1">
                      <Rocket size={12} class="text-green-400" /> Ledger ID
                    </p>
                    <div class="flex items-center gap-1">
                      {#if token.ledger_id?.[0]}
                        <p class="font-bold text-sm truncate pr-1">
                          {token.ledger_id[0].toString().substring(0, 18)}...
                        </p>
                        <button 
                          class="opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 hover:text-green-400 flex-shrink-0"
                          on:click|stopPropagation={(e) => {
                            e.preventDefault();
                            copyToClipboard(token.ledger_id[0].toString(), token.name);
                          }}
                        >
                          <Copy size={12} />
                        </button>
                      {:else}
                        <p class="font-bold text-white/60 italic text-sm">
                          Not started
                        </p>
                      {/if}
                    </div>
                  </div>
                </Panel>
              </div>
              
              <!-- Block time section - simplified -->
              {#if token.averageBlockTime}
                <Panel variant="transparent" type="secondary" className="mt-3 relative overflow-hidden bg-black/10" unpadded={false}>
                  <div class="flex items-center justify-between py-1">
                    <p class="text-sm font-medium flex items-center gap-2">
                      <Activity size={14} class="text-green-400" /> 
                      Block Time: <span class="font-bold">{formatBlockTime(token.averageBlockTime)}</span>
                      
                      <!-- Block time indicator -->
                      <span class="block-time-indicator" style={`--speed: ${Math.min(5, token.averageBlockTime / 3)}s`}></span>
                    </p>
                    
                    <!-- Block time rating -->
                    <span class="text-xs font-medium px-2 py-0.5 rounded {token.averageBlockTime < 15 ? 'bg-green-900/30 text-green-400' : token.averageBlockTime < 30 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-orange-900/30 text-orange-400'}">
                      {token.averageBlockTime < 15 ? 'Fast' : token.averageBlockTime < 30 ? 'Medium' : 'Slow'}
                    </span>
                  </div>
                </Panel>
              {/if}
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
  
  @keyframes float {
    0%, 100% { transform: translateY(0) translateX(0); }
    25% { transform: translateY(-20px) translateX(10px); }
    50% { transform: translateY(-10px) translateX(20px); }
    75% { transform: translateY(-30px) translateX(-10px); }
  }
  
  @keyframes pulse-block-time {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  
  .block-time-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #10b981;
    animation: pulse-block-time var(--speed, 3s) infinite;
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
  
  @keyframes progress-fill {
    0% { stroke-dashoffset: 188.5; }
    100% { stroke-dashoffset: var(--final-offset, 0); }
  }
  
  :global(.token-panel) {
    transition: transform 0.2s ease-out, border-color 0.2s ease-out;
  }
  
  :global(.token-panel:hover) {
    transform: translateY(-2px);
  }
</style>
