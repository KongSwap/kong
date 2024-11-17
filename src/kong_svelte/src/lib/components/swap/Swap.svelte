<script lang="ts">
  import { fade } from "svelte/transition";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import { SwapLogicService } from "$lib/services/swap/SwapLogicService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { getKongBackendPrincipal } from "$lib/utils/canisterIds";
  import { getButtonText } from "./utils";
  import SwapPanel from "$lib/components/swap/swap_ui/SwapPanel.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TokenSelector from "$lib/components/swap/swap_ui/TokenSelectorModal.svelte";
  import SwapConfirmation from "$lib/components/swap/swap_ui/SwapConfirmation.svelte";
  import BananaRain from "$lib/components/common/BananaRain.svelte";
  import SwapSuccessModal from "./swap_ui/SwapSuccessModal.svelte";
  import { settingsStore } from "$lib/services/settings/settingsStore";
  import { get } from "svelte/store";
  import { writable } from 'svelte/store';
  import { SwapService } from "$lib/services/swap/SwapService";

  const hoveredState = writable(false);

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();

  export let initialFromToken: FE.Token | null = null;
  export let initialToToken: FE.Token | null = null;

  let tweenedReceiveAmount = tweened(0, {
    duration: 120,
    easing: cubicOut,
  });

  type PanelType = "pay" | "receive";
  interface PanelConfig {
    id: string;
    type: PanelType;
    title: string;
  }

  let panels: PanelConfig[] = [
    { id: "pay", type: "pay", title: "You Pay" },
    { id: "receive", type: "receive", title: "You Receive" },
  ];

  $: userMaxSlippage = $settingsStore.max_slippage;

  let rotationCount = 0;
  let isRotating = false;
  let tooltipMessage = "Reverse trade";
  let showClickTooltip = false;

  onMount(() => {
    const init = async () => {
      await tokenStore.loadTokens();
      swapState.initializeTokens(initialFromToken, initialToToken);
    };
    init();
    
    const swapSuccessHandler = (event: CustomEvent) => {
      SwapLogicService.handleSwapSuccess(event);
    };

    window.addEventListener("swapSuccess", swapSuccessHandler);
    return () => window.removeEventListener("swapSuccess", swapSuccessHandler);
  });

  $: isSwapButtonDisabled = !$walletStore.isConnected || 
    !$swapState.payToken || 
    !$swapState.receiveToken || 
    !$swapState.payAmount || 
    $swapState.isProcessing || 
    get(swapState.isInputExceedingBalance) ||
    ($swapState.swapSlippage > userMaxSlippage);

  $: buttonText = get(swapState.isInputExceedingBalance)
    ? 'Insufficient Balance'
    : $swapState.swapSlippage > userMaxSlippage
    ? `Slippage (${$swapState.swapSlippage.toFixed(2)}%) Exceeds Limit (${userMaxSlippage}%)`
    : getButtonText({
        isCalculating: $swapState.isCalculating,
        isValidInput: Boolean($swapState.payAmount),
        isProcessing: $swapState.isProcessing,
        error: $swapState.error,
        swapSlippage: $swapState.swapSlippage,
        userMaxSlippage,
        isConnected: $walletStore.isConnected,
        payTokenSymbol: $swapState.payToken?.symbol || '',
        receiveTokenSymbol: $swapState.receiveToken?.symbol || ''
      });

  async function handleSwapClick() {
    if (!$swapState.payToken || !$swapState.receiveToken) return;
    swapState.setShowConfirmation(true);
  }

  async function handleSwap(): Promise<boolean> {
    if (!$swapState.payToken || !$swapState.receiveToken || !$swapState.payAmount || $swapState.isProcessing) {
      return false;
    }

    return SwapLogicService.executeSwap({
      payToken: $swapState.payToken,
      payAmount: $swapState.payAmount,
      receiveToken: $swapState.receiveToken,
      receiveAmount: $swapState.receiveAmount,
      userMaxSlippage,
      backendPrincipal: KONG_BACKEND_PRINCIPAL,
      lpFees: $swapState.lpFees
    });
  }

  async function handleAmountChange(event: CustomEvent) {
    const { value, panelType } = event.detail;
    
    if (panelType === 'pay') {
      await swapState.setPayAmount(value);
    } else {
      await swapState.setReceiveAmount(value);
    }
  }

  function handleTokenSelect(panelType: PanelType) {
    if (panelType === 'pay') {
      swapState.update(s => ({ ...s, showPayTokenSelector: true }));
    } else {
      swapState.update(s => ({ ...s, showReceiveTokenSelector: true }));
    }
  }

  function handleTokenSelected(token: FE.Token, panelType: PanelType) {
    const currentState = get(swapState);
    
    // If selecting the same token that's in the other panel, reverse the positions
    if ((panelType === 'pay' && token.canister_id === currentState.receiveToken?.canister_id) ||
        (panelType === 'receive' && token.canister_id === currentState.payToken?.canister_id)) {
      handleReverseTokens();
      return;
    }

    // Otherwise just update the selected token
    if (panelType === 'pay') {
      swapState.update(s => ({ ...s, payToken: token, showPayTokenSelector: false }));
    } else {
      swapState.update(s => ({ ...s, receiveToken: token, showReceiveTokenSelector: false }));
    }
  }

  function handleReverseTokens() {
    isRotating = true;
    rotationCount += 1;
    tooltipMessage = "Reversed!";
    showClickTooltip = true;
    
    setTimeout(() => {
      isRotating = false;
      setTimeout(() => {
        tooltipMessage = "Reverse trade";
        showClickTooltip = false;
      }, 2000);
    }, 200);

    const currentState = get(swapState);
    swapState.update((state) => ({
      ...state,
      payToken: state.receiveToken,
      receiveToken: state.payToken,
      payAmount: '',
      receiveAmount: ''
    }));
  }
</script>

<div class="swap-wrapper">
  <div class="swap-container" in:fade={{ duration: 420 }}>
    <div class="panels-container relative">
      {#each panels as panel}
        <SwapPanel
          title={panel.title}
          token={panel.type === 'pay' ? $swapState.payToken : $swapState.receiveToken}
          amount={panel.type === 'pay' ? $swapState.payAmount : $swapState.receiveAmount}
          onAmountChange={handleAmountChange}
          onTokenSelect={() => handleTokenSelect(panel.type)}
          showPrice={panel.type === 'receive'}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType={panel.type}
        />

        {#if panel.type === 'pay'}
        <div class="reverse-button-wrapper" class:rotating={isRotating}>
          <div class="tooltip font-mono" class:show={showClickTooltip || (!isRotating && $hoveredState)}>{tooltipMessage}</div>
          <button
            class="reverse-button"
            style="transform: translate(-50%, -50%) rotate({rotationCount * -360}deg)"
            on:click={handleReverseTokens}
            aria-label="Reverse tokens"
            on:mouseenter={() => hoveredState.set(true)}
            on:mouseleave={() => hoveredState.set(false)}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="72" 
              height="72" 
              viewBox="0 0 24 24" 
              fill="#FFD722" 
              stroke="#FFD722"
              style="pointer-events: none;"
            >
              <g stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <!-- Down arrow (always visible) -->
                <path class="down-arrow" d="M12 8V20M12 20L16 16M12 20L8 16" stroke="black" stroke-width="4.5"/>
                <path class="down-arrow" d="M12 8V20M12 20L16 16M12 20L8 16" stroke="#FFD722" stroke-width="3"/>
                
                <!-- Up arrow (visible on hover) -->
                <path class="up-arrow" d="M12 16V4M12 4L16 8M12 4L8 8" stroke="black" stroke-width="4.5"/>
                <path class="up-arrow" d="M12 16V4M12 4L16 8M12 4L8 8" stroke="#FFD722" stroke-width="3"/>
              </g>
            </svg>
          </button>
        </div>
        {/if}
      {/each}
    </div>

    <div class="swap-footer">
      <Button
        variant={$swapState.swapSlippage > userMaxSlippage ? "blue" : "yellow"}
        disabled={isSwapButtonDisabled}
        onClick={handleSwapClick}
        width="100%"
      >
        {buttonText}
      </Button>
    </div>
  </div>
</div>

{#if $swapState.showPayTokenSelector}
  <TokenSelector
    show={true}
    onSelect={(token) => handleTokenSelected(token, "pay")}
    onClose={() => swapState.update(s => ({ ...s, showPayTokenSelector: false }))}
    currentToken={$swapState.receiveToken}
  />
{/if}

{#if $swapState.showReceiveTokenSelector}
  <TokenSelector
    show={true}
    onSelect={(token) => handleTokenSelected(token, "receive")}
    onClose={() => swapState.update(s => ({ ...s, showReceiveTokenSelector: false }))}
    currentToken={$swapState.payToken}
  />
{/if}

{#if $swapState.showConfirmation}
  <SwapConfirmation
    payToken={$swapState.payToken}
    payAmount={$swapState.payAmount}
    receiveToken={$swapState.receiveToken}
    receiveAmount={$swapState.receiveAmount}
    gasFees={$swapState.gasFees}
    lpFees={$swapState.lpFees}
    userMaxSlippage={userMaxSlippage}
    routingPath={$swapState.routingPath}
    onConfirm={handleSwap}
    onClose={() => {
      swapState.setShowConfirmation(false);
      swapState.setIsProcessing(false);
    }}
  />
{/if}

{#if $swapState.showBananaRain}
  <BananaRain />
{/if}

<SwapSuccessModal
  show={$swapState.showSuccessModal}
  {...$swapState.successDetails}
  onClose={() => swapState.setShowSuccessModal(false)}
/>

<style scoped lang="postcss">
  .swap-wrapper {
    width: 100%;
    margin: 0;
  }

  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .panels-container {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 1rem;
    position: relative;
  }

  .reverse-button-wrapper {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 80px;
    height: 80px;
    transform: translate(-50%, -50%);
    z-index: 20;
  }

  :global(.swap-panel) {
    position: relative;
    z-index: 10;
  }

  .reverse-button {
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    display: flex;
    padding: 0.3rem;
    align-items: center;
    justify-content: center;
    color: #FFD722;
    cursor: pointer;
    transition: all 0.2s ease;
    pointer-events: all;
  }

  .reverse-button svg {
    display: block;
    transform: scaleX(-1);
    pointer-events: none;
  }

  .reverse-button path {
    pointer-events: none;
  }

  .tooltip {
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .tooltip.show {
    opacity: 1;
  }

  .reverse-button-wrapper:hover .tooltip {
    opacity: 1;
  }

  .reverse-button-wrapper.rotating .tooltip {
    opacity: 0;
  }

  .down-arrow {
    transition: all 0.2s ease;
    transform-origin: center;
    transform: scale(1.2) translateX(0);
  }

  .up-arrow {
    opacity: 0;
    transition: all 0.2s ease;
    transform: translateX(-5px);
  }

  .reverse-button:hover .down-arrow {
    transform: scale(1) translateX(5px);
  }

  .reverse-button:hover .up-arrow {
    opacity: 1;
    transform: translateX(-5px);
  }

  .reverse-button:hover {
    background: rgba(255, 215, 34, 0.2);
  }

  .reverse-button:active {
    transform: translate(-50%, -50%) scale(0.95) rotate(var(--rotation));
  }

  .swap-footer {
    margin-top: -𝟴px;
  }
</style>
