<script lang="ts">
  import type { ArchiveOptions } from "$declarations/token_backend/token_backend.did";
  import type { Principal } from '@dfinity/principal';
  import { ChevronDown, AlertTriangle } from 'lucide-svelte';

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
