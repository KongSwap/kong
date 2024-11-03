<script lang="ts">
    import { fade } from 'svelte/transition';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { SwapService } from '$lib/services/SwapService';
    import { toastStore } from '$lib/stores/toastStore';
    import { getKongBackendPrincipal } from '$lib/utils/canisterIds';
    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';

    export let show = false;
    export let onClose: () => void;
    export let slippage: number;
    export let onSlippageChange: (value: number) => void;

    const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();
    const swapService = SwapService.getInstance();

    let approvalAmounts: { [key: string]: bigint } = {};
    let isApproving: { [key: string]: boolean } = {};
    let isRevoking: { [key: string]: boolean } = {};

    const scaleSpring = spring(1, {
      stiffness: 0.3,
      damping: 0.6
    });

    const slideIn = (node, { delay = 0, duration = 150 }) => ({
      delay,
      duration,
      css: t => {
        const steps = Math.floor(t * 4) / 4;
        return `
          transform: translateY(${(1 - steps) * 16}px);
          opacity: ${steps};
        `;
      }
    });

    onMount(async () => {
      await refreshApprovals();
    });

    async function refreshApprovals() {
      for (const token of $tokenStore.tokens) {
        try {
          const amount = await swapService.getAllowance(token, KONG_BACKEND_PRINCIPAL);
          approvalAmounts[token.symbol] = amount;
        } catch (error) {
          console.error(`Failed to get allowance for ${token.symbol}:`, error);
        }
      }
      approvalAmounts = { ...approvalAmounts };
    }

    async function handlePreApprove(token: any) {
      if (isApproving[token.symbol]) return;
      
      isApproving[token.symbol] = true;
      try {
        const maxAmount = BigInt("0xFFFFFFFFFFFFFFFF"); // Max uint64
        const txId = await swapService.approveToken(
          token,
          maxAmount,
          token.fee,
          KONG_BACKEND_PRINCIPAL
        );

        if (!txId) {
          throw new Error('Approval failed');
        }
        
        await refreshApprovals();
        toastStore.success(`Pre-approved ${token.symbol} for future swaps`);
      } catch (error) {
        toastStore.error(`Failed to pre-approve ${token.symbol}: ${error.message}`);
      } finally {
        isApproving[token.symbol] = false;
      }
    }

    async function handleRevoke(token: any) {
      if (isRevoking[token.symbol]) return;

      isRevoking[token.symbol] = true;
      try {
        const txId = await swapService.approveToken(
          token,
          BigInt(0),
          token.fee,
          KONG_BACKEND_PRINCIPAL
        );

        if (!txId) {
          throw new Error('Revoke failed');
        }

        await refreshApprovals();
        toastStore.success(`Revoked approval for ${token.symbol}`);
      } catch (error) {
        toastStore.error(`Failed to revoke ${token.symbol}: ${error.message}`);
      } finally {
        isRevoking[token.symbol] = false;
      }
    }

    const commonSlippageValues = [0.1, 0.5, 1, 2, 3];

    function formatAmount(amount: bigint): string {
      if (amount === BigInt(0)) return '0';
      if (amount >= BigInt("0xFFFFFFFFFFFFFFFF")) return 'Unlimited';
      return amount.toString();
    }
</script>

<div class="modal-overlay" transition:fade={{ duration: 150 }}>
  <div class="modal-content" style="transform: scale({$scaleSpring})">
    <div class="modal-header" in:slideIn={{ delay: 50 }}>
      <h2 class="section-title">Settings</h2>
      <button class="close-button" on:click={onClose}>×</button>
    </div>

    <div class="settings-content">
      <!-- Slippage Settings -->
      <div class="section" in:slideIn={{ delay: 100 }}>
        <h3 class="section-title glow-text">Slippage Tolerance</h3>
        <p class="section-description">
          Your transaction will revert if the price changes unfavorably by more than this percentage
        </p>
        <div class="slippage-buttons">
          {#each commonSlippageValues as value}
            <button
              class="slippage-btn {slippage === value ? 'active' : ''}"
              on:click={() => onSlippageChange(value)}
            >
              {value}%
            </button>
          {/each}
          <div class="custom-slippage">
            <input
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              bind:value={slippage}
              on:input={(e) => onSlippageChange(Number(e.currentTarget.value))}
            />
            <span class="percent">%</span>
          </div>
        </div>
      </div>

      <!-- Pre-approval Settings -->
      <div class="section" in:slideIn={{ delay: 150 }}>
        <h3 class="section-title glow-text">Token Approvals</h3>
        <div class="approval-info">
          <p class="section-description">
            Pre-approving tokens enables one-click swaps by granting Kong permission to move tokens on your behalf. 
            This saves gas and time by eliminating separate approval transactions.
          </p>
          <ul class="benefits-list">
            <li>✨ One-click swaps</li>
            <li>💨 Faster transactions</li>
            <li>💰 Save on gas fees</li>
          </ul>
        </div>
        <div class="token-grid">
          {#each $tokenStore.tokens || [] as token}
            {@const isApproved = approvalAmounts[token.symbol] > BigInt(0)}
            {@const isLoading = isApproving[token.symbol] || isRevoking[token.symbol]}
            <div class="token-approval-card {isApproved ? 'approved' : ''}">
              <div class="token-info">
                <img 
                  src={token.logo || "/tokens/not_verified.webp"} 
                  alt={token.symbol} 
                  class="token-icon"
                />
                <div class="token-details">
                  <span class="token-symbol">{token.symbol}</span>
                  <span class="approval-status">
                    {#if isApproved}
                      <span class="status approved">✓ Approved</span>
                    {:else}
                      <span class="status not-approved">⚠ Not Approved</span>
                    {/if}
                  </span>
                </div>
              </div>
              <div class="action-container">
                <span class="approval-amount">
                  {#if isApproved}
                    Approved amount: {formatAmount(approvalAmounts[token.symbol] || BigInt(0))}
                  {:else}
                    Ready to enable fast swaps
                  {/if}
                </span>
                <div class="action-buttons">
                  {#if isApproved}
                    <button 
                      class="revoke-button"
                      disabled={isLoading}
                      on:click={() => handleRevoke(token)}
                    >
                      {#if isRevoking[token.symbol]}
                        <div class="loader revoke-loader"></div>
                      {:else}
                        Revoke Access
                      {/if}
                    </button>
                  {:else}
                    <button 
                      class="approve-button"
                      disabled={isLoading}
                      on:click={() => handlePreApprove(token)}
                    >
                      {#if isApproving[token.symbol]}
                        <div class="loader"></div>
                      {:else}
                        Enable Fast Swaps
                      {/if}
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
  }

  .modal-content {
    background: #2a2a2a;
    border: 4px solid #454545;
    border-radius: 0;
    box-shadow: 
      inset -4px -4px 0 #111,
      inset 4px 4px 0 #333,
      8px 8px 0 rgba(0,0,0,0.5);
    image-rendering: pixelated;
    padding: 24px;
    color: white;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    border-bottom: 4px solid #454545;
    padding-bottom: 16px;
  }

  .section {
    border: 2px solid #333;
    background: #222;
    box-shadow: 
      inset 2px 2px #111,
      inset -2px -2px #444;
    padding: 16px;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
  }

  .section::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.1),
      transparent
    );
    animation: shine 3s 1;
  }

  .section-title {
    font-family: 'Alumni Sans', sans-serif;
    font-size: 1.8em;
    font-weight: 800;
    color: #ffd700;
    text-transform: uppercase;
    text-shadow: 
      2px 2px 0 #000,
      -2px -2px 0 #000,
      4px 4px 0 rgba(0,0,0,0.5);
    letter-spacing: 1px;
  }

  .close-button {
    background: #454545;
    border: 2px solid #555;
    color: white;
    width: 32px;
    height: 32px;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .section-description {
    color: #888;
    margin-bottom: 16px;
    font-size: 0.9em;
  }

  .slippage-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .slippage-btn {
    background: #454545;
    border: 2px solid #555;
    border-radius: 0;
    padding: 8px 16px;
    color: white;
    cursor: pointer;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9em;
    box-shadow:
      inset -2px -2px 0 #222,
      inset 2px 2px 0 #666;
    image-rendering: pixelated;
  }

  .slippage-btn.active {
    background: #ffd700;
    color: black;
    border: 2px solid #806c00;
    box-shadow:
      inset -2px -2px 0 #806c00,
      inset 2px 2px 0 #ffe033;
    text-shadow: 1px 1px 0 #806c00;
  }

  .custom-slippage {
    position: relative;
    width: 100px;
  }

  .custom-slippage input {
    background: #333;
    border: 2px solid #444;
    border-radius: 0;
    box-shadow: 
      inset -2px -2px 0 #222,
      inset 2px 2px 0 #444;
    color: white;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8em;
    padding: 8px 24px 8px 12px;
  }

  .custom-slippage .percent {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #888;
  }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .token-approval-card {
    background: #333;
    border: 2px solid #444;
    border-radius: 0;
    box-shadow: 
      inset -2px -2px 0 #222,
      inset 2px 2px 0 #444;
    position: relative;
    overflow: hidden;
  }

  .token-approval-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.1),
      transparent
    );
    animation: shine 3s 1;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .token-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    image-rendering: pixelated;
  }

  .token-symbol {
    font-weight: 500;
    color: #ffd700;
  }

  .approval-amount {
    font-size: 0.8rem;
    color: #888;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .approve-button, .revoke-button {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8em;
    border-radius: 0;
    padding: 8px 16px;
    image-rendering: pixelated;
  }

  .approve-button {
    background: #ffd700;
    color: black;
    border: none;
    box-shadow:
      inset -2px -2px 0 #806c00,
      inset 2px 2px 0 #ffe033,
      2px 2px 0 #000;
    text-shadow: 1px 1px 0 #806c00;
  }

  .revoke-button {
    background: #ff4444;
    color: white;
    border: none;
    box-shadow:
      inset -2px -2px 0 #992929,
      inset 2px 2px 0 #ff6666,
      2px 2px 0 #000;
    text-shadow: 1px 1px 0 #992929;
  }

  .approve-button:disabled, .revoke-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loader {
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    box-shadow: 
      4px 4px 0 0 currentColor,
      8px 4px 0 0 currentColor,
      4px 8px 0 0 currentColor;
    animation: pixelSpin 0.8s steps(4) infinite;
  }

  .revoke-loader {
    border-top-color: white;
  }

  @keyframes pixelSpin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes shine {
    to {
      left: 100%;
    }
  }

  .glow-text {
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    color: #ffd700;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 480px) {
    .modal-content {
      border-radius: 16px;
      max-height: 80vh;
      height: auto;
      max-width: 95%;
      margin: 0 auto;
    }

    .token-grid {
      grid-template-columns: 1fr;
    }
  }

  .approval-info {
    background: rgba(0, 0, 0, 0.2);
    border-left: 4px solid #ffd700;
    padding: 12px;
    margin-bottom: 20px;
  }

  .benefits-list {
    list-style: none;
    padding: 0;
    margin: 8px 0 0 0;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .benefits-list li {
    color: #ffd700;
    font-size: 0.9em;
  }

  .token-approval-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    transition: all 0.2s ease;
  }

  .token-approval-card.approved {
    background: linear-gradient(45deg, #333, #383838);
    border-color: #ffd700;
  }

  .action-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .approval-status {
    font-size: 0.8em;
  }

  .status {
    padding: 2px 6px;
    border-radius: 4px;
  }

  .status.approved {
    background: rgba(0, 255, 0, 0.1);
    color: #00ff00;
  }

  .status.not-approved {
    background: rgba(255, 215, 0, 0.1);
    color: #ffd700;
  }

  .approve-button, .revoke-button {
    width: 100%;
    padding: 10px;
    font-size: 0.75em;
  }

  .approve-button {
    background: linear-gradient(45deg, #ffd700, #ffed4a);
  }

  .revoke-button {
    background: linear-gradient(45deg, #ff4444, #ff6666);
  }
</style>
