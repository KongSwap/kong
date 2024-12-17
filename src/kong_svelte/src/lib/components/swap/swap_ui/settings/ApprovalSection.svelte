<script lang="ts">
  import TokenApprovalCard from './TokenApprovalCard.svelte';
  import { RefreshCw } from 'lucide-svelte';

  export let tokens: FE.Token[];
  export let approvedTokens: Set<string>;
  export let onApprove: (token: FE.Token) => Promise<void>;
  export let onRevoke: (token: FE.Token) => Promise<void>;
  export let onRefresh: () => Promise<void> = async () => {};

  let loading = false;

  async function handleRefresh() {
    if (loading) return;
    loading = true;
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh token approvals:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="settings-section">
  <div class="section-header">
    <div class="title-group">
      <h3 class="section-title">Token Approvals</h3>
      <div class="info-tooltip">
        <span class="tooltip-icon">ℹ️</span>
        <div class="tooltip-content">
          Approve tokens to enable quick swapping without additional confirmation steps. 
          You can revoke approvals at any time for better security.
        </div>
      </div>
    </div>
    <button 
      class="refresh-button" 
      on:click={handleRefresh}
      class:loading
      disabled={loading}
      aria-label="Refresh token approvals"
    >
      <RefreshCw size={16} />
    </button>
  </div>

  <div class="tokens-list" role="list">
    {#each tokens as token (token.address)}
      <TokenApprovalCard
        {token}
        isApproved={approvedTokens.has(token.address)}
        onApprove={() => onApprove(token)}
        onRevoke={() => onRevoke(token)}
      />
    {/each}
    {#if tokens.length === 0}
      <div class="empty-state">
        No tokens available for approval
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.875rem;
    color: #ffcd1f;
    margin: 0;
  }

  .refresh-button {
    background: none;
    border: none;
    color: white;
    opacity: 0.6;
    cursor: pointer;
    padding: 0.5rem;
    transition: all 0.2s ease;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-button:not(:disabled):hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .refresh-button:disabled {
    cursor: not-allowed;
  }

  .refresh-button.loading :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .tokens-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
    padding-right: 0.5rem;
    scrollbar-gutter: stable;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }

  .tokens-list::-webkit-scrollbar {
    width: 0.375rem;
  }

  .tokens-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
  }

  .tokens-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
  }

  .tokens-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .info-tooltip {
    position: relative;
    display: inline-block;
  }

  .tooltip-icon {
    cursor: help;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .tooltip-icon:hover {
    opacity: 1;
  }

  .tooltip-content {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.95);
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    width: 250px;
    text-align: center;
    z-index: 10;
    margin-bottom: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: opacity 0.2s, visibility 0.2s;
    pointer-events: none;
  }

  .info-tooltip:hover .tooltip-content {
    visibility: visible;
    opacity: 1;
  }

  @media (max-width: 640px) {
    .tokens-list {
      max-height: 250px;
    }
  }
</style>
