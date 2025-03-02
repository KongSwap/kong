<script lang="ts">
  import { onMount } from 'svelte';
  import { createPNP } from '@windoge98/plug-n-play';
  import { idlFactory } from '../../../../../../src/declarations/token_backend/token_backend.did.js';
  import { tokenStore } from '../../stores/tokens';

  let pnp: any = null;
  let authActor: any = null;
  let balance = BigInt(0);
  let transactions: any[] = [];
  let isLoading = true;

  // Get canister ID based on environment
  function getCanisterId(): string {
    if (typeof window !== 'undefined') {
      if (window.__CANISTER_ID__) {
        return window.__CANISTER_ID__;
      }
      if ((window as any).canisterId) {
        return (window as any).canisterId;
      }
      if ((window as any).canisterIdRoot) {
        return (window as any).canisterIdRoot;
      }
    }
    throw new Error('Canister ID not found in window variables');
  }

  async function getAuthActor() {
    try {
      if (!authActor) {
        const canisterId = getCanisterId();
        authActor = await pnp.getActor(canisterId, idlFactory);
      }
      return authActor;
    } catch (error) {
      console.error("Failed to create authenticated actor:", error);
      throw error;
    }
  }

  async function fetchWalletData() {
    try {
      const actor = await getAuthActor();
      const principal = await actor.whoami();
      
      // Fetch balance
      const balanceResult = await actor.balance_of(principal);
      if ('Ok' in balanceResult) {
        balance = balanceResult.Ok;
      }

      // Fetch transactions
      const txResult = await actor.get_transactions(principal);
      if ('Ok' in txResult) {
        transactions = txResult.Ok;
        // Sort transactions by timestamp (newest first)
        transactions.sort((a, b) => Number(b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      isLoading = false;
    }
  }

  function formatNumber(n: bigint): string {
    return new Intl.NumberFormat().format(Number(n));
  }

  function formatDate(timestamp: bigint): string {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  }

  function formatTransactionType(tx: any): string {
    if ('mint' in tx.transaction_type) return 'Mint';
    if ('transfer' in tx.transaction_type) return 'Transfer';
    if ('burn' in tx.transaction_type) return 'Burn';
    return 'Unknown';
  }

  function getTransactionAmount(tx: any): bigint {
    if ('mint' in tx.transaction_type) return tx.transaction_type.mint.amount;
    if ('transfer' in tx.transaction_type) return tx.transaction_type.transfer.amount;
    if ('burn' in tx.transaction_type) return tx.transaction_type.burn.amount;
    return BigInt(0);
  }

  onMount(async () => {
    try {
      if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
        (window as any).global = window;
      }

      pnp = createPNP({
        hostUrl: "https://icp0.io",
        isDev: false,
        identityProvider: "https://identity.ic0.app",
        derivationOrigin: window.location.origin,
        persistSession: true
      });

      await fetchWalletData();
      
      // Refresh data every 30 seconds
      setInterval(fetchWalletData, 30000);
    } catch (error) {
      console.error('Failed to initialize:', error);
      isLoading = false;
    }
  });
</script>

<div class="wallet-page">
  <div class="balance-card">
    <h2>Your Balance</h2>
    {#if isLoading}
      <div class="loading">Loading balance...</div>
    {:else}
      <p class="balance">{formatNumber(balance)} KONG</p>
    {/if}
  </div>

  <div class="transactions-card">
    <h2>Transaction History</h2>
    {#if isLoading}
      <div class="loading">Loading transactions...</div>
    {:else if transactions.length === 0}
      <div class="no-transactions">No transactions found</div>
    {:else}
      <div class="transactions">
        {#each transactions as tx}
          <div class="transaction">
            <div class="tx-header">
              <span class="tx-type">{formatTransactionType(tx)}</span>
              <span class="tx-time">{formatDate(tx.timestamp)}</span>
            </div>
            <div class="tx-details">
              <span class="tx-amount">
                {formatTransactionType(tx) === 'Transfer' ? '-' : ''}
                {formatNumber(getTransactionAmount(tx))} KONG
              </span>
              {#if 'transfer' in tx.transaction_type}
                <span class="tx-to">
                  To: {tx.transaction_type.transfer.to.slice(0, 10)}...
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .wallet-page {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .balance-card {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 2rem;
  }

  .balance-card h2 {
    color: var(--text-green);
    margin-bottom: 1rem;
  }

  .balance {
    font-size: 3rem;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .transactions-card {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .transactions-card h2 {
    color: var(--text-green);
    margin-bottom: 1.5rem;
  }

  .transactions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .transaction {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
  }

  .tx-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .tx-type {
    color: var(--text-green);
    font-weight: 500;
  }

  .tx-time {
    color: #666;
    font-size: 0.9rem;
  }

  .tx-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tx-amount {
    font-size: 1.1rem;
    color: #fff;
  }

  .tx-to {
    color: #888;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #888;
    font-style: italic;
  }

  .no-transactions {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .wallet-page {
      padding: 1rem;
    }

    .balance {
      font-size: 2rem;
    }

    .tx-details {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style> 
