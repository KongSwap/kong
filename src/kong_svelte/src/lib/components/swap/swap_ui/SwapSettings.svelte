<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { SwapService } from '$lib/services/SwapService';
    import { toastStore } from '$lib/stores/toastStore';
    import { getKongBackendPrincipal } from '$lib/utils/canisterIds';
    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import Panel from '$lib/components/common/Panel.svelte';

    export let show = false;
    export let onClose: () => void;
    export let slippage: number;
    export let onSlippageChange: (value: number) => void;

    const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();
    const swapService = SwapService.getInstance();

    let approvalAmounts: { [key: string]: bigint } = {};
    let isApproving: { [key: string]: boolean } = {};
    let isRevoking: { [key: string]: boolean } = {};
    let activeTab: "slippage" | "approvals" = "slippage";
    let isDragging = false;
    let settingsWidth = 480;
    let isMobile = false;

    const scaleSpring = spring(1, {
      stiffness: 0.3,
      damping: 0.6
    });

    function debounce(fn: Function, ms: number) {
      let timeoutId: ReturnType<typeof setTimeout>;
      return function (...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
      };
    }

    const debouncedResize = debounce(() => {
      isMobile = window.innerWidth <= 768;
      settingsWidth = isMobile ? window.innerWidth : Math.min(480, window.innerWidth - 64);
    }, 100);

    onMount(async () => {
      await refreshApprovals();
      debouncedResize();
      window.addEventListener("resize", debouncedResize);
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

{#if show}
<div 
  class="settings-overlay"
  transition:fade={{ duration: 300, easing: cubicOut }}
>
  <button
    class="overlay-button"
    on:click={onClose}
    aria-label="Close settings"
  />

  <div
    class="settings-wrapper"
    class:is-dragging={isDragging}
    style="width: {settingsWidth}px"
    in:fly={{ x: 500, duration: 300, easing: cubicOut }}
    out:fly={{ x: 500, duration: 300, easing: cubicOut }}
  >
    <Panel
      variant="green"
      type="main"
      width={isMobile ? "100%" : `${settingsWidth}px`}
      height={isMobile ? "100vh" : "90vh"}
      className="settings-panel"
    >
      <div class="settings-layout">
        <header class="settings-header">
          <h2>Settings</h2>
          <div class="tab-buttons">
            <button
              class:active={activeTab === "slippage"}
              on:click={() => activeTab = "slippage"}
            >
              Slippage
            </button>
            <button
              class:active={activeTab === "approvals"}
              on:click={() => activeTab = "approvals"}
            >
              Approvals
            </button>
          </div>
        </header>

        <div class="settings-content">
          <div class="scroll-container">
            {#if activeTab === "slippage"}
              <div class="section">
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
            {:else}
              <div class="section">
                <h3 class="section-title glow-text">Token Approvals</h3>
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
            {/if}
          </div>
        </div>
      </div>
    </Panel>
  </div>
</div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .overlay-button {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .settings-wrapper {
    position: absolute;
    top: 5vh;
    right: 32px;
    height: 90vh;
    min-width: 420px;
    max-width: min(800px, calc(100vw - 50px));
    transform-origin: right center;
    background-color: transparent;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 0 8px;
  }

  .settings-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .settings-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-buttons {
    display: flex;
    gap: 8px;
  }

  .tab-buttons button {
    background: transparent;
    border: none;
    color: #888;
    padding: 8px 16px;
    cursor: pointer;
    border-radius: 4px;
  }

  .tab-buttons button.active {
    background: rgba(255, 215, 0, 0.1);
    color: #ffd700;
  }

  .settings-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .scroll-container {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    padding: 16px;
  }

  .scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  @media (max-width: 768px) {
    .settings-wrapper {
      top: 0;
      right: 0;
      width: 100% !important;
      min-width: 100%;
      max-width: 100%;
      height: 100vh;
    }
  }

  /* Rest of the styles remain the same */
</style>
