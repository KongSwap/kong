<script lang="ts">
  import { goto } from '$app/navigation';
  import { ExternalLink, AlertTriangle } from 'lucide-svelte';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import type { LeaderboardEntry } from '$lib/api/leaderboard';
  import { formatVolume } from '$lib/utils/numberFormatUtils';
  
  export let user: LeaderboardEntry;
  export let tradedTokens: Kong.Token[] | undefined = undefined;
  export let loadingTokens: boolean = false;
  export let tokenError: string | null = null;
  export let userDetails: { fee_level: number } | null = null;
  export let loadingUserDetails: boolean = false;
  export let rank: number = 0;
  export let compactLayout: boolean = false;
  export let className: string = "";
</script>

<div class="space-y-4 {className}">
  <!-- Header with principal ID and fee level -->
  <div class="flex justify-between items-start flex-wrap">
        
    <div class="text-xs font-medium text-kong-text-secondary mt-2 md:mt-0">
      <span class="inline-flex items-center bg-kong-bg-primary bg-opacity-50 px-3 py-1 rounded-full">
        <span class="mr-1">{compactLayout ? 'Volume:' : 'Trading Volume:'}</span>
        <span class="text-kong-success">{formatVolume(user.total_volume_usd.toString())}</span>
      </span>
      <span class="inline-flex items-center ml-2 bg-kong-bg-primary bg-opacity-50 px-3 py-1 rounded-full">
        <span class="mr-1">Swaps:</span>
        <span>{user.swap_count}</span>
      </span>
    </div>
    <div>
      <h4 class="text-sm font-medium text-kong-text-primary">Trader Profile</h4>
      <p class="text-xs text-kong-text-secondary mt-1 break-all">
        <button onclick={() => goto(`/wallets/${user.principal_id}`)} class="inline-flex items-center text-kong-primary hover:text-kong-primary-hover hover:underline">
          <span class="mr-1">{user.principal_id}</span>
          <ExternalLink class="w-3 h-3" />
        </button>
        {#if loadingUserDetails}
          <span class="ml-2 inline-flex items-center">
            <span class="animate-pulse w-2 h-2 bg-kong-primary rounded-full mr-1"></span>
            <span class="animate-pulse w-2 h-2 bg-kong-primary rounded-full mr-1"></span>
            <span class="animate-pulse w-2 h-2 bg-kong-primary rounded-full"></span>
          </span>
        {/if}
      </p>
    </div>
  </div>
  
  <!-- Tokens Section -->
  {#if user.traded_token_canister_ids?.length > 0}
    <div>
      <h5 class="text-xs font-medium text-kong-text-secondary mb-2">Most Traded Tokens</h5>
      
      {#if loadingTokens}
        <div class="flex items-center h-8 mb-2">
          <div class="animate-pulse flex space-x-2">
            <div class="w-2 h-2 bg-kong-primary rounded-full"></div>
            <div class="w-2 h-2 bg-kong-primary rounded-full"></div>
            <div class="w-2 h-2 bg-kong-primary rounded-full"></div>
          </div>
        </div>
      {:else if tokenError}
        <p class="text-xs text-kong-error mb-2 flex items-center">
          <AlertTriangle class="w-3 h-3 mr-1" />
          {tokenError}
        </p>
      {:else if tradedTokens?.length}
        <div class="p-2">
          <TokenImages 
            tokens={tradedTokens} 
            imageWrapperClass="bg-kong-bg-primary shadow-sm"
            size={rank === 1 ? 40 : 36} 
            overlap={true}
            containerClass=""
            countBgColor={rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-300" : rank === 3 ? "bg-amber-600" : "bg-kong-primary"}
            countTextColor={rank <= 3 ? "text-black" : ""}
            tooltip={{ text: "Tokens traded by this user", direction: "top" }}
          />
        </div>
      {:else}
        <p class="text-xs text-kong-text-secondary mb-2">No token data available</p>
      {/if}
    </div>
  {:else}
    <p class="text-xs text-kong-text-secondary">No token trading data available</p>
  {/if}
</div> 