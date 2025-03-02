<script lang="ts">
  import { onMount } from "svelte";
  import type { Writable } from "svelte/store";
  
  // Props
  export let logStore: Writable<string[]>;
  
  // Local state
  let logs: string[] = [];
  let logContainer: HTMLDivElement;
  
  // Subscribe to log store
  onMount(() => {
    const unsubscribe = logStore.subscribe(value => {
      logs = value;
      // Scroll to bottom when logs update
      setTimeout(() => {
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }, 0);
    });
    
    return unsubscribe;
  });
  
  // Function to add a log entry
  export function addLog(message: string) {
    logStore.update(logs => [...logs, message]);
  }
</script>

<div class="deployment-log">
  <h3 class="log-title">Deployment Log</h3>
  
  <div class="log-container" bind:this={logContainer}>
    {#if logs.length === 0}
      <div class="empty-log">Waiting to start deployment...</div>
    {:else}
      {#each logs as log, i}
        <div class="log-entry">
          <span class="log-timestamp">[{new Date().toLocaleTimeString()}]</span>
          <span class="log-message">{log}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .deployment-log {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .log-title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }
  
  .log-container {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 0.25rem;
    padding: 1rem;
    max-height: 15rem;
    overflow-y: auto;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .empty-log {
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
    text-align: center;
    padding: 2rem 0;
  }
  
  .log-entry {
    margin-bottom: 0.5rem;
    line-height: 1.4;
    word-break: break-word;
  }
  
  .log-timestamp {
    color: rgba(255, 255, 255, 0.5);
    margin-right: 0.5rem;
  }
  
  .log-message {
    white-space: pre-wrap;
  }
</style> 
