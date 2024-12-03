<script lang="ts">
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import { SwapLogicService } from "$lib/services/swap/SwapLogicService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { auth, selectedWalletId } from "$lib/services/auth";
  import { tokenStore, getTokenDecimals } from "$lib/services/tokens/tokenStore";
  import { getKongBackendPrincipal } from "$lib/utils/canisterIds";
  import { getButtonText } from "./utils";
  import SwapPanel from "$lib/components/swap/swap_ui/SwapPanel.svelte";
  import TokenSelectorDropdown from "$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte";
  import SwapConfirmation from "$lib/components/swap/swap_ui/SwapConfirmation.svelte";
  import BananaRain from "$lib/components/common/BananaRain.svelte";
  import SwapSuccessModal from "./swap_ui/SwapSuccessModal.svelte";
  import { settingsStore } from "$lib/services/settings/settingsStore";
  import { themeStore } from '$lib/stores/themeStore';
  import { get } from "svelte/store";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapStatusStore } from "$lib/services/swap/swapStore";
  import debounce from "lodash-es/debounce";
  import { replaceState } from "$app/navigation";
  import { writable } from "svelte/store";
  import { createEventDispatcher } from 'svelte';
  import Portal from 'svelte-portal';
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { walletsList } from "@windoge98/plug-n-play";
  import Modal from "$lib/components/common/Modal.svelte";
  import Settings from "$lib/components/settings/Settings.svelte";
  import { slide } from 'svelte/transition';

  let isProcessing = false;
  let rotationCount = 0;
  let isRotating = false;
  let currentSwapId: string | null = null;
  let payPanelRef: HTMLElement;

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
    tokenChange: { fromToken: FE.Token | null; toToken: FE.Token | null };
  }>();

  let previousMode = currentMode;
  let isTransitioning = false;

  const handleModeChange = (mode) => {
    if (mode === currentMode || isTransitioning) return;
    isTransitioning = true;
    previousMode = currentMode;
    setTimeout(() => {
      dispatch('modeChange', { mode });
      setTimeout(() => {
        isTransitioning = false;
      }, 300);
    }, 150);
  };

  $: userMaxSlippage = $settingsStore.max_slippage;

  onMount(() => {
    const init = async () => {
      swapState.initializeTokens(initialFromToken, initialToToken);
    };
    init();

    const swapSuccessHandler = (event: CustomEvent) => {
      SwapLogicService.handleSwapSuccess(event);
    };

    window.addEventListener("swapSuccess", swapSuccessHandler);
    return () => window.removeEventListener("swapSuccess", swapSuccessHandler);
  });

  let buttonText = '';

  // Add this helper function to get token balance
  function getTokenBalance(tokenId: string): string {
    if (!tokenId) return "0";
    const balance = $tokenStore.balances[tokenId]?.in_tokens || BigInt(0);
    const token = $tokenStore.tokens.find(t => t.canister_id === tokenId);
    if (!token) return "0";
    return (Number(balance) / Math.pow(10, token.decimals)).toString();
  }

  // Add reactive statement to check balance
  $: insufficientFunds = $swapState.payToken && $swapState.payAmount && 
      Number($swapState.payAmount) > Number(getTokenBalance($swapState.payToken.canister_id));

  // Update the buttonText reactive statement
  $: {
    if ($swapState.showSuccessModal) {
      buttonText = 'Swap';
    } else if ($swapState.isProcessing) {
      buttonText = 'Processing...';
    } else if ($swapState.error) {
      buttonText = `${$swapState.error}`;
    } else if (insufficientFunds) {
      buttonText = 'Insufficient Funds';
    } else if ($swapState.swapSlippage > userMaxSlippage) {
      buttonText = 'High Slippage - Click to Adjust';
    } else if (!$auth?.account?.owner) {
      buttonText = 'Click to Connect Wallet';
    } else if (!$swapState.payAmount) {
      buttonText = 'Enter Amount';
    } else {
      buttonText = 'Swap';
    }
  }

  function getButtonTooltip(owner: boolean | undefined, slippageTooHigh: boolean, error: string | null): string {
    if (!owner) {
      return 'Connect to trade';
    } else if (insufficientFunds) {
      const balance = getTokenBalance($swapState.payToken?.canister_id);
      return `Balance: ${balance} ${$swapState.payToken?.symbol}`;
    } else if (slippageTooHigh) {
      return `Slippage: ${$swapState.swapSlippage}% > ${userMaxSlippage}%`;
    } else if (error) {
      return error;
    } else {
      return 'Execute swap';
    }
  }

  const textAnimation = (node, { duration = 2000 }) => {
    return {
      duration,
      css: (t) => {
        const eased = Math.pow(t, 2);
        return `
          transform: scale(${eased});
          opacity: ${t};
        `;
      }
    };
  };

  async function handleSwapClick() {
    if (!$auth.isConnected) {
      // Open sidebar if wallet is not connected
      sidebarStore.toggleExpand();
      return;
    }

    if (!$swapState.payToken || !$swapState.receiveToken) return;

    // Reset all relevant state
    swapState.update((state) => ({
      ...state,
      showConfirmation: true,
      isProcessing: false,
      error: null,
      showSuccessModal: false,
    }));
  }

  async function handleSwap(): Promise<boolean> {
    if (!$swapState.payToken || !$swapState.receiveToken || !$swapState.payAmount || $swapState.isProcessing) {
      return false;
    }

    try {
      // Set initial processing state
      swapState.update(state => ({
        ...state,
        isProcessing: true,
        error: null,
        showConfirmation: false // Hide confirmation immediately when processing starts
      }));

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

      if (!success) {
        swapState.update(state => ({
          ...state,
          isProcessing: false,
          error: "Swap failed"
        }));
        return false;
      }

      return true;

    } catch (error) {
      console.error("Swap error:", error);
      swapState.update(state => ({
        ...state,
        isProcessing: false,
        error: error.message || "Unknown error"
      }));
      return false;
    }
  }

  async function handleAmountChange(event: CustomEvent) {
    const { value, panelType } = event.detail;

    if (panelType === "pay") {
      await swapState.setPayAmount(value);
      await updateSwapQuote();
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

  async function handleTokenSelected(token: FE.Token, panelType: PanelType) {    
    if (panelType === 'pay') {
      swapState.setPayToken(token);
    } else {
      swapState.setReceiveToken(token);
    }
    
    swapState.closeTokenSelector();
    await updateSwapQuote();
  }

  async function handleReverseTokens() {
    if ($swapState.isProcessing) return;
    
    isRotating = true;
    rotationCount++;
    
    const tempPayToken = $swapState.payToken;
    const tempPayAmount = $swapState.payAmount;
    const tempReceiveAmount = $swapState.receiveAmount;
    
    // Update tokens
    swapState.setPayToken($swapState.receiveToken);
    swapState.setReceiveToken(tempPayToken);
    
    // Set the new pay amount
    if (tempReceiveAmount && tempReceiveAmount !== "0") {
      await swapState.setPayAmount(tempReceiveAmount);
    } else if (tempPayAmount) {
      await swapState.setPayAmount(tempPayAmount);
    }
    
    // Update quote with reversed tokens
    await updateSwapQuote();
    
    // Update URL params
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

  let isModalOpen = false;
  let isSettingsModalOpen = false;

  async function handleButtonAction() {
    if (!$auth.isConnected) {
      // If no wallet is selected, select the first available one
      if (!$selectedWalletId) {
        const firstWallet = walletsList[0];
        if (firstWallet) {
          selectedWalletId.set(firstWallet.id);
          localStorage.setItem("kongSelectedWallet", firstWallet.id);
        }
      }
      
      // Open sidebar and attempt connection
      sidebarStore.toggleExpand();
      if ($selectedWalletId) {
        try {
          await auth.connect($selectedWalletId);
        } catch (error) {
          console.error("Failed to connect wallet:", error);
        }
      }
      return;
    }

    if (insufficientFunds) {
      toastStore.error('Insufficient funds for this swap');
      return;
    }

    if ($swapState.swapSlippage > userMaxSlippage) {
      isSettingsModalOpen = true;
      return;
    }

    handleSwapClick();
  }

  // Constants for dropdown positioning
  const DROPDOWN_HEIGHT = 400; // Approximate max height of dropdown
  const DROPDOWN_WIDTH = 360;  // Width of dropdown
  const MARGIN = 16;          // Margin from edges

  // Function to calculate optimal dropdown position
  function getDropdownPosition(pos: any) {
    if (!pos) return { top: 0, left: 0 };

    const SEARCH_HEADER_HEIGHT = 56; // Height of search header
    
    // Position dropdown to the right of the button
    let left = pos.x;
    
    // If it would overflow right edge, position to the left of the button instead
    if (left + DROPDOWN_WIDTH > pos.windowWidth - MARGIN) {
      left = Math.max(MARGIN, pos.x - DROPDOWN_WIDTH - 8);
    }

    // Align the first token item with the button by offsetting the search header height
    const top = pos.y - SEARCH_HEADER_HEIGHT - 8; // 8px for the padding of first token

    return { top, left };
  }

  // Update arrow configurations
  const ModernArrow = {
    viewBox: "0 0 48 48",
    paths: [
      "M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4 4 12.954 4 24s8.954 20 20 20z",
      // Inner design - arrows
      "M24 16l8 8H16l8-8z M24 32l-8-8h16l-8 8z"
    ]
  };

  const PixelArrow = {
    viewBox: "0 0 35 42",
    path: "M0.5 26.8824V27.3824H1H2.85294V29.2353V29.7353H3.35294H5.20588V31.5882V32.0882H5.70588H7.55882V33.9412V34.4412H8.05882H9.91177V36.2941V36.7941H10.4118H12.2647V38.6471V39.1471H12.7647H14.6176V41V41.5H15.1176H19.8235H20.3235V41V39.1471H22.1765H22.6765V38.6471V36.7941H24.5294H25.0294V36.2941V34.4412H26.8824H27.3824V33.9412V32.0882H29.2353H29.7353V31.5882V29.7353H31.5882H32.0882V29.2353V27.3824H33.9412H34.4412V26.8824V24.5294V24.0294H33.9412H25.0294V3.35294V2.85294H24.5294H22.6765V1V0.5H22.1765H12.7647H12.2647V1V2.85294H10.4118H9.91177V3.35294V24.0294H1H0.5V24.5294V26.8824Z"
  };

  // Add a new state for quote loading
  let isQuoteLoading = false;

  // Update the updateSwapQuote function
  async function updateSwapQuote() {
    const state = get(swapState);
    
    if (!state.payToken || !state.receiveToken || !state.payAmount || state.payAmount === "0") {
      swapState.update(s => ({
        ...s,
        receiveAmount: "0",
        swapSlippage: 0
      }));
      return;
    }

    try {
      isQuoteLoading = true; // Use separate loading state for quotes
      
      const quote = await SwapService.getSwapQuote(
        state.payToken,
        state.receiveToken,
        state.payAmount
      );
      
      swapState.update(s => ({
        ...s,
        receiveAmount: quote.receiveAmount,
        swapSlippage: quote.slippage,
      }));
    } catch (error) {
      console.error("Error getting quote:", error);
      swapState.update(s => ({
        ...s,
        receiveAmount: "0",
        swapSlippage: 0,
        error: "Failed to get quote"
      }));
    } finally {
      isQuoteLoading = false;
    }
  }

  // Add reactive statement to update quote when tokens change
  $: if ($swapState.payToken && $swapState.receiveToken && $swapState.payAmount) {
    updateSwapQuote();
  }

  function handleSuccessModalClose() {
    swapState.update(state => ({
      ...state,
      showSuccessModal: false,
      isProcessing: false,
      error: null,
      // Reset other relevant states
      payAmount: '',
      receiveAmount: '',
    }));
  }

  // Add reactive variables for token changes
  $: fromToken = $swapState.payToken;
  $: toToken = $swapState.receiveToken;

  // Watch for token changes and dispatch event
  $: {
    if ($swapState.payToken || $swapState.receiveToken) {
      dispatch('tokenChange', {
        fromToken: $swapState.payToken,
        toToken: $swapState.receiveToken
      });
    }
  }
</script>

<!-- Template content -->
<div class="swap-container">
  <div class="swap-wrapper">
    <div class="swap-container" in:fade={{ duration: 420 }}>
      <div class="mode-selector">
        <div class="mode-selector-background" style="transform: translateX({currentMode === 'pro' ? '100%' : '0'})"></div>
        <button
          class="mode-button"
          class:selected={currentMode === "normal"}
          class:transitioning={isTransitioning && previousMode === "pro"}
          on:click={() => handleModeChange('normal')}
        >
          <span class="mode-text">Normal</span>
        </button>
        <button
          class="mode-button"
          class:selected={currentMode === "pro"}
          class:transitioning={isTransitioning && previousMode === "normal"}
          on:click={() => handleModeChange('pro')}
        >
          <span class="mode-text">Pro</span>
        </button>
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

          <button
            class="switch-button"
            class:disabled={isProcessing}
            class:rotating={isRotating}
            on:click={handleReverseTokens}
            disabled={isProcessing}
          >
            <div class="switch-button-inner">
              <svg
                class="switch-icon"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7.5 3.5L4.5 6.5L7.5 9.5M4.5 6.5H16.5C18.71 6.5 20.5 8.29 20.5 10.5C20.5 11.48 20.14 12.37 19.55 13.05M16.5 20.5L19.5 17.5L16.5 14.5M19.5 17.5H7.5C5.29 17.5 3.5 15.71 3.5 13.5C3.5 12.52 3.86 11.63 4.45 10.95"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </button>

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
        </div>

        <div class="swap-footer">
          <button
            class="swap-button"
            class:error={$swapState.error || ($swapState.swapSlippage > userMaxSlippage) || insufficientFunds}
            class:processing={$swapState.isProcessing}
            class:ready={!$swapState.error && $swapState.swapSlippage <= userMaxSlippage && !insufficientFunds}
            on:click={handleButtonAction}
            title={getButtonTooltip($auth?.account?.owner, $swapState.swapSlippage > userMaxSlippage, $swapState.error)}
          >
            <div class="button-content">
              {#if $swapState.isProcessing}
                <div class="loading-spinner" />
              {/if}
              <span class="button-text" class:warning={insufficientFunds || $swapState.swapSlippage > userMaxSlippage}>
                {buttonText}
              </span>
            </div>
            <div class="button-glow" />
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

{#if $swapState.tokenSelectorOpen}
  <Portal target="body">
    {#if $swapState.tokenSelectorPosition}
      {@const position = getDropdownPosition($swapState.tokenSelectorPosition)}
      <div 
        class="fixed z-50 origin-left"
        style="
          left: {position.left}px; 
          top: {position.top}px;
        "
      >
        <TokenSelectorDropdown
          show={true}
          onSelect={(selectedToken) => {
            SwapLogicService.handleSelectToken($swapState.tokenSelectorOpen, selectedToken);
            swapState.closeTokenSelector();
          }}
          onClose={() => swapState.closeTokenSelector()}
          currentToken={$swapState.tokenSelectorOpen === 'pay' ? $swapState.payToken : $swapState.receiveToken}
        />
      </div>
    {/if}
  </Portal>
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
  onClose={handleSuccessModalClose}
/>

{#if isSettingsModalOpen}
  <Portal target="body">
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={() => (isSettingsModalOpen = false)}
      title="Slippage Settings"
    >
      <Settings />
    </Modal>
  </Portal>
{/if}

<style lang="postcss">
  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .mode-selector {
    position: relative;
    display: flex;
    gap: 1px;
    margin-bottom: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .mode-selector-background {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(50% - 1px);
    height: calc(100% - 4px);
    background: linear-gradient(135deg, 
      rgba(55, 114, 255, 0.15), 
      rgba(55, 114, 255, 0.2)
    );
    border-radius: 12px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }

  .mode-button {
    position: relative;
    z-index: 1;
    flex: 1;
    padding: 6px 12px;
    border: none;
    border-radius: 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-text {
    position: relative;
    z-index: 2;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .mode-button:hover:not(.selected) .mode-text {
    color: rgba(255, 255, 255, 0.9);
  }

  .mode-button.selected .mode-text {
    color: rgba(255, 255, 255, 1);
    font-weight: 600;
  }

  .mode-button.transitioning .mode-text {
    transform: scale(0.95);
  }

  .button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  .button-text {
    @apply text-white font-semibold text-xl;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    min-width: 140px;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .swap-button {
    @apply relative overflow-hidden;
    @apply w-full py-4 px-6;
    @apply transition-all duration-200 ease-out;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    margin-top: 4px;
    background: linear-gradient(135deg, 
      rgba(55, 114, 255, 0.95) 0%, 
      rgba(69, 128, 255, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 6px rgba(55, 114, 255, 0.2);
    transform: translateY(0);
    min-height: 64px;
    border-radius: 16px;
  }

  .swap-button:hover:not(:disabled) {
    background: linear-gradient(135deg, 
      rgba(85, 134, 255, 1) 0%, 
      rgba(99, 148, 255, 1) 100%
    );
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 
      0 4px 12px rgba(55, 114, 255, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .swap-button:active:not(:disabled) {
    transform: translateY(0);
    background: linear-gradient(135deg, 
      rgba(45, 104, 255, 1) 0%, 
      rgba(59, 118, 255, 1) 100%
    );
    box-shadow: 0 2px 4px rgba(55, 114, 255, 0.2);
    transition-duration: 0.1s;
  }

  .button-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0) 70%
    );
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .swap-button:hover .button-glow {
    opacity: 1;
  }

  .swap-button.error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.8) 100%);
    box-shadow: none;
    border: none;
  }

  .swap-button.error:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(239, 68, 68, 1) 0%, rgba(239, 68, 68, 0.9) 100%);
    box-shadow: none;
  }

  .swap-button.processing {
    background: linear-gradient(135deg, #3772ff 0%, #4580ff 100%);
    cursor: wait;
    opacity: 0.8;
  }

  .button-content {
    @apply relative z-10 flex items-center justify-center gap-2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .button-text {
    @apply text-white font-semibold;
    font-size: 1.125rem;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 140px;
    text-align: center;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  }

  .loading-spinner {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .button-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .swap-button:hover .button-glow {
    opacity: 1;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Add a subtle pulse animation for processing state */
  @keyframes pulse {
    0% { opacity: 0.8; }
    50% { opacity: 0.6; }
    100% { opacity: 0.8; }
  }

  .swap-button.processing {
    animation: pulse 2s infinite ease-in-out;
  }

  .switch-button {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    cursor: pointer;
    padding: 0;
    margin: 0;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: #1C2333;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .switch-button:hover:not(.disabled) {
    background: #252B3D;
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .switch-button:active:not(.disabled) {
    transform: translate(-50%, -50%) scale(0.95);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .switch-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #1C2333;
  }

  .switch-button-inner {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .switch-button.rotating .switch-button-inner {
    transform: rotate(180deg);
  }

  .switch-icon {
    transition: all 0.2s ease;
    opacity: 0.9;
    width: 24px;
    height: 24px;
    color: currentColor;
  }

  .switch-button:hover:not(.disabled) .switch-icon {
    transform: scale(1.1);
    opacity: 1;
  }

  .panels-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  .panels-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 240px;
  }

  .panel {
    position: relative;
    z-index: 1;
  }

  /* Add these new styles for enhanced button text */
  .button-text {
    @apply text-white font-semibold text-base;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    gap: 6px;
    
    /* Add subtle text shadow for better contrast */
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* Add subtle bounce animation for the emoji */
  @keyframes subtle-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  .button-text :first-child {
    animation: subtle-bounce 2s infinite ease-in-out;
  }

  .swap-button-text {
    @apply text-white font-semibold;
    font-size: 24px !important; /* Using !important to ensure it takes precedence */
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 140px;
    text-align: center;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  }

  .swap-button.error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.8) 100%);
    box-shadow: none;
  }

  .button-text.warning {
    font-weight: 600;
  }
</style>
