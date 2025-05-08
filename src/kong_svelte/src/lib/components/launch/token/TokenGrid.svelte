<script lang="ts">
  import { SortAsc, SortDesc } from "lucide-svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import * as powBackendAPI from "$lib/api/powBackend";
  import TokenCard from "./TokenCard.svelte";
  import TokenInfoGrid from "./TokenInfoGrid.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  
  export let tokens = [];
  export let loading = false;
  export let searchQuery = "";
  
  // Enhanced token data with info from get_all_info
  let enhancedTokens = [];
  let filteredTokens = [];
  let loadingTokenInfo = true;
  
  // Sort functionality
  let sortField = "name";
  let sortDirection = "asc";

  // Generate a random gradient for tokens without logos
  function getRandomGradient() {
    const gradients = [
      "from-orange-600 to-red-600",
      "from-blue-600 to-indigo-600", 
      "from-green-600 to-emerald-600",
      "from-purple-600 to-pink-600",
      "from-yellow-600 to-amber-600",
      "from-red-600 to-pink-600"
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

  // Get token info from canister - using the powBackendAPI
  async function getTokenInfo(token) {
    try {
      let tokenInfo = {
        ...token,
        principal: token.canister_id,
        infoLoaded: true,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
      };
      
      try {
        // Try to use getAllTokenInfo first for comprehensive info
        try {
          const allInfo = await powBackendAPI.getAllTokenInfo(token.canister_id);
          
          // Construct the enhanced token object with safe property access
          tokenInfo = {
            ...tokenInfo,
            name: allInfo.name || token.name || "Unknown Token",
            ticker: allInfo.ticker || token.ticker || "???",
            total_supply: allInfo.total_supply || 0,
            ledger_id: allInfo.ledger_id ? [allInfo.ledger_id] : undefined,
            logo: allInfo.logo,
            decimals: allInfo.decimals || 8,
            transfer_fee: allInfo.transfer_fee || 0,
            social_links: allInfo.social_links,
            chain: allInfo.chain, // Add the chain field
            // Use pre-formatted values with fallbacks
            averageBlockTime: allInfo.average_block_time,
            formattedBlockTime: allInfo.average_block_time ?
              formatBlockTime(Number(allInfo.average_block_time)) : undefined,
            blockTimeRating: allInfo.block_time_rating,
            miningProgress: allInfo.mining_progress_percentage,
            formattedBlockReward: formatBlockReward(allInfo.current_block_reward, allInfo.decimals),
            current_block_height: allInfo.current_block_height || 0,
            current_block_reward: allInfo.current_block_reward || 0,
            circulating_supply: allInfo.circulating_supply || 0
          };
          
          // Process logo - support both string and array formats
          if (allInfo.logo && typeof allInfo.logo === 'string') {
            tokenInfo.logo = [allInfo.logo];
          } else if (allInfo.logo) {
            tokenInfo.logo = [allInfo.logo];
          }
          
        } catch (error) {
          // If getAllTokenInfo fails, try to get basic info
          console.log("getAllTokenInfo failed, using basic info", error);
          
          const basicInfo = await powBackendAPI.getTokenInfo(token.canister_id);
          
          tokenInfo = {
            ...tokenInfo,
            name: basicInfo.name || token.name || "Unknown Token",
            ticker: basicInfo.ticker || token.ticker || "???",
            total_supply: basicInfo.total_supply || 0,
            logo: basicInfo.logo,
            decimals: basicInfo.decimals || 8,
            transfer_fee: basicInfo.transfer_fee || 0,
            ledger_id: basicInfo.ledger_id ? [basicInfo.ledger_id] : undefined,
            chain: basicInfo.chain
          };
          
          // Process logo - support both string and array formats
          if (basicInfo.logo && typeof basicInfo.logo === 'string') {
            tokenInfo.logo = [basicInfo.logo];
          } else if (basicInfo.logo) {
            tokenInfo.logo = [basicInfo.logo];
          }
          
          // Try to get additional metrics separately
          try {
            const metrics = await powBackendAPI.getMetrics(token.canister_id);
            tokenInfo.circulating_supply = metrics.circulating_supply || 0;
            tokenInfo.current_block_height = metrics.current_block_height || 0;
            tokenInfo.miningProgress = metrics.mining_progress_percentage || 0;
          } catch (metricsError) {
            console.log("Failed to get metrics:", metricsError);
          }
          
          // Try to get average block time separately
          try {
            const blockTime = await powBackendAPI.getAverageBlockTime(token.canister_id, 10);
            tokenInfo.averageBlockTime = blockTime;
            tokenInfo.formattedBlockTime = formatBlockTime(blockTime);
          } catch (blockTimeError) {
            console.log("Failed to get block time:", blockTimeError);
          }
        }
        
        return tokenInfo;
      } catch (error) {
        console.error("Error fetching token info details:", error);
        return tokenInfo;
      }
    } catch (error) {
      console.error("Error in getTokenInfo:", error);
      // Return basic token with random visuals on error
      return {
        ...token,
        principal: token.canister_id,
        infoLoaded: false,
        randomGradient: token.randomGradient || getRandomGradient(),
        randomIcon: token.randomIcon || getRandomIcon(),
        randomAnimation: token.randomAnimation || getRandomAnimation(),
      };
    }
  }

  // Format block time
  function formatBlockTime(blockTimeSeconds) {
    if (blockTimeSeconds < 60) {
      return `${blockTimeSeconds.toFixed(1)}s`;
    } else {
      const minutes = Math.floor(blockTimeSeconds / 60);
      const seconds = Math.round(blockTimeSeconds % 60);
      return `${minutes}m ${seconds}s`;
    }
  }

  // Format block reward
  function formatBlockReward(reward, decimals = 8) {
    if (!reward) return "Unknown";
    
    try {
      const rewardNum = Number(reward) / Math.pow(10, decimals);
      return rewardNum.toLocaleString(undefined, { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    } catch (e) {
      return reward.toString();
    }
  }

  // Load token info for all tokens
  async function loadAllTokenInfo() {
    loadingTokenInfo = true;
    try {
      const promises = tokens.map(token => getTokenInfo(token));
      enhancedTokens = await Promise.all(promises);
      applyFiltersAndSort();
    } catch (error) {
      console.error("Error loading token info:", error);
    } finally {
      loadingTokenInfo = false;
    }
  }

  // Apply filters and sorting
  function applyFiltersAndSort() {
    // Filter by search query
    let filtered = enhancedTokens;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = enhancedTokens.filter(token => 
        (token.name && token.name.toLowerCase().includes(query)) ||
        (token.ticker && token.ticker.toLowerCase().includes(query)) ||
        (token.principal && token.principal.toString().toLowerCase().includes(query))
      );
    }
    
    // Sort tokens
    filtered.sort((a, b) => {
      let valueA, valueB;
      
      // Extract the values based on sort field
      switch (sortField) {
        case 'name':
          valueA = a.name || '';
          valueB = b.name || '';
          break;
        case 'ticker':
          valueA = a.ticker || '';
          valueB = b.ticker || '';
          break;
        case 'blockTime':
          valueA = a.averageBlockTime || Number.MAX_VALUE;
          valueB = b.averageBlockTime || Number.MAX_VALUE;
          break;
        case 'supply':
          valueA = Number(a.total_supply || 0);
          valueB = Number(b.total_supply || 0);
          break;
        default:
          valueA = a.name || '';
          valueB = b.name || '';
      }
      
      // Apply sort direction
      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
    
    filteredTokens = filtered;
  }

  // Handle sort change
  function handleSortChange(field) {
    if (sortField === field) {
      // Toggle direction if same field
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to ascending
      sortField = field;
      sortDirection = 'asc';
    }
    
    applyFiltersAndSort();
  }

  // Watch for search query changes
  $: if (enhancedTokens.length > 0 && searchQuery !== undefined) {
    applyFiltersAndSort();
  }

  // Load token info on mount
  onMount(() => {
    loadAllTokenInfo();
  });

  // Reload when tokens prop changes
  let prevTokensLen = 0;
  $: if (tokens && tokens.length !== prevTokensLen) {
    prevTokensLen = tokens.length;
    loadAllTokenInfo();
  }
</script>

<div class="space-y-4">
  <!-- Sort controls -->
  {#if !loading && !loadingTokenInfo && enhancedTokens.length > 0}
    <Panel variant="transparent" type="main" className="sort-panel bg-transparent">
      <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
        <button 
          class={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 ${sortField === 'name' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-kong-bg-secondary/30 text-kong-text-secondary'}`}
          on:click={() => handleSortChange('name')}
        >
          Name
          {#if sortField === 'name'}
            {#if sortDirection === 'asc'}
              <SortAsc size={12} />
            {:else}
              <SortDesc size={12} />
            {/if}
          {/if}
        </button>
        
        <button 
          class={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 ${sortField === 'ticker' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-kong-bg-secondary/30 text-kong-text-secondary'}`}
          on:click={() => handleSortChange('ticker')}
        >
          Ticker
          {#if sortField === 'ticker'}
            {#if sortDirection === 'asc'}
              <SortAsc size={12} />
            {:else}
              <SortDesc size={12} />
            {/if}
          {/if}
        </button>
        
        <button 
          class={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 ${sortField === 'blockTime' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-kong-bg-secondary/30 text-kong-text-secondary'}`}
          on:click={() => handleSortChange('blockTime')}
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
          class={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 ${sortField === 'supply' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-kong-bg-secondary/30 text-kong-text-secondary'}`}
          on:click={() => handleSortChange('supply')}
        >
          Supply
          {#if sortField === 'supply'}
            {#if sortDirection === 'asc'}
              <SortAsc size={12} />
            {:else}
              <SortDesc size={12} />
            {/if}
          {/if}
        </button>
      </div>
    </Panel>
  {/if}

  <!-- Loading state -->
  {#if loading || loadingTokenInfo}
    <div class="flex justify-center py-4 md:py-6 lg:py-8">
      <div class="animate-pulse-fast">
        <div class="h-10 w-40 bg-kong-bg-secondary/30 rounded-lg mb-4"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {#each Array(6) as _, i}
            <div class="h-44 bg-kong-bg-secondary/20 rounded-xl"></div>
          {/each}
        </div>
      </div>
    </div>
  {:else if filteredTokens.length === 0}
    <div class="flex flex-col items-center justify-center py-8 md:py-12 text-kong-text-secondary">
      <div class="text-5xl mb-3">🔍</div>
      <p class="text-lg font-semibold">No tokens found</p>
      <p class="text-sm">Try adjusting your search or filters</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 py-2">
      {#each filteredTokens as token (token.principal.toString())}
        <TokenCard {token} />
      {/each}
    </div>
  {/if}
</div>
