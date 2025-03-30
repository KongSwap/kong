<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight, Rocket, Copy, Clock, Target, Activity, Search, SortAsc, SortDesc, Plus } from "lucide-svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { idlFactory as tokenIdlFactory } from "../../../../../../src/declarations/token_backend/token_backend.did.js";
  import { toastStore } from "$lib/stores/toastStore";

  export let tokens = [];
  export let loading = false;

  // Enhanced token data with info from get_all_info
  let enhancedTokens = [];
  let filteredTokens = [];
  let loadingTokenInfo = true;
  
  // Search and sort functionality
  let searchQuery = "";
  let sortField = "blockTime";
  let sortDirection = "asc";

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

  // Get token info from canister - using the new get_all_info function
  async function getTokenInfo(token) {
    try {
      // Create actor - anonymous for public data
      const actor = auth.getActor(token.principal, tokenIdlFactory, { anon: true });
      
      let tokenInfo = {
        ...token,
        infoLoaded: true,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
      };
      
      // Try to use get_all_info first, if available
      try {
        if (typeof actor.get_all_info === 'function') {
          const allInfoResult = await actor.get_all_info();
          
          if (allInfoResult.Err) {
            console.error("Error fetching token info:", allInfoResult.Err);
            return getFallbackTokenInfo(token);
          }
          
          // Extract the comprehensive token info
          const allInfo = allInfoResult.Ok;
          
          // Add error handling for missing fields
          if (!allInfo) {
            console.error("Invalid response from get_all_info");
            return getFallbackTokenInfo(token);
          }
          
          // Construct the enhanced token object with safe property access
          tokenInfo = {
            ...tokenInfo,
            name: allInfo.name || token.name || "Unknown Token",
            ticker: allInfo.ticker || token.ticker || "???",
            total_supply: allInfo.total_supply || 0,
            ledger_id: allInfo.ledger_id,
            logo: allInfo.logo,
            decimals: allInfo.decimals || 8,
            transfer_fee: allInfo.transfer_fee || 0,
            social_links: allInfo.social_links,
            // Use pre-formatted values from get_all_info with fallbacks
            averageBlockTime: allInfo.average_block_time,
            formattedBlockTime: allInfo.formatted_block_time,
            blockTimeRating: allInfo.block_time_rating,
            miningProgress: allInfo.mining_progress_percentage,
            formattedBlockReward: allInfo.formatted_block_reward,
            current_block_height: allInfo.current_block_height || 0,
            current_block_reward: allInfo.current_block_reward || 0
          };
          
          // Process logo - support both string and array formats
          if (allInfo.logo && typeof allInfo.logo === 'string') {
            tokenInfo.logo = [allInfo.logo];
          } else if (allInfo.logo) {
            tokenInfo.logo = [allInfo.logo];
          }
          
          return tokenInfo;
        } else {
          // If get_all_info is not available, use individual method calls
          return await getFallbackTokenInfo(token, actor);
        }
      } catch (error) {
        console.error("Error with get_all_info, falling back to individual calls:", error);
        return await getFallbackTokenInfo(token, actor);
      }
    } catch (error) {
      console.error("Error fetching token info:", error);
      // Return basic token with random visuals on error
      return getFallbackTokenInfo(token);
    }
  }

  // Fallback method to get token info using individual calls
  async function getFallbackTokenInfo(token, actor = null) {
    try {
      // If actor wasn't passed, create it
      if (!actor) {
        actor = auth.getActor(token.principal, tokenIdlFactory, { anon: true });
      }
      
      // Basic token info with random visuals
      let tokenInfo = {
        ...token,
        infoLoaded: true,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
      };
      
      // Get token info using the get_info method
      try {
        const infoResult = await actor.get_info();
        
        if (!infoResult.Err) {
          const info = infoResult.Ok;
          
          // Map the fields from the token info to our expected format
          tokenInfo = {
            ...tokenInfo,
            name: info.name,
            ticker: info.ticker,
            decimals: info.decimals,
            total_supply: info.total_supply,
            logo: info.logo ? [info.logo] : undefined,
            ledger_id: info.ledger_id ? [info.ledger_id] : undefined,
            current_block_height: info.current_block_height,
            current_block_reward: info.current_block_reward
          };
          
          // Get average block time if available
          if (info.average_block_time) {
            const blockTimeSeconds = Number(info.average_block_time);
            tokenInfo.averageBlockTime = blockTimeSeconds;
            
            // Format block time
            if (blockTimeSeconds < 60) {
              tokenInfo.formattedBlockTime = `${blockTimeSeconds.toFixed(1)}s`;
            } else {
              const minutes = Math.floor(blockTimeSeconds / 60);
              const seconds = Math.round(blockTimeSeconds % 60);
              tokenInfo.formattedBlockTime = `${minutes}m ${seconds}s`;
            }
          }
          
          // Get social links if available
          if (info.social_links) {
            tokenInfo.social_links = info.social_links;
          }
        }
      } catch (e) {
        console.warn("Could not get token info:", e);
      }
      
      // Try to get mining info
      try {
        const miningInfoResult = await actor.get_mining_info();
        if (miningInfoResult) {
          tokenInfo.miningInfo = miningInfoResult;
          
          // Calculate mining progress
          if (tokenInfo.total_supply && tokenInfo.current_block_height && tokenInfo.current_block_reward) {
            const minedAmount = tokenInfo.current_block_height * tokenInfo.current_block_reward;
            const progressPercentage = (minedAmount / tokenInfo.total_supply) * 100;
            tokenInfo.miningProgress = progressPercentage.toFixed(2);
          }
          
          // Format block reward
          if (tokenInfo.current_block_reward) {
            tokenInfo.formattedBlockReward = formatBalance(tokenInfo.current_block_reward, tokenInfo.decimals || 8);
          }
        }
      } catch (e) {
        console.warn("Could not get mining info:", e);
      }
      
      // Try to get block time using the correct method signature
      try {
        const blockTimeResult = await actor.get_average_block_time([]);
        if (blockTimeResult.Ok) {
          const blockTimeSeconds = Number(blockTimeResult.Ok);
          tokenInfo.averageBlockTime = blockTimeSeconds;
          
          // Format block time
          if (blockTimeSeconds < 60) {
            tokenInfo.formattedBlockTime = `${blockTimeSeconds.toFixed(1)}s`;
          } else {
            const minutes = Math.floor(blockTimeSeconds / 60);
            const seconds = Math.round(blockTimeSeconds % 60);
            tokenInfo.formattedBlockTime = `${minutes}m ${seconds}s`;
          }
        }
      } catch (e) {
        console.warn("Could not get block time:", e);
      }
      
      // Try to get metrics for circulation info
      try {
        const metricsResult = await actor.get_metrics();
        if (metricsResult.Ok) {
          const metrics = metricsResult.Ok;
          if (metrics.total_supply && metrics.circulating_supply) {
            const progressPercentage = (metrics.circulating_supply / metrics.total_supply) * 100;
            tokenInfo.miningProgress = progressPercentage.toFixed(2);
          }
        }
      } catch (e) {
        console.warn("Could not get metrics:", e);
      }
      
      return tokenInfo;
    } catch (error) {
      console.error("Error in fallback token info:", error);
      // Return minimal token info on complete failure
      return {
        ...token,
        infoLoaded: false,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
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
      applySearchAndSort(); // Apply initial filtering and sorting
    } catch (error) {
      console.error("Error loading token info:", error);
      enhancedTokens = tokens.map(token => ({
        ...token,
        infoLoaded: false,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
        name: token.name || "Unknown Token",
        ticker: token.ticker || "???"
      }));
      applySearchAndSort(); // Apply initial filtering and sorting
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
  async function copyToClipboard(text, tokenName, idType = "ID") {
    try {
      await navigator.clipboard.writeText(text);
      toastStore.success(`Copied ${idType} for ${tokenName}`);
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

  // Search and sort functionality
  function applySearchAndSort() {
    // First apply search filter
    let results = enhancedTokens;
    
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      results = enhancedTokens.filter(token => {
        // Convert both name and ticker to lowercase for case-insensitive search
        const tokenName = (token.name || "").toLowerCase();
        const tokenTicker = (token.ticker || "").toLowerCase();
        
        return (
          tokenName.includes(query) ||
          tokenTicker.includes(query)
        );
      });
    }
    
    // Then apply sorting
    results.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortField) {
        case "blockTime":
          valueA = a.averageBlockTime || Infinity;
          valueB = b.averageBlockTime || Infinity;
          break;
        case "miningProgress":
          valueA = a.miningProgress ? parseFloat(a.miningProgress) : 0;
          valueB = b.miningProgress ? parseFloat(b.miningProgress) : 0;
          break;
        default:
          valueA = a.averageBlockTime || Infinity;
          valueB = b.averageBlockTime || Infinity;
      }
      
      // Handle numeric comparison
      return sortDirection === 'asc' 
        ? valueA - valueB 
        : valueB - valueA;
    });
    
    filteredTokens = results;
  }

  function toggleSort(field) {
    if (sortField === field) {
      // Toggle direction if same field
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to ascending
      sortField = field;
      sortDirection = 'asc';
    }
    applySearchAndSort();
  }

  // Handle launch token button click
  function handleLaunchToken() {
    goto('/launch/create-token');
  }

  // Modify reactive statement to prevent unnecessary reloads
  let prevTokensLength = 0;
  $: if (tokens && tokens.length > 0 && tokens.length !== prevTokensLength) {
    prevTokensLength = tokens.length;
    loadAllTokenInfo();
  }

  // Add this reactive statement to make search reactive
  $: if (searchQuery !== undefined) {
    // Only apply if tokens are loaded
    if (enhancedTokens.length > 0) {
      applySearchAndSort();
    }
  }

  // Keep the existing reactive statements
  $: if (enhancedTokens.length > 0) {
    applySearchAndSort();
  }

  onMount(() => {
  });
</script>

<div class="space-y-3 py-2">
  <!-- Search and sort controls -->
  {#if !loading && !loadingTokenInfo && enhancedTokens.length > 0}
    <Panel variant="transparent" type="main" className="search-panel bg-transparent">
      <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div class="relative flex-grow">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} class="text-orange-400/70" />
          </div>
          <input 
            type="text" 
            bind:value={searchQuery}
            placeholder="Search by name or ticker..." 
            class="w-full pl-10 pr-4 py-2.5 bg-transparent backdrop-blur-sm rounded-lg border border-orange-500/20 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 text-sm"
          />
        </div>
        
        <!-- Sort controls -->
        <div class="flex gap-2 flex-wrap">
          <button 
            class={`px-3 py-1.5 text-xs rounded-lg border transition-colors duration-200 flex items-center gap-1 ${sortField === 'blockTime' ? 'bg-orange-900/30 border-orange-500/30 text-orange-400' : 'bg-kong-background-secondary/80 backdrop-blur-sm border-kong-background-tertiary text-kong-text-primary/70'}`}
            on:click={() => toggleSort('blockTime')}
          >
            Block Time
            {#if sortField === 'blockTime'}
              {#if sortDirection === 'asc'}
                <SortAsc size={12} />
              {:else}
                <SortDesc size={12} />
              {/if}
            {/if}
          </button>
          
          <button 
            class={`px-3 py-1.5 text-xs rounded-lg border transition-colors duration-200 flex items-center gap-1 ${sortField === 'miningProgress' ? 'bg-orange-900/30 border-orange-500/30 text-orange-400' : 'bg-kong-background-secondary/80 backdrop-blur-sm border-kong-background-tertiary text-kong-text-primary/70'}`}
            on:click={() => toggleSort('miningProgress')}
          >
            Mining Progress
            {#if sortField === 'miningProgress'}
              {#if sortDirection === 'asc'}
                <SortAsc size={12} />
              {:else}
                <SortDesc size={12} />
              {/if}
            {/if}
          </button>
          
          <!-- Launch Token Button -->
          <button 
            class="px-3 py-1.5 text-xs rounded-lg border transition-colors duration-200 flex items-center gap-1 bg-orange-600 hover:bg-orange-700 border-orange-500/30 text-white"
            on:click={handleLaunchToken}
          >
            <Plus size={12} />
            LAUNCH TOKEN
          </button>
        </div>
      </div>
      
      <!-- Search results count -->
      {#if searchQuery.trim() !== ""}
        <div class="mt-2 text-xs text-orange-400/70">
          Found {filteredTokens.length} {filteredTokens.length === 1 ? 'token' : 'tokens'} matching "{searchQuery}"
        </div>
      {/if}
    </Panel>
  {/if}

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
  {:else if filteredTokens.length === 0}
    <Panel variant="transparent" type="main">
      <div class="py-2 text-center text-kong-text-primary/60">
        No tokens match your search
      </div>
    </Panel>
  {:else}
    {#each filteredTokens as token}
      <div class="transform-gpu">
        <Panel 
          variant="transparent" 
          type="main" 
          className="token-panel hover:border-orange-500/30 transition-all duration-200"
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
            <div class="relative z-10 p-3">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  {#if token.logo && ((Array.isArray(token.logo) && token.logo.length > 0 && token.logo[0]) || typeof token.logo === 'string')}
                    <div class="relative">
                      <img
                        src={Array.isArray(token.logo) ? token.logo[0] : token.logo}
                        alt={token.name}
                        class="w-12 h-12 rounded-full border-2 border-orange-500/30 shadow-glow object-cover"
                        on:error={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none'; 
                          const sibling = target.nextElementSibling as HTMLElement;
                          if (sibling) sibling.style.display = 'flex';
                        }}
                      />
                      <!-- Mining progress indicator around logo -->
                      {#if token.miningProgress}
                        <svg class="absolute inset-0 w-12 h-12 -rotate-90">
                          <circle 
                            cx="24" 
                            cy="24" 
                            r="22" 
                            fill="none" 
                            stroke="rgba(247, 147, 26, 0.2)" 
                            stroke-width="2"
                          />
                          <circle 
                            cx="24" 
                            cy="24" 
                            r="22" 
                            fill="none" 
                            stroke="#f7931a" 
                            stroke-width="2"
                            stroke-dasharray="138.2"
                            stroke-dashoffset={138.2 - (138.2 * parseFloat(token.miningProgress) / 100)}
                            class="transition-all duration-1000 ease-out"
                          />
                        </svg>
                      {/if}
                      <div class={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gradient-to-r ${token.randomAnimation}`}>
                        <img src="tokens/ICP.svg" class="w-3 h-3 object-contain" alt="ICP Chain" />
                      </div>
                      <!-- Fallback if image fails to load -->
                      <div class={`hidden relative items-center justify-center w-12 h-12 text-2xl font-bold rounded-full bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-glow`}>
                        {token.ticker[0]}
                        <div class={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-white text-xs ${token.randomAnimation}`} style={`color: #f7931a;`}>
                          <span class="text-xs font-bold">{token.ticker[0]}</span>
                        </div>
                      </div>
                    </div>
                  {:else}
                    <div class={`relative flex items-center justify-center w-12 h-12 text-2xl font-bold rounded-full bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-glow`}>
                      {token.ticker[0]}
                      <div class={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-white ${token.randomAnimation}`}>
                        <img src="tokens/ICP.svg" class="w-3 h-3 object-contain" alt="ICP Chain" />
                      </div>
                    </div>
                  {/if}
                  <div>
                    <h3 class="text-base font-extrabold flex items-center gap-2">
                      {#if !token.infoLoaded && loadingTokenInfo}
                        <span class="animate-pulse">Loading token...</span>
                      {:else}
                        {token.name}
                      {/if}
                      {#if token.formattedBlockTime}
                        <span class="text-xs font-normal px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400">
                          <span class="flex items-center gap-1">
                            <Clock size={10} /> {token.formattedBlockTime}
                          </span>
                        </span>
                      {/if}
                    </h3>
                    <p class="text-xs font-bold text-white/80 flex items-center gap-1">
                      ${token.ticker}
                      
                      <!-- Mining progress percentage in header -->
                      {#if token.miningProgress}
                        <span class="ml-2 px-1.5 py-0.5 text-xs rounded bg-orange-900/30 text-orange-400 flex items-center gap-1">
                          <Target size={10} /> {token.miningProgress} mined
                        </span>
                      {/if}
                    </p>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                  <div class="text-right">
                    <p class="text-xs text-white/70">Total Supply</p>
                    <p class="font-bold text-xs flex items-center gap-1">
                      {formatBalance(token.total_supply, token.decimals)} 
                      <span class="text-white/90">{token.ticker}</span>
                    </p>
                  </div>
                  <div class="bg-orange-900/20 p-1 rounded-full group-hover:bg-orange-800/30 transition-colors duration-300">
                    <ArrowRight size={14} class="text-orange-400" />
                  </div>
                </div>
              </div>
              
              {#if token.infoLoaded}
                <!-- Combined Token Info section - 1x4 grid instead of two 2x2 grids -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-orange-900/30">
                  <!-- Mining ID Panel -->
                  <Panel variant="transparent" type="secondary" className="group/field relative bg-black/10 hover:bg-black/20 transition-colors cursor-pointer" unpadded={false}>
                    <div class="py-1" 
                      on:click|stopPropagation={(e) => {
                        e.preventDefault();
                        copyToClipboard(token.principal.toString(), token.name, "Mining ID");
                      }}>
                      <p class="text-xs text-white/70 flex items-center gap-1 mb-0.5">
                        <Rocket size={10} class="text-orange-400" /> Mining ID
                      </p>
                      <div class="flex items-center gap-1">
                        <p class="font-bold text-xs text-ellipsis overflow-hidden break-all pr-1">
                          {token.principal.toString()}
                        </p>
                        <span class="opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 text-orange-400 flex-shrink-0">
                          <Copy size={10} />
                        </span>
                      </div>
                    </div>
                  </Panel>
                  
                  <!-- Ledger ID Panel -->
                  <Panel variant="transparent" type="secondary" className="group/field relative bg-black/10 hover:bg-black/20 transition-colors cursor-pointer" unpadded={false}>
                    <div class="py-1" 
                      on:click|stopPropagation={(e) => {
                        e.preventDefault();
                        if (token.ledger_id?.[0]) {
                          copyToClipboard(token.ledger_id[0].toString(), token.name, "Ledger ID");
                        }
                      }}>
                      <p class="text-xs text-white/70 flex items-center gap-1 mb-0.5">
                        <Rocket size={10} class="text-orange-400" /> Ledger ID
                      </p>
                      <div class="flex items-center gap-1">
                        {#if token.ledger_id?.[0]}
                          <p class="font-bold text-xs text-ellipsis overflow-hidden break-all pr-1">
                            {token.ledger_id[0].toString()}
                          </p>
                          <span class="opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 text-orange-400 flex-shrink-0">
                            <Copy size={10} />
                          </span>
                        {:else}
                          <p class="font-bold text-white/60 italic text-xs">
                            Not started
                          </p>
                        {/if}
                      </div>
                    </div>
                  </Panel>
                  
                  <!-- Block Time Panel -->
                  {#if token.formattedBlockTime}
                    <Panel variant="transparent" type="secondary" className="relative overflow-hidden bg-black/10" unpadded={false}>
                      <div class="py-1">
                        <p class="text-xs text-white/70 flex items-center gap-1 mb-0.5">
                          <Activity size={10} class="text-orange-400" /> Block Time
                        </p>
                        <div class="flex items-center gap-1">
                          <span class="block-time-indicator mr-1" title="Live Block Time" style={`--speed: ${Math.min(5, token.averageBlockTime / 3)}s`}></span>
                          <p class="font-bold text-xs">
                            {token.formattedBlockTime}
                          </p>
                        </div>
                      </div>
                    </Panel>
                  {:else}
                    <Panel variant="transparent" type="secondary" className="relative overflow-hidden bg-black/10" unpadded={false}>
                      <div class="py-1">
                        <p class="text-xs text-white/70 flex items-center gap-1 mb-0.5">
                          <Activity size={10} class="text-orange-400" /> Block Time
                        </p>
                        <p class="font-bold text-white/60 italic text-xs">
                          Unknown
                        </p>
                      </div>
                    </Panel>
                  {/if}
                  
                  <!-- Block Reward Panel -->
                  <Panel variant="transparent" type="secondary" className="relative overflow-hidden bg-black/10" unpadded={false}>
                    <div class="py-1">
                      <p class="text-xs text-white/70 flex items-center gap-1 mb-0.5">
                        <Rocket size={10} class="text-orange-400" /> Reward
                      </p>
                      <p class="font-bold text-xs">
                        {token.formattedBlockReward || '0'}
                      </p>
                    </div>
                  </Panel>
                </div>
              {/if}
            </div>
          </button>
        </Panel>
      </div>
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
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }
  
  .block-time-indicator {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #f7931a;
    animation: pulse-block-time var(--speed, 3s) infinite;
    opacity: 0.7;
    margin-right: 4px;
    vertical-align: baseline;
    position: relative;
    top: -1px;
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
    will-change: transform;
  }
  
  :global(.token-panel:hover) {
    transform: translateY(-2px);
    z-index: 1;
  }
  
  :global(.search-panel) {
    backdrop-filter: blur(5px);
    position: sticky;
    top: 0;
    z-index: 10;
  }
</style>