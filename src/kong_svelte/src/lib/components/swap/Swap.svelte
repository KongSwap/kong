<script lang="ts">
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import { SwapLogicService } from "$lib/services/swap/SwapLogicService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { auth } from "$lib/services/auth";
  import { tokenStore, getTokenDecimals } from "$lib/services/tokens/tokenStore";
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
  import { SwapService } from "$lib/services/swap/SwapService";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapStatusStore } from "$lib/services/swap/swapStore";
  import debounce from "lodash/debounce";
    import { replaceState } from "$app/navigation";
  import { writable } from "svelte/store";
  import { createEventDispatcher } from 'svelte';
  import Portal from 'svelte-portal';

  let isProcessing = false;
  let rotationCount = 0;
  let isRotating = false;
  let currentSwapId: string | null = null;

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();

  export let initialFromToken: FE.Token | null = null;
  export let initialToToken: FE.Token | null = null;
  export let currentMode: 'normal' | 'pro';

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

  const dispatch = createEventDispatcher<{
    modeChange: { mode: 'normal' | 'pro' };
  }>();

  $: userMaxSlippage = $settingsStore.max_slippage;

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

  $: isSwapButtonDisabled =
    !$auth?.account?.owner ||
    !$swapState.payToken ||
    !$swapState.receiveToken ||
    !$swapState.payAmount ||
    $swapState.isProcessing ||
    get(swapState.isInputExceedingBalance) ||
    $swapState.swapSlippage > userMaxSlippage;

  $: buttonText = $swapState.swapSlippage > userMaxSlippage
      ? `Slippage (${$swapState.swapSlippage.toFixed(2)}%) Exceeds Limit (${userMaxSlippage}%)`
      : getButtonText({
          isCalculating: $swapState.isCalculating,
          isValidInput: Boolean($swapState.payAmount),
          isProcessing: $swapState.isProcessing,
          error: $swapState.error,
          swapSlippage: $swapState.swapSlippage,
          userMaxSlippage,
          isConnected: $auth.isConnected,
          payTokenSymbol: $swapState.payToken?.symbol || "",
          receiveTokenSymbol: $swapState.receiveToken?.symbol || "",
        });

  async function handleSwapClick() {
    if (!$swapState.payToken || !$swapState.receiveToken) return;

    // Reset all relevant state
    swapState.update((state) => ({
      ...state,
      showConfirmation: true,
      isProcessing: false,
      error: null,
      showSuccessModal: false,
    }));

    console.log("showConfirmation before:", $swapState.showConfirmation);

    console.log("showConfirmation after:", $swapState.showConfirmation);
  }

  async function handleSwap(): Promise<boolean> {
    if (
      !$swapState.payToken ||
      !$swapState.receiveToken ||
      !$swapState.payAmount ||
      $swapState.isProcessing
    ) {
      return false;
    }

    try {
      swapState.setIsProcessing(true);
      swapState.setError(null);

      // Create new swap entry and store its ID
      currentSwapId = swapStatusStore.addSwap({
        expectedReceiveAmount: $swapState.receiveAmount,
        lastPayAmount: $swapState.payAmount,
        payToken: $swapState.payToken,
        receiveToken: $swapState.receiveToken,
        payDecimals: Number(getTokenDecimals($swapState.payToken.canister_id).toString()),
      });

      const success = await SwapService.executeSwap({
        swapId: currentSwapId,
        payToken: $swapState.payToken,
        payAmount: $swapState.payAmount,
        receiveToken: $swapState.receiveToken,
        receiveAmount: $swapState.receiveAmount,
        userMaxSlippage,
        backendPrincipal: KONG_BACKEND_PRINCIPAL,
        lpFees: $swapState.lpFees,
      });

      if (success) {
        toastStore.success("Swap successful");
        return true;
      } else {
        toastStore.error("Swap failed");
        return false;
      }
    } catch (error) {
      console.error("Swap error:", error);
      toastStore.error("Swap failed: " + (error.message || "Unknown error"));
      return false;
    } finally {
      swapState.setIsProcessing(false);
      currentSwapId = null;
    }
  }

  async function handleAmountChange(event: CustomEvent) {
    const { value, panelType } = event.detail;

    if (panelType === "pay") {
      await swapState.setPayAmount(value);
    } else {
      await swapState.setReceiveAmount(value);
    }
  }

  function handleTokenSelect(panelType: PanelType) {
    if (panelType === "pay") {
      swapState.update((s) => ({ ...s, showPayTokenSelector: true }));
    } else {
      swapState.update((s) => ({ ...s, showReceiveTokenSelector: true }));
    }
  }

  function handleTokenSelected(token: FE.Token, panelType: PanelType) {
    const currentState = get(swapState);

    // If selecting the same token that's in the other panel, reverse the positions
    if (
      (panelType === "pay" &&
        token.canister_id === currentState.receiveToken?.canister_id) ||
      (panelType === "receive" &&
        token.canister_id === currentState.payToken?.canister_id)
    ) {
      handleReverseTokens();
      return;
    }

    // Otherwise just update the selected token
    if (panelType === 'pay') {
      swapState.setPayToken(token);
      swapState.update(s => ({ ...s, showPayTokenSelector: false }));
      if (token.canister_id) {
        updateTokenInURL('from', token.canister_id);
      }
    } else {
      swapState.setReceiveToken(token);
      swapState.update(s => ({ ...s, showReceiveTokenSelector: false }));
      if (token.canister_id) {
        updateTokenInURL('to', token.canister_id);
      }
    }

    if ($swapState.payAmount) {
      debouncedGetQuote($swapState.payAmount);
    }
  }

  async function handleReverseTokens() {
    if ($swapState.isProcessing) return;
    
    isRotating = true;
    rotationCount++;
    
    const tempPayToken = $swapState.payToken;
    const tempPayAmount = $swapState.payAmount;
    
    swapState.setPayToken($swapState.receiveToken);
    swapState.setReceiveToken(tempPayToken);
    
    if (tempPayAmount) {
      await swapState.setPayAmount(tempPayAmount);
    }
    
    // Update URL params if both tokens are present
    if ($swapState.payToken?.canister_id && $swapState.receiveToken?.canister_id) {
      updateTokenInURL('from', $swapState.payToken.canister_id);
      updateTokenInURL('to', $swapState.receiveToken.canister_id);
    }
    
    setTimeout(() => {
      isRotating = false;
    }, 300);
  }

  function updateTokenInURL(param: 'from' | 'to', tokenId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(param, tokenId);
    replaceState(url.toString(), {});
  }

  const debouncedGetQuote = debounce(
    async (amount: string) => {
      if ($swapState.payToken && $swapState.receiveToken) {
        await SwapService.getSwapQuote($swapState.payToken, $swapState.receiveToken, amount);
      }
    },
    500,
    {
      leading: false,
      trailing: true,
      maxWait: 1000,
    },
  );

  // Update arrow configurations
  const ModernArrow = {
    viewBox: "0 0 48 48",
    paths: [
      // Outer circle
      "M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4 4 12.954 4 24s8.954 20 20 20z",
      // Inner design - arrows
      "M24 16l8 8H16l8-8z M24 32l-8-8h16l-8 8z"
    ]
  };
</script>

<div class="swap-wrapper">
  <div class="swap-container" in:fade={{ duration: 420 }}>
    <div class="mode-selector" class:mode-selector-pixel={$themeStore === 'pixel'}>
      <Button
        variant="yellow"
        size="medium"
        state={currentMode === "normal" ? "selected" : "default"}
        onClick={() => dispatch('modeChange', { mode: 'normal' })}
        width="50%"
      >
        Normal
      </Button>
      <Button
        variant="yellow"
        size="medium"
        state={currentMode === "pro" ? "selected" : "default"}
        onClick={() => dispatch('modeChange', { mode: 'pro' })}
        width="50%"
      >
        Pro
      </Button>
    </div>

    <div class="panels-container">
      <div class="panels-wrapper">
        <div class="panel">
          <SwapPanel
            title={panels[0].title}
            token={$swapState.payToken}
            amount={$swapState.payAmount}
            onAmountChange={handleAmountChange}
            onTokenSelect={() => handleTokenSelect("pay")}
            showPrice={false}
            slippage={$swapState.swapSlippage}
            disabled={false}
            panelType="pay"
          />
        </div>

        <div class="panel">
          <SwapPanel
            title={panels[1].title}
            token={$swapState.receiveToken}
            amount={$swapState.receiveAmount}
            onAmountChange={handleAmountChange}
            onTokenSelect={() => handleTokenSelect("receive")}
            showPrice={true}
            slippage={$swapState.swapSlippage}
            disabled={false}
            panelType="receive"
          />
        </div>

        <button
          class="switch-button"
          class:rotating={isRotating}
          on:click={handleReverseTokens}
          disabled={isProcessing}
          aria-label="Switch tokens"
        >
          <svg
            width="42"
            height="42"
            viewBox={ModernArrow.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            class="swap-arrow"
          >
            <g class="arrow-group">
              <circle class="arrow-circle" cx="24" cy="24" r="20" />
              <path class="arrow-path" d={ModernArrow.paths[1]} />
            </g>
          </svg>
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
</div>

{#if $swapState.showPayTokenSelector}
  <TokenSelector
    show={true}
    onSelect={(token) => handleTokenSelected(token, "pay")}
    onClose={() =>
      swapState.update((s) => ({ ...s, showPayTokenSelector: false }))}
    currentToken={$swapState.receiveToken}
  />
{/if}

{#if $swapState.showReceiveTokenSelector}
  <TokenSelector
    show={true}
    onSelect={(token) => handleTokenSelected(token, "receive")}
    onClose={() =>
      swapState.update((s) => ({ ...s, showReceiveTokenSelector: false }))}
    currentToken={$swapState.payToken}
  />
{/if}

{#if $swapState.showConfirmation}
<Portal target="body">
  <SwapConfirmation
    payToken={$swapState.payToken}
    payAmount={$swapState.payAmount}
    receiveToken={$swapState.receiveToken}
    receiveAmount={$swapState.receiveAmount}
    gasFees={$swapState.gasFees}
    lpFees={$swapState.lpFees}
    {userMaxSlippage}
    routingPath={$swapState.routingPath}
    onConfirm={handleSwap}
    onClose={() => {
      swapState.setShowConfirmation(false);
      swapState.update((state) => ({
        ...state,
        showConfirmation: false,
        isProcessing: false,
        error: null,
      }));
    }}
  />
</Portal>
{/if}

{#if $swapState.showBananaRain}
  <BananaRain />
{/if}

<SwapSuccessModal
  show={$swapState.showSuccessModal}
  {...$swapState.successDetails}
  onClose={() => swapState.setShowSuccessModal(false)}
/>

<style lang="postcss">
  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .mode-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    font-size: clamp(0.875rem, 1.5vw, 1rem);
  }

  .mode-selector-pixel {
    margin-bottom: 1.25rem;
  }

  .panels-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .panels-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .panel {
    position: relative;
    z-index: 1;
  }

  .switch-button {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    cursor: pointer;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.3s ease;
    backdrop-filter: blur(4px);
  }

  .switch-button:hover:not(:disabled) {
    transform: translate(-50%, -50%) scale(1.1);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .switch-button:active:not(:disabled) {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .swap-footer {
    margin-top: 4px;
  }

  .swap-arrow {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .arrow-group {
    transform-origin: center;
    transition: transform 0.3s ease;
  }

  .arrow-circle {
    fill: rgba(255, 255, 255, 0.05);
    stroke: rgba(255, 255, 255, 0.2);
    stroke-width: 1;
    transition: all 0.3s ease;
  }

  .arrow-path {
    fill: rgba(255, 255, 255, 0.9);
    transition: all 0.3s ease;
  }

  .switch-button:hover:not(:disabled) .arrow-circle {
    fill: rgba(255, 255, 255, 0.1);
    stroke: rgba(255, 255, 255, 0.3);
  }

  .switch-button:hover:not(:disabled) .arrow-path {
    fill: #ffffff;
  }

  .rotating .arrow-group {
    animation: rotateArrow 0.3s ease-in-out;
  }

  @keyframes rotateArrow {
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

  .arrow-path {
    transition: fill 0.2s ease;
  }

  :global([data-theme="minimal"]) .arrow-path {
    stroke-width: 2;
  }

  :global([data-theme="pixel"]) .arrow-path {
    stroke-width: 1;
  }
</style>
