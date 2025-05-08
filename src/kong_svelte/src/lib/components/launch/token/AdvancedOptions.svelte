<script lang="ts">
  import type { ArchiveOptions } from "../../../../../declarations/token_backend/token_backend.did";
  import type { Principal } from '@dfinity/principal';
  import { ChevronDown, AlertTriangle } from 'lucide-svelte';

  // Basic parameters
  export let totalSupply: string = ""; // String to handle bigint
  export let blockTimeTargetSeconds: string = "60"; 
  export let halvingInterval: string = "210000";
  export let initialBlockReward: string = "5000000000";
  export let ownerPrincipal: string = "";

  export let archiveOptions: ArchiveOptions = {
    num_blocks_to_archive: 1000000n,
    max_transactions_per_response: [] as [] | [bigint],
    trigger_threshold: 2000n,
    more_controller_ids: [] as [] | [Principal[]],
    max_message_size_bytes: [] as [] | [bigint],
    cycles_for_archive_creation: [] as [] | [bigint],
    node_max_memory_size_bytes: [] as [] | [bigint],
    controller_id: null as any // Will be set by backend
  };

  let isExpanded = false;

  function validateArchiveOptions() {
    const errors = [];
    if (archiveOptions.num_blocks_to_archive <= 0n) {
      errors.push('Number of blocks to archive must be greater than 0');
    }
    if (archiveOptions.trigger_threshold <= 0n) {
      errors.push('Trigger threshold must be greater than 0');
    }
    return errors;
  }

  $: validationErrors = validateArchiveOptions();
</script>

<div class="space-y-4">
  <!-- Total Supply - The most fundamental token mining parameter -->
  <div class="p-4 border rounded-lg bg-kong-bg-light/30 border-kong-border/20">
    <label for="total-supply" class="block mb-2 text-sm font-medium text-kong-text-primary">
      Total Supply <span class="text-kong-accent-red">*</span>
    </label>
    
    <div class="flex">
      <input
        id="total-supply"
        type="text" 
        bind:value={totalSupply}
        class="w-full px-4 py-3 font-mono text-sm border rounded-lg bg-kong-bg-light border-kong-border/30 focus:ring-2 focus:ring-kong-primary/50"
        placeholder="e.g., 21000000"
        pattern="^[0-9]*$"
      />
    </div>
    
    <div class="flex justify-between mt-2 text-xs text-kong-text-secondary">
      <span class="flex items-center gap-1.5">
        {#if !totalSupply}
          <span class="w-2 h-2 rounded-full bg-kong-accent-red/80 animate-pulse"></span>
          Required
        {:else}
          <span class="w-2 h-2 rounded-full bg-kong-primary/80"></span>
          {totalSupply.length} digits
        {/if}
      </span>
      <span>Total maximum supply of tokens (in whole units)</span>
    </div>
  </div>

  <!-- Block Time, Halving, Rewards -->
  <div class="p-4 border rounded-lg bg-kong-bg-light/30 border-kong-border/20">
    <h3 class="mb-4 text-base font-medium text-kong-text-primary">Mining Parameters</h3>
    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Block Time -->
      <div>
        <label for="block-time" class="block mb-2 text-sm font-medium text-kong-text-secondary">
          Block Time (seconds)
        </label>
        <input 
          id="block-time"
          type="text" 
          bind:value={blockTimeTargetSeconds}
          class="w-full px-3 py-2 font-mono text-sm border rounded-lg bg-kong-bg-light border-kong-border/30 focus:ring-2 focus:ring-kong-primary/50" 
          placeholder="60"
        />
      </div>
      
      <!-- Halving Interval -->
      <div>
        <label for="halving-interval" class="block mb-2 text-sm font-medium text-kong-text-secondary">
          Halving Interval (blocks)
        </label>
        <input 
          id="halving-interval"
          type="text" 
          bind:value={halvingInterval}
          class="w-full px-3 py-2 font-mono text-sm border rounded-lg bg-kong-bg-light border-kong-border/30 focus:ring-2 focus:ring-kong-primary/50" 
          placeholder="210000" 
        />
      </div>
      
      <!-- Initial Block Reward -->
      <div class="sm:col-span-2">
        <label for="block-reward" class="block mb-2 text-sm font-medium text-kong-text-secondary">
          Initial Block Reward (base units)
        </label>
        <input 
          id="block-reward"
          type="text" 
          bind:value={initialBlockReward}
          class="w-full px-3 py-2 font-mono text-sm border rounded-lg bg-kong-bg-light border-kong-border/30 focus:ring-2 focus:ring-kong-primary/50" 
          placeholder="5000000000" 
        />
      </div>
      
      <!-- Owner Principal -->
      <div class="sm:col-span-2">
        <label for="owner-principal" class="block mb-2 text-sm font-medium text-kong-text-secondary">
          Owner Principal (optional)
        </label>
        <input 
          id="owner-principal"
          type="text" 
          bind:value={ownerPrincipal}
          class="w-full px-3 py-2 font-mono text-sm border rounded-lg bg-kong-bg-light border-kong-border/30 focus:ring-2 focus:ring-kong-primary/50" 
          placeholder="Leave blank to use caller principal" 
        />
        <p class="mt-1 text-xs text-kong-text-secondary/70">If left blank, the caller will be the owner.</p>
      </div>
    </div>
  </div>
  <button
    class="flex items-center justify-between w-full gap-4 p-4 text-left transition-colors rounded-lg bg-kong-bg-secondary/50 hover:bg-kong-bg-secondary"
    on:click={() => isExpanded = !isExpanded}
  >
    <div class="flex items-center gap-3">
      <AlertTriangle class="text-kong-warning" size={20} />
      <div>
        <h3 class="font-medium">Advanced Archive Options</h3>
        <p class="text-sm text-kong-text-primary/60">
          These settings control ledger archival behavior. The mining process is self-sufficient and does not require configuration.
        </p>
      </div>
    </div>
    <ChevronDown
      size={20}
      class="transition-transform {isExpanded ? 'rotate-180' : ''}"
    />
  </button>

  {#if isExpanded}
    <div class="p-4 space-y-4 border rounded-lg border-kong-border">
      <label class="flex items-center space-x-3">
        <input
          type="number"
          bind:value={archiveOptions.num_blocks_to_archive}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          min="1"
        />
        <span>Number of Blocks to Archive</span>
      </label>
      <label class="flex items-center space-x-3">
        <input
          type="number"
          bind:value={archiveOptions.max_transactions_per_response}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          min="1"
        />
        <span>Max Transactions per Response</span>
      </label>
      <label class="flex items-center space-x-3">
        <input
          type="number"
          bind:value={archiveOptions.trigger_threshold}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          min="1"
        />
        <span>Trigger Threshold</span>
      </label>
      <label class="flex items-center space-x-3">
        <input
          type="text"
          bind:value={archiveOptions.more_controller_ids}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          placeholder="Enter more controller IDs"
        />
      </label>
      <label class="flex items-center space-x-3">
        <input
          type="number"
          bind:value={archiveOptions.max_message_size_bytes}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          min="1"
        />
        <span>Max Message Size (bytes)</span>
      </label>
      <label class="flex items-center space-x-3">
        <input
          type="number"
          bind:value={archiveOptions.cycles_for_archive_creation}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          min="1"
        />
        <span>Cycles for Archive Creation</span>
      </label>
      <label class="flex items-center space-x-3">
        <input
          type="number"
          bind:value={archiveOptions.node_max_memory_size_bytes}
          class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:border-kong-primary"
          min="1"
        />
        <span>Node Max Memory Size (bytes)</span>
      </label>

      {#if validationErrors.length > 0}
        <div class="p-3 mt-4 rounded-lg bg-kong-error/10">
          <ul class="text-sm text-kong-error">
            {#each validationErrors as error}
              <li>{error}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</div> 
