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
  import { themeStore } from '$lib/stores/themeStore';
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
      receiveToken = token;
      initialToToken = token;
      manuallySelectedTokens.receive = true;
      showReceiveTokenSelector = false;
      updateURL({ to: token.canister_id });
    }

    if (payAmount) debouncedGetQuote(payAmount);
  }

  onMount(() => {
    const handleSwapSuccess = (event: CustomEvent) => {
      // Update success details with the actual swap values
      successDetails = {
        payAmount: event.detail.payAmount,
        payToken: $tokenStore.tokens.find((t) => t.symbol === event.detail.payToken),
        receiveAmount: event.detail.receiveAmount,
        receiveToken: $tokenStore.tokens.find((t) => t.symbol === event.detail.receiveToken),
      };
      tokenStore.loadPrices();
      payAmount = null;
      showSuccessModal = true;
    };

    window.addEventListener("swapSuccess", handleSwapSuccess);

    return () => {
      window.removeEventListener("swapSuccess", handleSwapSuccess);
    };
  });

  async function handleSwap(): Promise<boolean> {
    if (!isValidInput || isProcessing) {
      return false;
    }
    isProcessing = true;
    error = null;
    try {
      // Create new swap entry and store its ID
      let swapId = swapStatusStore.addSwap({
        expectedReceiveAmount: receiveAmount,
        lastPayAmount: payAmount,
        payToken: payToken,
        receiveToken: receiveToken,
        payDecimals: Number(getTokenDecimals(payToken.canister_id).toString()),
      });

      await SwapService.executeSwap({
        swapId,
        payToken,
        payAmount,
        receiveToken,
        receiveAmount,
        userMaxSlippage,
        backendPrincipal: KONG_BACKEND_PRINCIPAL,
        lpFees,
      });
      return true;
    } catch (err) {
      console.error("Swap execution error:", err);
      toastStore.error(err instanceof Error ? err.message : "Swap failed");
      return false;
    } finally {
      payAmount = null;
      receiveAmount = null;
      isProcessing = false;
      isConfirmationOpen = false;
    }
  }

  // Subscribe to quote updates for this specific swap
  $: {
    async function refreshQuote() {
      const quote = await getSwapQuote(payAmount);
      console.log("Refreshing quote display:", quote);
      // Update only this specific swap's quote
      if (currentSwapId) {
        swapStatusStore.updateSwap(currentSwapId, {
          shouldRefreshQuote: false,
          lastQuote: quote,
        });
      }
    }

    // Check if current swap needs a quote refresh
    if (currentSwapId && $swapStatusStore[currentSwapId]?.shouldRefreshQuote) {
      refreshQuote();
    }
  }

  async function handleSwapClick() {
    if (!isValidInput || isProcessing) return;

    // Refresh quote before showing confirmation
    isProcessing = true;
    const quote = await getSwapQuote(payAmount);
    swapStatusStore.updateSwap(currentSwapId, {
      lastQuote: quote,
      shouldRefreshQuote: true,
    });
    isProcessing = false;
    showConfirmation = true;
  }

  // Add this effect to handle URL updates
  $: {
    if (!isSwitching) {
      if (initialFromToken && !manuallySelectedTokens.pay) {
        payToken =
          $tokenStore.tokens.find(
            (t) => t.canister_id === initialFromToken.canister_id,
          ) || $tokenStore.tokens.find((t) => t.symbol === "ICP");
      }
      if (initialToToken && !manuallySelectedTokens.receive) {
        receiveToken =
          $tokenStore.tokens.find(
            (t) => t.canister_id === initialToToken.canister_id,
          ) || $tokenStore.tokens.find((t) => t.symbol === "ckBTC");
      }
    }
  }

  // Add this near the top of your script, with other declarations
  const debouncedGetQuote = debounce(
    async (amount: string) => {
      await getSwapQuote(amount);
    },
    500,
    {
      leading: false,
      trailing: true,
      maxWait: 1000,
    },
  );

  // Update arrow configurations
  const PixelArrow = {
    viewBox: "0 0 35 42",
    path: "M0.5 26.8824V27.3824H1H2.85294V29.2353V29.7353H3.35294H5.20588V31.5882V32.0882H5.70588H7.55882V33.9412V34.4412H8.05882H9.91177V36.2941V36.7941H10.4118H12.2647V38.6471V39.1471H12.7647H14.6176V41V41.5H15.1176H19.8235H20.3235V41V39.1471H22.1765H22.6765V38.6471V36.7941H24.5294H25.0294V36.2941V34.4412H26.8824H27.3824V33.9412V32.0882H29.2353H29.7353V31.5882V29.7353H31.5882H32.0882V29.2353V27.3824H33.9412H34.4412V26.8824V24.5294V24.0294H33.9412H25.0294V3.35294V2.85294H24.5294H22.6765V1V0.5H22.1765H12.7647H12.2647V1V2.85294H10.4118H9.91177V3.35294V24.0294H1H0.5V24.5294V26.8824Z"
  };

  const ModernArrow = {
    viewBox: "0 0 48 48",
    paths: [
      // Main circle
      "M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4 4 12.954 4 24s8.954 20 20 20z",
      // Top arrow
      "M24 15l7 7H17l7-7z",
      // Bottom arrow
      "M24 33l-7-7h14l-7 7z"
    ]
  };
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

      <button
        class="switch-button"
        class:modern={$themeStore !== 'pixel'}
        on:click={handleTokenSwitch}
        disabled={isProcessing}
        aria-label="Switch tokens"
      >
        {#if $themeStore === 'pixel'}
          <svg
            width="56"
            height="64"
            viewBox={PixelArrow.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            class="swap-arrow"
          >
            <path
              d={PixelArrow.path}
              stroke="#000000"
              stroke-width="1"
              fill="#ffcd1f"
              class="arrow-path"
            />
          </svg>
        {:else}
          <svg
            width="48"
            height="48"
            viewBox={ModernArrow.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            class="swap-arrow modern"
          >
            <!-- Background circle -->
            <path
              d={ModernArrow.paths[0]}
              class="arrow-background"
            />
            <!-- Arrows -->
            <path
              d={ModernArrow.paths[1]}
              class="arrow-symbol"
            />
            <path
              d={ModernArrow.paths[2]}
              class="arrow-symbol"
            />
          </svg>
        {/if}
      </button>
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

  .switch-button.modern {
    background: transparent;
    border-radius: 50%;
    padding: 0.75rem;
  }

  .switch-button.modern:hover:not(:disabled) {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .switch-button.modern:active:not(:disabled) {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Modern theme specific styles */
  .swap-arrow.modern {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .arrow-background {
    fill: #ffcd1f;
    transition: all 0.3s ease;
  }

  .arrow-symbol {
    fill: #000000;
    transition: all 0.3s ease;
  }

  /* Hover effects for modern theme */
  .switch-button.modern:hover:not(:disabled) .arrow-background {
    fill: #ffe380;
  }

  .switch-button.modern:active:not(:disabled) .arrow-background {
    fill: #ffc107;
  }

  /* Disabled state for modern theme */
  .switch-button.modern:disabled .arrow-background {
    fill: #e0e0e0;
  }

  .switch-button.modern:disabled .arrow-symbol {
    fill: #999999;
  }

  /* Animation for modern theme */
  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(180deg);
    }
  }

  .switch-button.modern:hover:not(:disabled) .swap-arrow.modern {
    animation: rotate 0.3s ease-in-out;
  }

  @media (max-width: 480px) {
    .switch-button.modern {
      padding: 0.5rem;
    }

    .swap-arrow.modern {
      width: 40px;
      height: 40px;
    }
  }

  .swap-arrow {
    width: 56px;
    height: 64px;
    pointer-events: none;
  }

  @media (max-width: 480px) {
    .swap-wrapper {
      padding: 0 0.5rem;
    }

    .switch-button {
      width: 64px;
      height: 64px;
      padding: 14px;
    }

    .swap-arrow {
      width: 48px;
      height: 56px;
    }

    .swap-footer {
      margin-top: 1.5rem;
    }

    .panels-container {
      gap: 6px;
      margin-bottom: 12px;
    }
  }

  :global(.swap-footer) {
    margin-top: 0;
  }

  .panel-content {
    transform-origin: center center;
    backface-visibility: hidden;
  }

  .mode-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .arrow-path {
    transition: fill 0.2s ease;
  }

  :global([data-theme="minimal"]) .arrow-path {
    stroke-width: 2;
    /* You can customize these styles for minimal theme */
  }

  :global([data-theme="pixel"]) .arrow-path {
    stroke-width: 1;
    /* You can customize these styles for pixel theme */
  }
</style>
