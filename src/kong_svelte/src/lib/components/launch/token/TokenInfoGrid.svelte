<script lang="ts">
  import { Rocket, Copy, Clock, Target, Activity } from "lucide-svelte";
  import { toastStore } from "$lib/stores/toastStore";
  
  export let token;
  
  // Copy to clipboard
  function copyToClipboard(text, tokenName, fieldName) {
    navigator.clipboard.writeText(text);
    // Use the toastStore.add method which is available in the API
    toastStore.add({
      message: `Copied ${tokenName} ${fieldName} to clipboard`,
      type: 'success',
      duration: 3000
    });
  }
</script>

<!-- Combined Token Info Grid with Cyberpunk Aesthetic -->
<div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-kong-accent-blue/30">
  <!-- Mining ID Panel -->
  <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-kong-accent-blue/50 rounded transition-all duration-200 cursor-pointer shadow-inner-white">
    <button 
      class="py-2 px-2 w-full text-left"
      on:click|stopPropagation={(e) => {
        e.preventDefault();
        copyToClipboard(token.principal.toString(), token.name, "Mining ID");
      }}
      on:keydown|stopPropagation={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          copyToClipboard(token.principal.toString(), token.name, "Mining ID");
        }
      }}
    >
      <!-- Subtle shimmer effect -->
      <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-kong-accent-blue/30 to-transparent overflow-hidden">
        <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
          <span class="p-1 rounded-full bg-kong-accent-blue/10 flex items-center justify-center"><Rocket size={10} class="text-kong-accent-blue" /></span> 
          Mining ID
        </p>
        <span class="opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 text-kong-accent-blue flex-shrink-0">
          <Copy size={12} />
        </span>
      </div>
      <div class="mt-1">
        <p class="font-play text-xs text-ellipsis overflow-hidden truncate">
          {token.principal.toString().substring(0, 12)}...
        </p>
      </div>

      <!-- Tooltip with full ID -->
      <div class="absolute inset-x-0 -bottom-16 z-50 hidden group-hover/field:block transition-all duration-300">
        <div class="mx-2 p-2 bg-kong-bg-dark/90 backdrop-blur-md rounded shadow-lg border border-kong-accent-blue/30 text-xs font-play text-white/90">
          {token.principal.toString()}
        </div>
      </div>
    </button>
  </div>
  
  <!-- Ledger ID Panel -->
  <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-kong-accent-green/50 rounded transition-all duration-200 cursor-pointer shadow-inner-white">
    <button 
      class="py-2 px-2 w-full text-left" 
      on:click|stopPropagation={(e) => {
        e.preventDefault();
        if (token.ledger_id?.[0]) {
          copyToClipboard(token.ledger_id[0].toString(), token.name, "Ledger ID");
        }
      }}
      on:keydown|stopPropagation={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && token.ledger_id?.[0]) {
          e.preventDefault();
          copyToClipboard(token.ledger_id[0].toString(), token.name, "Ledger ID");
        }
      }}
    >
      <!-- Subtle shimmer effect -->
      <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-kong-accent-green/30 to-transparent overflow-hidden">
        <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
          <span class="p-1 rounded-full bg-kong-accent-green/10 flex items-center justify-center"><Rocket size={10} class="text-kong-accent-green" /></span>
          Ledger ID
        </p>
        {#if token.ledger_id?.[0]}
          <span class="opacity-0 group-hover/field:opacity-100 transition-opacity duration-200 text-kong-accent-green flex-shrink-0">
            <Copy size={12} />
          </span>
        {/if}
      </div>
      <div class="mt-1">
        {#if token.ledger_id?.[0]}
          <p class="font-play text-xs text-ellipsis overflow-hidden truncate">
            {token.ledger_id[0].toString().substring(0, 12)}...
          </p>
          
          <!-- Tooltip with full ID -->
          <div class="absolute inset-x-0 -bottom-16 z-50 hidden group-hover/field:block transition-all duration-300">
            <div class="mx-2 p-2 bg-kong-bg-dark/90 backdrop-blur-md rounded shadow-lg border border-kong-accent-green/30 text-xs font-play text-white/90">
              {token.ledger_id[0].toString()}
            </div>
          </div>
        {:else}
          <p class="font-play italic text-xs text-white/50">
            Not started
          </p>
        {/if}
      </div>
    </button>
  </div>
  
  <!-- Block Time Panel -->
  {#if token.formattedBlockTime}
    <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-kong-accent-yellow/50 rounded transition-all duration-200 shadow-inner-white">
      <div class="py-2 px-2">
        <!-- Subtle shimmer effect -->
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-kong-accent-yellow/30 to-transparent overflow-hidden">
          <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
            <span class="p-1 rounded-full bg-kong-accent-yellow/10 flex items-center justify-center"><Clock size={10} class="text-kong-accent-yellow" /></span>
            Block Time
          </p>
        </div>
        <p class="mt-1 font-play text-sm text-white/90 truncate">
          {token.formattedBlockTime}
        </p>
      </div>
    </div>
  {/if}
  
  <!-- Block Reward Panel -->
  {#if token.formattedBlockReward}
    <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-orange-500/50 rounded transition-all duration-200 shadow-inner-white">
      <div class="py-2 px-2">
        <!-- Subtle shimmer effect -->
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent overflow-hidden">
          <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
            <span class="p-1 rounded-full bg-orange-500/10 flex items-center justify-center"><Target size={10} class="text-orange-500" /></span>
            Block Reward
          </p>
        </div>
        <p class="mt-1 font-play text-sm text-white/90 truncate">
          {token.formattedBlockReward}
        </p>
      </div>
    </div>
  {:else if token.current_block_reward}
    <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-orange-500/50 rounded transition-all duration-200 shadow-inner-white">
      <div class="py-2 px-2">
        <!-- Subtle shimmer effect -->
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent overflow-hidden">
          <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
            <span class="p-1 rounded-full bg-orange-500/10 flex items-center justify-center"><Target size={10} class="text-orange-500" /></span>
            Block Reward
          </p>
        </div>
        <p class="mt-1 font-play text-sm text-white/90 truncate">
          {token.current_block_reward.toString()}
        </p>
      </div>
    </div>
  {:else}
    <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-orange-500/50 rounded transition-all duration-200 shadow-inner-white">
      <div class="py-2 px-2">
        <!-- Subtle shimmer effect -->
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent overflow-hidden">
          <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
            <span class="p-1 rounded-full bg-orange-500/10 flex items-center justify-center"><Target size={10} class="text-orange-500" /></span>
            Block Reward
          </p>
        </div>
        <p class="mt-1 font-play text-sm text-white/90 truncate">
          Unknown
        </p>
      </div>
    </div>
  {/if}

  <!-- Current Block Height (if available) -->
  {#if token.current_block_height}
    <div class="group/field relative overflow-hidden bg-kong-bg-dark/30 backdrop-blur-sm border border-kong-bg-secondary/20 hover:border-kong-accent-purple/50 rounded transition-all duration-200 shadow-inner-white">
      <div class="py-2 px-2">
        <!-- Subtle shimmer effect -->
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-kong-accent-purple/30 to-transparent overflow-hidden">
          <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide font-bold text-white/70 flex items-center gap-1.5 truncate">
            <span class="p-1 rounded-full bg-kong-accent-purple/10 flex items-center justify-center"><Activity size={10} class="text-kong-accent-purple" /></span>
            Block Height
          </p>
        </div>
        <p class="mt-1 font-play text-sm text-white/90 truncate">
          {token.current_block_height.toLocaleString()}
        </p>
      </div>
    </div>
  {/if}
</div>
