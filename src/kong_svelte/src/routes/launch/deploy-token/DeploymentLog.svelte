<script lang="ts">
  import { onMount } from "svelte";
  import { writable, type Writable } from "svelte/store";
  
  // Props
  export let logStore: Writable<string[]>;
  
  // Local state
  let logContainer: HTMLDivElement;
  
  // Function to add a log entry
  export function addLog(message: string) {
    logStore.update(logs => [...logs, message]);
    
    // Scroll to bottom on next tick
    setTimeout(() => {
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }, 0);
  }
  
  // Auto-scroll when logs update
  onMount(() => {
    const unsubscribe = logStore.subscribe(() => {
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    });
    
    return unsubscribe;
  });
</script>

<div class="log-container" bind:this={logContainer}>
  {#if $logStore.length === 0}
    <div class="empty-log">Deployment logs will appear here...</div>
  {:else}
    {#each $logStore as log}
      <div class="log-entry">
        {#if log.includes("Error:") || log.includes("❌")}
          <span class="text-red-500">{log}</span>
        {:else if log.includes("Warning:") || log.includes("⚠️")}
          <span class="text-yellow-400">{log}</span>
        {:else if log.includes("Success") || log.includes("🎉") || log.includes("✅")}
          <span class="text-green-400">{log}</span>
        {:else}
          <span>{log}</span>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .log-container {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 0.5rem;
    padding: 1rem;
    height: 300px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    margin-top: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .log-entry {
    margin-bottom: 0.5rem;
    word-break: break-word;
  }
  
  .empty-log {
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
    text-align: center;
    margin-top: 2rem;
  }
</style> 
