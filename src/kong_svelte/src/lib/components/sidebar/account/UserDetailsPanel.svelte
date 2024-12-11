<script lang="ts">
  import { fly } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";
  import {
    canisterId as kongBackendId,
    idlFactory as kongBackendIDL,
  } from "../../../../../../declarations/kong_backend";

  let loading = true;
  let error: string | null = null;
  let userData = null;

  onMount(async () => {
    try {
      const actor = await auth.getActor(kongBackendId, kongBackendIDL, {
        anon: false,
        requiresSigning: false
      });
      const res = await actor.get_user();
      if (!res.Ok) throw new Error('Failed to fetch user data');
      userData = res.Ok;
    } catch (err) {
      error = err.message;
      console.error('Error fetching user details:', err);
    } finally {
      loading = false;
    }
  });
</script>

<div class="tab-panel" transition:fly={{ y: 20, duration: 300 }}>
  <div class="detail-section">
    <h3>User Details</h3>
    <div class="user-details-container">
      {#if loading}
        <div class="loading-state">Loading user details...</div>
      {:else if error}
        <div class="error-state">Error: {error}</div>
      {:else if userData}
        <div class="info-grid">
          {#each Object.entries(userData) as [key, value]}
            <div class="info-item">
              <span class="label">{key}:</span>
              <span class="value">
                {#if typeof value === 'object'}
                  <pre>{JSON.stringify(value, null, 2)}</pre>
                {:else}
                  {value}
                {/if}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">No user data available</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .detail-section {
    padding-bottom: 1rem;
  }

  .detail-section h3 {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .user-details-container {
    width: 100%;
    max-width: 100%;
    margin-top: 0.5rem;
  }

  .info-grid {
    display: grid;
    gap: 0.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .value {
    color: rgba(255, 255, 255, 0.9);
    font-family: monospace;
    font-size: 0.875rem;
    word-break: break-all;
  }

  .value pre {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.75rem;
  }

  .loading-state,
  .error-state,
  .empty-state {
    padding: 1rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .error-state {
    color: #ff4444;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
