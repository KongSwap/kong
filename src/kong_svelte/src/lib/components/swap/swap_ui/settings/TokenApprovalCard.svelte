<script lang="ts">
	import { getTokenLogo } from '$lib/services/tokens/tokenLogos';
  import Button from '$lib/components/common/Button.svelte';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { derived } from 'svelte/store';

  export let isApproved: boolean;
  export let tokenId: string;
  export let onApprove: () => Promise<void>;
  export let onRevoke: () => Promise<void>;

  let loading = false;

  const token = derived(tokenStore, $tokenStore => {
    return $tokenStore.tokens.find(t => t.canister_id === tokenId);
  });

  async function handleAction(action: 'approve' | 'revoke') {
    if (loading) return;
    
    loading = true;
    try {
      await (action === 'approve' ? onApprove() : onRevoke());
    } catch (error) {
      console.error(`Failed to ${action} token:`, error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="token-card" class:approved={isApproved}>
  <div class="token-info">
    <div class="token-logo-wrapper">
      {#if $token}
        <img 
          src={await getTokenLogo($token.canister_id)} 
          alt={$token.symbol} 
          class="token-logo"
          loading="lazy"
        />
      {/if}
    </div>
    <div class="token-details">
      {#if $token}
        <span class="token-symbol">{$token.symbol}</span>
        <div class="token-meta">
          <span class="token-balance" title={`${$token.formattedBalance} ${$token.symbol}`}>
            {$token.formattedBalance} {$token.symbol}
          </span>
          <span class="token-value" title={`$${$token.formattedUsdValue}`}>
            ${$token.formattedUsdValue}
          </span>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="action-section">
    <div class="status-indicator" class:approved={isApproved}>
      {#if isApproved}
        <span class="status-icon" aria-hidden="true">✓</span>
        <span class="status-text">Approved</span>
      {:else}
        <span class="status-icon" aria-hidden="true">⚠️</span>
        <span class="status-text">Not Approved</span>
      {/if}
    </div>
    <Button
      variant={isApproved ? "yellow" : "blue"}
      text={isApproved ? "Revoke" : "Approve"}
      onClick={() => handleAction(isApproved ? 'revoke' : 'approve')}
      width="120px"
      disabled={loading}
    />
  </div>
</div>

<style lang="postcss">
  .token-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    gap: 1rem;
  }

  .token-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  .token-card.approved {
    border-color: rgba(76, 175, 80, 0.3);
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }
  .token-logo-wrapper {
    flex-shrink: 0;
  }

  .token-logo {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    object-fit: cover;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .token-symbol {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.875rem;
    color: #ffcd1f;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-meta {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .token-balance,
  .token-value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-section {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 1rem;
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
    transition: all 0.2s ease;
  }

  .status-indicator.approved {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }

  .status-icon {
    font-size: 0.875rem;
  }

  .status-text {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.625rem;
  }

  @media (max-width: 480px) {
    .token-card {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .action-section {
      align-items: stretch;
    }

    .status-indicator {
      justify-content: center;
    }
  }
</style>

