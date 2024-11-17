<script lang="ts">
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import { SwapLogicService } from "$lib/services/swap/SwapLogicService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { walletStore } from "$lib/services/wallet/walletStore";
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

  let currentSwapId: string | null = null;
  let isProcessing = false;
  let isRotating = false;
  let rotationCount = 0;

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();

  export let initialFromToken: FE.Token | null = null;
  export let initialToToken: FE.Token | null = null;

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

  let swapMode = "normal";

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

    swapState.setIsProcessing(true);
    swapState.setError(null);

    try {
      // Create new swap entry and store its ID
      let swapId = swapStatusStore.addSwap({
        expectedReceiveAmount: $swapState.receiveAmount,
        lastPayAmount: $swapState.payAmount,
        payToken: $swapState.payToken,
        receiveToken: $swapState.receiveToken,
        payDecimals: Number(getTokenDecimals($swapState.payToken.canister_id).toString()),
      });

      currentSwapId = swapId;

      const success = await SwapService.executeSwap({
        swapId,
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
    } catch (err) {
      console.error("Swap execution error:", err);
      toastStore.error(err instanceof Error ? err.message : "Swap failed");
      return false;
    } finally {
      swapState.setPayAmount(null);
      swapState.setReceiveAmount(null);
      swapState.setIsProcessing(false);
      swapState.setShowConfirmation(false);
    }
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
    history.replaceState({}, '', url.toString());
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
    <div class="mode-selector">
      <Button
        variant="yellow"
        size="medium"
        state={swapMode === "normal" ? "selected" : "default"}
        onClick={() => (swapMode = "normal")}
        width="50%"
      >
        Normal
      </Button>
      <Button
        variant="yellow"
        size="medium"
        state="disabled"
        onClick={() => {}}
        width="50%"
      >
        Pro (Soon)
      </Button>
    </div>

    <div class="panels-container relative">
      {#each panels as panel (panel.id)}
        <div class="panel-wrapper">
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
        </div>
      {/each}

      <button
        class="switch-button"
        class:modern={$themeStore !== 'pixel'}
        on:click={handleReverseTokens}
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

<style lang="postcss">
  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0 0.5rem;
  }

  .mode-selector {
    display: flex;
    gap: 0.75rem;
    margin-top: clamp(1rem, 2vw, 1.5rem);
    font-size: clamp(0.875rem, 1.5vw, 1rem);
    @media (max-width: 768px) {
      display: none;
    }
  }

  .panels-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    position: relative;
    padding: clamp(1rem, 2vw, 1.5rem) 0;
  }

  .panel-wrapper {
    position: relative;
    z-index: 1;
    width: 100%;
  }

  .switch-button {
    position: absolute;
    left: 50%;
    top: 43%;
    transform: translate(-50%, -50%);
    z-index: 10;
    background: transparent;
    border: none;
    cursor: pointer;
    width: clamp(48px, 8vw, 56px);
    height: clamp(48px, 8vw, 56px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    transition: transform 0.3s ease;
  }

  .switch-button.modern {
    background: transparent;
    border-radius: 50%;
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

  .swap-arrow {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .swap-arrow.modern {
    width: 85%;
    height: 85%;
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

  .switch-button.modern:hover:not(:disabled) .arrow-background {
    fill: #ffe380;
  }

  .switch-button.modern:active:not(:disabled) .arrow-background {
    fill: #ffc107;
  }

  .switch-button.modern:disabled .arrow-background {
    fill: #e0e0e0;
  }

  .switch-button.modern:disabled .arrow-symbol {
    fill: #999999;
  }

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

  .arrow-path {
    transition: fill 0.2s ease;
  }

  :global([data-theme="minimal"]) .arrow-path {
    stroke-width: 2;
  }

  :global([data-theme="pixel"]) .arrow-path {
    stroke-width: 1;
  }

  .swap-footer {
    z-index: 1;
    margin-top: clamp(1rem, 2vw, 1.5rem);
    width: 100%;
  }
</style>
