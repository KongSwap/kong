<script lang="ts">
  import { Principal } from '@dfinity/principal';
  import { InstallService } from '$lib/services/canister/install_wasm';
  import type { CanisterMetadata } from '$lib/stores/canisters';
  import { createEventDispatcher } from 'svelte';

  // Props
  export let canister: CanisterMetadata;
  export let canisterStatus: any = null;
  export let statusError: string | null = null;
  export let loadingStatus: boolean = false;
  export let isEditing: boolean = false;
  export let newName: string = '';
  export let newTags: string = '';
  // hasUpgrade indicates whether a newer version of the canister's WASM is available
  // When true, a red notification dot will be shown on the upgrade button
  export let hasUpgrade: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Format helpers
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
  
  function formatCycles(cycles: bigint): string {
    const num = Number(cycles);
    if (num >= 1e12) {
      return `${(num / 1e12).toFixed(2)}T`;
    } else if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    }
    return num.toString();
  }
  
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

  function removeCanister() {
    dispatch('remove', { id: canister.id });
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

<div class="overflow-hidden transition-all border rounded-lg shadow-lg backdrop-blur-sm bg-white/10 dark:bg-black/20 border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl">
  {#if isEditing}
    <div class="p-4">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input 
            type="text" 
            bind:value={newName} 
            class="block w-full mt-1 border-gray-300 rounded-md shadow-sm dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags (comma-separated)</label>
          <input 
            type="text" 
            bind:value={newTags} 
            class="block w-full mt-1 border-gray-300 rounded-md shadow-sm dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div class="flex justify-end space-x-2">
          <button 
            on:click={saveEdit} 
            class="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            Save
          </button>
          <button 
            on:click={cancelEdit} 
            class="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="p-4">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{canister.name || 'Unnamed Canister'}</h3>
          <div class="flex items-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">ID: {canister.id}</p>
            <button 
              on:click={copyCanisterId}
              class="p-1 ml-1 text-gray-500 transition-colors dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              title="Copy Canister ID"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Created: {formatDate(canister.createdAt)}</p>
        </div>
        <div class="flex space-x-1">
          <button 
            on:click={openKongAgent} 
            class="p-1 text-purple-500 transition-colors dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            title="Open Kong Agent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L4 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.733.99A1.002 1.002 0 0118 6v2a1 1 0 11-2 0v-.277l-.254.145a1 1 0 11-.992-1.736l.23-.132-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.58V12a1 1 0 11-2 0v-1.42l-1.246-.712a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.42l1.246.712a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.42V12a1 1 0 011-1zm-9.618 5.504a1 1 0 011.364-.372l.254.145V16a1 1 0 112 0v.277l.254-.145a1 1 0 11.992 1.736l-1.735.992a.995.995 0 01-1.022 0l-1.735-.992a1 1 0 01-.372-1.364z" clip-rule="evenodd" />
            </svg>
          </button>
          <button 
            on:click={startEdit} 
            class="p-1 text-gray-500 transition-colors dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button 
            on:click={removeCanister} 
            class="p-1 text-red-500 transition-colors hover:text-red-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {#if canister.tags && canister.tags.length > 0}
        <div class="flex flex-wrap gap-1 mb-4">
          {#each canister.tags as tag}
            <span class="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded-full dark:text-blue-300 dark:bg-blue-900/40">{tag}</span>
          {/each}
        </div>
      {/if}

      <!-- Status Section -->
      <div class="p-3 mb-4 rounded-lg bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Status</h4>
          <button
            on:click={refreshStatus}
            class="p-1 text-blue-600 transition-colors dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            disabled={loadingStatus}
          >
            {#if loadingStatus}
              <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            {/if}
          </button>
        </div>
        
        {#if statusError}
          <div class="p-2 text-sm text-yellow-700 bg-yellow-100 rounded dark:text-yellow-500 dark:bg-yellow-900/30">
            {statusError}
          </div>
          {#if canisterStatus}
            <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <a 
                href={getIcDashboardUrl(canister.id)}
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View on IC Dashboard
              </a>
            </div>
          {/if}
        {:else if canisterStatus}
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">Status</div>
              <div class="text-sm font-medium text-green-600 dark:text-green-400">
                {formatStatus(canisterStatus?.status)}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">Cycles</div>
              <div class="text-sm font-medium text-blue-600 dark:text-blue-400">
                {formatCycles(canisterStatus?.cycles || 0n)}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">Memory</div>
              <div class="text-sm font-medium text-purple-600 dark:text-purple-400">
                {formatMemorySize(canisterStatus?.memorySize)}
              </div>
            </div>
            <div class="p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">WASM</div>
              <div class="text-sm font-medium text-green-600 dark:text-green-400">
                {canisterStatus?.moduleHash ? 'Installed' : 'Not installed'}
              </div>
            </div>
            
            {#if canisterStatus?.controllers}
            <div class="col-span-2 p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">Controllers</div>
              <div class="text-sm font-medium text-gray-800 truncate dark:text-gray-200">
                {canisterStatus?.controllers?.length || 0} controller(s)
                {#if canisterStatus?.controllers?.length > 0}
                <div class="mt-1 text-xs">
                  {#each canisterStatus?.controllers?.slice(0, 2) || [] as controller}
                  <div class="truncate">{controller.toText()}</div>
                  {/each}
                  {#if (canisterStatus?.controllers?.length || 0) > 2}
                  <div>+ {(canisterStatus?.controllers?.length || 0) - 2} more</div>
                  {/if}
                </div>
                {/if}
              </div>
            </div>
            {/if}
            
            {#if canisterStatus?.idleCyclesBurnedPerDay}
            <div class="col-span-2 p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">Idle Cycles Burned/Day</div>
              <div class="text-sm font-medium text-orange-600 dark:text-orange-400">
                {formatCycles(canisterStatus?.idleCyclesBurnedPerDay || 0n)}
              </div>
            </div>
            {/if}
            
            {#if canisterStatus?.recentChanges && canisterStatus?.recentChanges.length > 0}
            <div class="col-span-2 p-2 rounded bg-gray-100/80 dark:bg-gray-700/50">
              <div class="text-xs text-gray-500 dark:text-gray-400">Recent Changes</div>
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                <div class="mt-1 text-xs">
                  {#each canisterStatus?.recentChanges?.slice(0, 2) || [] as change}
                  <div class="flex justify-between">
                    <span>
                      {change.details.creation ? 'Created' : 
                       change.details.code_deployment ? 'Code deployed' :
                       change.details.controllers_change ? 'Controllers changed' :
                       change.details.code_uninstall ? 'Code uninstalled' :
                       change.details.load_snapshot ? 'Snapshot loaded' : 'Changed'}
                    </span>
                    <span class="text-gray-500 dark:text-gray-400">
                      {new Date(Number(change.timestamp_nanos) / 1000000).toLocaleString()}
                    </span>
                  </div>
                  {/each}
                </div>
              </div>
            </div>
            {/if}
          </div>
        {:else}
          <div class="p-2 text-sm text-center text-gray-500 dark:text-gray-400">
            Loading status...
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <button
            on:click={openInstallModal}
            class="relative px-3 py-2 text-sm text-white transition-colors bg-blue-600 rounded dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            {#if canisterStatus?.moduleHash || canister.wasmType}
              Upgrade Canister
            {:else}
              Install WASM
            {/if}
            {#if hasUpgrade}
              <span class="absolute top-0 right-0 flex w-3 h-3 -mt-1 -mr-1">
                <span class="absolute inline-flex w-full h-full bg-red-400 rounded-full opacity-75 animate-ping"></span>
                <span class="relative inline-flex w-3 h-3 bg-red-500 rounded-full"></span>
              </span>
            {/if}
          </button>
          
          <button
            on:click={topUpCanister}
            class="px-3 py-2 text-sm text-white transition-colors rounded bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600"
          >
            Top Up
          </button>
        </div>
        
        <div class="grid grid-cols-2 gap-2">
          <a
            href={getIcDashboardUrl(canister.id)}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center px-3 py-2 text-sm text-white transition-colors bg-purple-600 rounded dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
            IC Dashboard
          </a>
          
          <a
            href={getCanisterUrl(canister.id)}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center px-3 py-2 text-sm text-white transition-colors bg-green-600 rounded dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
            </svg>
            View Canister
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>
