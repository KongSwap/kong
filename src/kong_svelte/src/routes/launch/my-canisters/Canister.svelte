<script lang="ts">
  import { InstallService } from '$lib/services/canister/install_wasm';
  import type { CanisterMetadata } from '$lib/stores/canisters';
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { formatCycles } from '$lib/utils/cycles';
  import { formatDate } from '$lib/utils/dateUtils';
  import { truncateMiddle } from '$lib/utils/stringUtils';

  // Props
  export let canister: CanisterMetadata;
  export let canisterStatus: any = null;
  export let statusError: string | null = null;
  export let loadingStatus: boolean = false;
  export let isEditing: boolean = false;
  export let newName: string = '';
  export let newTags: string = '';
  export let hasUpgrade: boolean = false;
  export let icrcVersion: number = 0;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Get canister type color and icon
  function getCanisterTypeColor(type: string | undefined): string {
    switch (type) {
      case 'miner':
        return 'from-kong-accent-blue to-kong-accent-blue/70';
      case 'token_backend':
      case 'token':
        return 'from-kong-primary to-kong-primary/70';
      case 'ledger':
        return 'from-kong-accent-green to-kong-accent-green/70';
      default:
        return 'from-kong-text-secondary to-kong-text-secondary/50';
    }
  }
  
  function getCanisterTypeIcon(type: string | undefined): string {
    switch (type) {
      case 'miner':
        return 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636';
      case 'token_backend':
      case 'token':
        return 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125';
      case 'ledger':
        return 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z';
      default:
        return 'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0-4.5l-5.571 3-5.571-3';
    }
  }
  
  function getCanisterTypeName(type: string | undefined): string {
    switch (type) {
      case 'miner':
        return 'Miner';
      case 'token_backend':
      case 'token':
        return 'Token Backend';
      case 'ledger':
        return 'Token Ledger';
      default:
        return 'Canister';
    }
  }

  // Format helpers
  function formatMemorySize(bytes: bigint | undefined): string {
    if (!bytes || bytes === 0n) return 'No memory allocated';
    const mb = Number(bytes) / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }
  
  function formatStatus(status: string | undefined): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Action handlers
  function startEdit() {
    dispatch('edit', { canister });
  }

  function saveEdit() {
    dispatch('save');
  }

  function cancelEdit() {
    dispatch('cancel');
  }

  function hideCanister() {
    dispatch('hide', { id: canister.id });
  }

  function refreshStatus() {
    dispatch('refresh-status', { id: canister.id });
  }

  function openInstallModal() {
    dispatch('install-wasm', { id: canister.id });
  }

  function clearChunkStore() {
    InstallService.clearChunkStore(canister.id);
  }
  
  function copyCanisterId() {
    navigator.clipboard.writeText(canister.id);
  }
  
  function topUpCanister() {
    dispatch('top-up', { id: canister.id });
  }

  // Open Kong Agent chat interface
  function openKongAgent() {
    dispatch('open-kong-agent', { id: canister.id, wasmType: canister.wasmType });
  }

  // Generate canister URL for IC Dashboard and direct access
  function getCanisterUrl(canisterId: string): string {
    return `https://${canisterId}.raw.icp0.io`;
  }

  function getIcDashboardUrl(canisterId: string): string {
    return `https://dashboard.internetcomputer.org/canister/${canisterId}`;
  }
</script>

<div 
  class="overflow-hidden transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm hover:bg-kong-bg-secondary/50"
  transition:fade
>
  <!-- Type indicator bar at top -->
  <div class="h-1.5 w-full bg-gradient-to-r {getCanisterTypeColor(canister.wasmType)}"></div>
  
  <!-- Upgrade indicator (if available) -->
  {#if hasUpgrade && icrcVersion >= 2}
    <div class="w-full bg-yellow-500/20 text-yellow-400 py-1 px-2 text-xs text-center font-medium">
      <span class="flex items-center justify-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        WASM upgrade available
      </span>
    </div>
  {/if}
  
  <div class="p-4">
    <!-- Canister Name and Type -->
    <div class="flex items-start justify-between mb-3">
      <div>
        {#if isEditing}
          <input 
            type="text" 
            bind:value={newName} 
            placeholder="Canister name" 
            class="w-full px-2 py-1 mb-2 text-lg font-semibold text-kong-text-primary bg-kong-bg-light/10 border border-kong-border/20 rounded-md focus:outline-none focus:ring-kong-primary focus:border-kong-primary"
          />
          <input 
            type="text" 
            bind:value={newTags} 
            placeholder="Tags (comma separated)" 
            class="w-full px-2 py-1 text-sm text-kong-text-primary bg-kong-bg-light/10 border border-kong-border/20 rounded-md focus:outline-none focus:ring-kong-primary focus:border-kong-primary"
          />
          <div class="flex mt-2 space-x-2">
            <button 
              on:click={saveEdit} 
              class="px-2 py-1 text-xs text-white transition-colors rounded-md bg-kong-primary hover:bg-kong-primary/90"
            >
              Save
            </button>
            <button 
              on:click={cancelEdit} 
              class="px-2 py-1 text-xs transition-colors rounded-md border border-kong-border bg-transparent hover:bg-kong-bg-light/20 text-kong-text-secondary"
            >
              Cancel
            </button>
          </div>
        {:else}
          <h3 class="text-lg font-semibold text-kong-text-primary truncate max-w-[200px]">
            {canister.name || truncateMiddle(canister.id, 10)}
          </h3>
          <div class="flex items-center mt-1">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-kong-bg-light/10 text-kong-text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="{getCanisterTypeIcon(canister.wasmType)}" />
              </svg>
              {getCanisterTypeName(canister.wasmType)}
            </span>
          </div>
        {/if}
      </div>
      
      <!-- Action Buttons -->
      <div class="flex space-x-1">
        {#if hasUpgrade && icrcVersion >= 2}
          <button 
            on:click={() => dispatch('install-wasm', { id: canister.id })}
            class="p-1 text-yellow-400 rounded-full hover:text-yellow-300 hover:bg-kong-bg-light/10"
            title="Upgrade Available"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
            </svg>
          </button>
        {/if}
      
        <button 
          on:click={hideCanister} 
          class="p-1 text-kong-text-secondary rounded-full hover:text-kong-text-primary hover:bg-kong-bg-light/10"
          title="{canister.hidden ? 'Show Canister' : 'Hide Canister'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            {#if canister.hidden}
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            {:else}
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            {/if}
          </svg>
        </button>
        
        {#if !isEditing}
          <button 
            on:click={() => startEdit()} 
            class="p-1 text-kong-primary rounded-full hover:text-kong-primary/90 hover:bg-kong-bg-light/10"
            title="Edit Canister"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
    
    <!-- Canister ID with Copy Button -->
    <div class="mb-3 flex items-center">
      <p class="font-mono text-xs text-kong-text-secondary">
        {truncateMiddle(canister.id, 16)}
      </p>
      <button 
        on:click={copyCanisterId} 
        class="ml-2 p-1 text-kong-text-secondary rounded-full hover:text-kong-text-primary hover:bg-kong-bg-light/10"
        title="Copy Canister ID"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
        </svg>
      </button>
      <a 
        href={getCanisterUrl(canister.id)} 
        target="_blank" 
        rel="noopener noreferrer"
        class="ml-1 p-1 text-kong-text-secondary rounded-full hover:text-kong-text-primary hover:bg-kong-bg-light/10"
        title="Open Canister URL"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      </a>
      <a 
        href={getIcDashboardUrl(canister.id)} 
        target="_blank" 
        rel="noopener noreferrer"
        class="ml-1 p-1 text-kong-text-secondary rounded-full hover:text-kong-text-primary hover:bg-kong-bg-light/10"
        title="View on IC Dashboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      </a>
    </div>
    
    <!-- Cycles Balance -->
    <div class="mb-3">
      <p class="flex items-center text-sm text-kong-text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1 text-yellow-500">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-medium">{canisterStatus?.cycles ? formatCycles(canisterStatus.cycles) : 'Unknown'}</span>
        
        <!-- Refresh button -->
        <button 
          on:click={refreshStatus} 
          class="ml-2 p-1 text-kong-text-secondary rounded-full hover:text-kong-text-primary hover:bg-kong-bg-light/10"
          title="Refresh Status"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </p>
      
      <!-- Cycle usage stats for miners -->
      {#if canister.wasmType === 'miner' && canisterStatus?.cycleUsageStats}
        <div class="mt-1 text-xs text-kong-text-secondary">
          <p>Usage: {canisterStatus.cycleUsageStats.usage_rate_per_hour ? formatCycles(BigInt(Math.round(canisterStatus.cycleUsageStats.usage_rate_per_hour))) + '/hour' : 'Unknown'}</p>
          {#if canisterStatus.cycleUsageStats.estimated_remaining_time}
            <p>Est. remaining: {canisterStatus.cycleUsageStats.estimated_remaining_time}</p>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Creation Date -->
    <div class="mb-3">
      <p class="text-xs text-kong-text-secondary">
        Created: {formatDate(new Date(canister.createdAt))}
      </p>
    </div>
    
    <!-- Tags (if any) -->
    {#if canister.tags && canister.tags.length > 0 && !isEditing}
      <div class="mb-3 flex flex-wrap gap-1">
        {#each canister.tags as tag}
          <span class="px-2 py-0.5 text-xs bg-kong-bg-light/10 text-kong-text-secondary rounded-full">
            {tag}
          </span>
        {/each}
      </div>
    {/if}
    
    <!-- Top Up Button -->
    <button 
      on:click={() => topUpCanister()}
      class="w-full px-4 py-2 mt-2 text-sm font-medium text-white transition-colors duration-200 bg-kong-accent-blue rounded-md hover:bg-kong-accent-blue/90"
    >
      Top Up
    </button>
    
    <!-- Interact Button -->
    <button 
      on:click={() => openKongAgent()}
      class="w-full px-4 py-2 mt-2 mb-2 text-sm font-medium text-white transition-colors duration-200 bg-kong-primary rounded-md hover:bg-kong-primary/90"
    >
      Interact
    </button>
  </div>
</div>
