<script lang="ts">
  import SwapPanel from "./swap_ui/SwapPanel.svelte";
  import TokenSelectorDropdown from "./swap_ui/TokenSelectorDropdown.svelte";
  import SwapConfirmation from "./swap_ui/SwapConfirmation.svelte";
  import Portal from "svelte-portal";
  import { Principal } from "@dfinity/principal";
  import { fade } from "svelte/transition";
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { SwapLogicService } from "$lib/services/swap/SwapLogicService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { auth } from "$lib/services/auth";
  import {
    getTokenDecimals,
    currentUserBalancesStore
  } from "$lib/stores/tokenStore";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapStatusStore } from "$lib/services/swap/swapStore";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { livePools } from "$lib/services/pools/poolStore";
  import SwapSuccessModal from "./swap_ui/SwapSuccessModal.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { browser } from "$app/environment";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { tick } from "svelte";
  import { SwapUrlService } from "$lib/services/swap/SwapUrlService";
  import { SwapButtonService } from "$lib/services/swap/SwapButtonService";
  import { 
    refreshBalances, 
  } from "$lib/stores/balancesStore";
  import { themeStore } from "$lib/stores/themeStore";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import SwapButton from "./swap_ui/SwapButton.svelte";
  import SwitchTokensButton from "./swap_ui/SwitchTokensButton.svelte";
  import WalletProvider from "$lib/components/wallet/WalletProvider.svelte";

  // Theme-specific styling data
  let theme = $derived(getThemeById($themeStore));
  
  // Swap button theme colors
  let primaryStart = $derived(theme.colors.primary || 'rgba(55, 114, 255, 0.95)');
  let primaryEnd = $derived(theme.colors.secondary || 'rgba(111, 66, 193, 0.95)');
  let errorStart = $derived('rgba(239, 68, 68, 0.9)'); // Fallback for error color
  let errorEnd = $derived('rgba(239, 68, 68, 0.8)'); // Fallback for errorDark color
  let processingStart = $derived('#3772ff'); // Fallback for info color
  let processingEnd = $derived('#4580ff'); // Fallback for infoLight color
  let buttonBorder = $derived(theme.colors.borderLight || 'rgba(255, 255, 255, 0.12)');
  let glowEffect = $derived('rgba(255, 255, 255, 0.2)'); // Fallback for highlight color
  
  // Types
  type PanelType = "pay" | "receive";
  interface PanelConfig {
    id: string;
    type: PanelType;
    title: string;
  }

  const PANELS: PanelConfig[] = [
    { id: "pay", type: "pay", title: "You Pay" },
    { id: "receive", type: "receive", title: "You Receive" },
  ];

  // Constants for dropdown positioning
  const DROPDOWN_WIDTH = 360; // Width of dropdown
  const MARGIN = 16; // Margin from edges
  const SEARCH_HEADER_HEIGHT = 56; // Height of search header

  // State
  let isProcessing = false;
  let isInitialized = false;
  let currentSwapId: string | null = null;
  let isQuoteLoading = false;
  let showSettings = false;
  let insufficientFunds = false;
  let hasValidPool = false;
  let skipNextUrlInitialization = false;
  let currentBalance: string | null = null;
  let showWalletProvider = false;

  // Function to calculate optimal dropdown position
  function getDropdownPosition(
    pos: { x: number; y: number; windowWidth: number } | null,
  ) {
    if (!pos) return { top: 0, left: 0 };

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

  // Reactive statement to call refreshTokenBalances when token or amount changes
  $effect(() => {
    if ($auth.account?.owner && ($swapState.payToken || $swapState.receiveToken)) {
      console.log('Token or auth state changed, refreshing balances');
      refreshBalances([$swapState.payToken, $swapState.receiveToken], $auth.account?.owner, false);
    } else {
      console.log('Resetting balance states - missing auth or tokens');
      currentBalance = null;
      insufficientFunds = false;
    }
  });

  let buttonText = $derived(
    (!$swapState.payAmount || $swapState.payAmount === "0") ? "Enter Amount" : 
    insufficientFunds ? "Insufficient Balance" :
    SwapButtonService.getButtonText($swapState, $settingsStore, isQuoteLoading, insufficientFunds, $auth)
  );

  let buttonDisabled = $derived(
    !$swapState.payAmount || $swapState.payAmount === "0" || 
    SwapButtonService.isButtonDisabled($swapState, insufficientFunds, isQuoteLoading, $auth)
  );

  // Replace initializeFromUrl with:
  async function initializeFromUrl() {
    await SwapUrlService.initializeFromUrl(
      $userTokens.tokens,
      fetchTokensByCanisterId,
      (token0, token1) => {
        swapState.update((state) => ({
          ...state,
          payToken: token0 || state.payToken,
          receiveToken: token1 || state.receiveToken,
          payAmount: "",
          receiveAmount: "",
          error: null,
        }));
      }
    );
  }

  // Replace updateTokenInURL with:
  function updateTokenInURL(param: "from" | "to", tokenId: string) {
    SwapUrlService.updateTokenInURL(param, tokenId);
  }

  // Update onMount to handle URL parameters
  onMount(async () => {
    if (browser) {
      if (skipNextUrlInitialization) {
        console.log("Skipping initializeFromUrl because we just reversed tokens.");
        skipNextUrlInitialization = false;
      } else {
        await initializeFromUrl();
      }
      await tick();
      // If no tokens were set via the URL, initialize default tokens
      if (!$swapState.payToken || !$swapState.receiveToken) {
        await swapState.initializeTokens(null, null);
      }
      isInitialized = true;
      console.log('Initialization complete');
      
      // Add a delayed balance refresh after initialization
      setTimeout(() => {
        if ($auth.account?.owner && ($swapState.payToken || $swapState.receiveToken)) {
          console.log('Running delayed balance refresh after initialization');
          refreshBalances([$swapState.payToken, $swapState.receiveToken], $auth.account?.owner, false);
        }
      }, 1500); // 1.5 second delay
    }
  });

  $effect(() => {
    if ($auth.isConnected) {
      settingsStore.initializeStore();
    }
  });

  // Modify the poolExists function to add more debugging
  function poolExists(
    payToken: FE.Token | null,
    receiveToken: FE.Token | null,
  ): boolean {
    if (!payToken || !receiveToken) {
      return false;
    }

    if ($livePools.length === 0) {
      return true; // Return true when pools aren't loaded yet
    }

    const exists = $livePools.some(
      (pool) =>
        (pool.symbol_0 === payToken.symbol &&
          pool.symbol_1 === receiveToken.symbol) ||
        (pool.symbol_0 === receiveToken.symbol &&
          pool.symbol_1 === payToken.symbol),
    );

    return exists;
  }

  async function handleSwapClick(): Promise<void> {
    if (!$auth.isConnected) {
      sidebarStore.toggleExpand();
      return;
    }

    if (!$swapState.payToken || !$swapState.receiveToken) return;

    swapState.update((state) => ({
      ...state,
      showConfirmation: true,
      isProcessing: false,
      error: null,
      showSuccessModal: false,
    }));
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
      swapState.update((state) => ({
        ...state,
        isProcessing: true,
        error: null,
      }));

      currentSwapId = swapStatusStore.addSwap({
        expectedReceiveAmount: $swapState.receiveAmount,
        lastPayAmount: $swapState.payAmount,
        payToken: $swapState.payToken,
        receiveToken: $swapState.receiveToken,
        payDecimals: Number(
          getTokenDecimals($swapState.payToken.canister_id).toString(),
        ),
      });

      const result = await SwapService.executeSwap({
        swapId: currentSwapId,
        payToken: $swapState.payToken,
        payAmount: $swapState.payAmount,
        receiveToken: $swapState.receiveToken,
        receiveAmount: $swapState.receiveAmount,
        userMaxSlippage: $settingsStore.max_slippage,
        backendPrincipal: Principal.fromText(KONG_BACKEND_CANISTER_ID),
        lpFees: $swapState.lpFees,
      });

      if (typeof result !== "bigint") {
        swapState.update((state) => ({
          ...state,
          isProcessing: false,
          error: "Swap failed",
        }));
        return false;
      }

      // Store the successful swap details and clear input amounts
      swapState.update((state) => ({
        ...state,
        successDetails: {
          payAmount: state.payAmount,
          payToken: state.payToken,
          receiveAmount: state.receiveAmount,
          receiveToken: state.receiveToken,
          principalId: $auth.account?.owner?.toString() || "",
        },
        // Clear input amounts but keep tokens selected
        payAmount: "",
        receiveAmount: "",
        isProcessing: false,
        showConfirmation: false,
      }));

      return true;
    } catch (error) {
      console.error("Swap execution failed:", error);
      swapState.update((state) => ({
        ...state,
        isProcessing: false,
        error: error.message || "Swap failed",
      }));
      return false;
    } finally {
      // Always reset processing state if the swap fails
      if (!$swapStatusStore[currentSwapId]?.details) {
        swapState.update((state) => ({
          ...state,
          isProcessing: false,
        }));
      }
    }
  }

  async function handleButtonAction(): Promise<void> {
    if (!$auth.isConnected) {
      console.log('User not connected, opening wallet provider');
      showWalletProvider = true;
      return;
    }

    if ($swapState.swapSlippage > $settingsStore.max_slippage) {
      showSettings = true;
      return;
    }

    if (insufficientFunds) {
      toastStore.error("Insufficient funds for this swap");
      return;
    }

    if (!$swapState.payToken || !$swapState.receiveToken) {
      toastStore.error("Please select tokens");
      return;
    }

    if (!$swapState.payAmount || $swapState.payAmount === "0") {
      toastStore.error("Please enter an amount");
      return;
    }

    await handleSwapClick();
  }


  async function handleAmountChange(event: CustomEvent) {
    const { value, panelType } = event.detail;

    if (panelType === "pay") {
      swapState.setPayAmount(value);
      await updateSwapQuote();
    } else {
      swapState.setReceiveAmount(value);
    }
  }

  // Update the handleTokenSelect function to be simpler
  function handleTokenSelect(panelType: PanelType) {
    if (panelType === "pay") {
      swapState.update((s) => ({
        ...s,
        showPayTokenSelector: true,
        error: null,
      }));
    } else {
      swapState.update((s) => ({
        ...s,
        showReceiveTokenSelector: true,
        error: null,
      }));
    }
  }

  // Modify handleReverseTokens to avoid referencing $swapState mid-update
  async function handleReverseTokens() {
    if (!isInitialized || $swapState.isProcessing) return;

    const currentPayToken = $swapState.payToken;
    const currentReceiveToken = $swapState.receiveToken;
    const tempPayAmount = $swapState.payAmount;
    const tempReceiveAmount = $swapState.receiveAmount;
    if (!currentPayToken || !currentReceiveToken) return;

    swapState.update((s) => ({
      ...s,
      payToken: currentReceiveToken,
      receiveToken: currentPayToken,
      error: null,
    }));

    await tick();
    await refreshBalances([$swapState.payToken, $swapState.receiveToken], $auth.account?.owner, false);

    // Update amounts and quote
    if (tempReceiveAmount && tempReceiveAmount !== "0") {
      swapState.setPayAmount(tempReceiveAmount);
    } else if (tempPayAmount) {
      swapState.setPayAmount(tempPayAmount);
    }
    await updateSwapQuote();

    // Before updating the URL, set the flag:
    skipNextUrlInitialization = true;

    if ($swapState.payToken?.canister_id && $swapState.receiveToken?.canister_id) {
      updateTokenInURL("from", $swapState.payToken.canister_id);
      updateTokenInURL("to", $swapState.receiveToken.canister_id);
    }
  }

  // Add a new state for quote loading
  let quoteUpdateTimeout: NodeJS.Timeout;

  async function updateSwapQuote() {
    const state = get(swapState);

    if (
      !state.payToken ||
      !state.receiveToken ||
      !hasValidPool ||
      !state.payAmount ||
      state.payAmount === "0"
    ) {
      swapState.update((s) => ({
        ...s,
        receiveAmount: "0",
        swapSlippage: 0,
      }));
      return;
    }

    // Clear any pending timeout
    if (quoteUpdateTimeout) {
      clearTimeout(quoteUpdateTimeout);
    }

    // Set loading state immediately
    isQuoteLoading = true;

    // Debounce the quote update
    quoteUpdateTimeout = setTimeout(async () => {
      try {
        const quote = await SwapService.getSwapQuote(
          state.payToken,
          state.receiveToken,
          state.payAmount,
        );

        swapState.update((s) => ({
          ...s,
          receiveAmount: quote.receiveAmount,
          swapSlippage: quote.slippage,
        }));
      } catch (error) {
        console.error("Error getting quote:", error);
        swapState.update((s) => ({
          ...s,
          receiveAmount: "0",
          swapSlippage: 0,
          error: "Failed to get quote",
        }));
      } finally {
        isQuoteLoading = false;
      }
    }, 600); // 600ms debounce
  }

  let previousPayAmount = "";
  let previousPayToken = null;
  let previousReceiveToken = null;

  $effect(() => {
    // Only update quote if relevant values have actually changed
    if (
      $swapState.payToken &&
      $swapState.receiveToken &&
      $swapState.payAmount &&
      ($swapState.payAmount !== previousPayAmount ||
        $swapState.payToken?.canister_id !== previousPayToken?.canister_id ||
        $swapState.receiveToken?.canister_id !==
          previousReceiveToken?.canister_id)
    ) {
      previousPayAmount = $swapState.payAmount;
      previousPayToken = $swapState.payToken;
      previousReceiveToken = $swapState.receiveToken;

      updateSwapQuote();
    }
  });

  // Add this function to handle resetting state
  function resetSwapState() {
    // Cancel any pending quote updates
    if (quoteUpdateTimeout) {
      clearTimeout(quoteUpdateTimeout);
    }

    // Reset quote loading state
    isQuoteLoading = false;

    // Immediately reset all relevant state
    swapState.update((state) => ({
      ...state,
      payAmount: "",
      receiveAmount: "",
      error: null,
      isProcessing: false,
      showConfirmation: false,
      swapSlippage: 0, // Reset slippage
      lpFees: null, // Reset fees
      routingPath: null, // Reset routing
    }));

    // Reset previous values to prevent unnecessary quote updates
    previousPayAmount = "";
    previousPayToken = null;
    previousReceiveToken = null;
  }

  // Add a reactive statement to check pool existence
  $effect(() => {
    hasValidPool = poolExists($swapState.payToken, $swapState.receiveToken);
  });

  // Add this near your other lifecycle hooks
  onDestroy(() => {
    resetSwapState();
  });

  // Add monitor for balance updates
  $effect(() => {
    if ($currentUserBalancesStore) {
      console.log('Balance store updated:', Object.keys($currentUserBalancesStore).length, 'tokens with balances');
      
      // If pay token exists, log its balance
      if ($swapState.payToken?.canister_id && $currentUserBalancesStore[$swapState.payToken.canister_id]) {
        console.log('Pay token balance:', {
          token: $swapState.payToken.symbol,
          balance: $currentUserBalancesStore[$swapState.payToken.canister_id].in_tokens.toString()
        });
      }
      
      // If receive token exists, log its balance
      if ($swapState.receiveToken?.canister_id && $currentUserBalancesStore[$swapState.receiveToken.canister_id]) {
        console.log('Receive token balance:', {
          token: $swapState.receiveToken.symbol,
          balance: $currentUserBalancesStore[$swapState.receiveToken.canister_id].in_tokens.toString()
        });
      }
    }
  });

  // Add effect to check if user has sufficient balance
  $effect(() => {
    const checkBalance = async () => {
      if ($auth.account?.owner && $swapState.payToken?.canister_id && $swapState.payAmount && $swapState.payAmount !== "0") {
        // Check if we have balance data for this token
        if ($currentUserBalancesStore && $currentUserBalancesStore[$swapState.payToken.canister_id]) {
          try {
            // Convert payAmount to a number that can be compared with the BigInt
            const payAmount = parseFloat($swapState.payAmount);
            
            // Get the BigInt balance and convert to number for comparison
            const balanceBigInt = $currentUserBalancesStore[$swapState.payToken.canister_id].in_tokens;
            
            // Get token decimals (this is async)
            const decimals = await getTokenDecimals($swapState.payToken.canister_id);
            const divisor = Math.pow(10, Number(decimals) || 8);
            const balanceAsNumber = Number(balanceBigInt) / divisor;
            
            // Update insufficient funds flag
            insufficientFunds = payAmount > balanceAsNumber;
            
            // Save the current balance for display
            currentBalance = balanceAsNumber.toString();
            
            console.log('Balance check:', {
              token: $swapState.payToken.symbol,
              requestedAmount: payAmount,
              availableBalance: balanceAsNumber,
              insufficientFunds,
              balanceBigInt: balanceBigInt.toString(),
              decimals
            });
          } catch (error) {
            console.error('Error calculating balance:', error);
            insufficientFunds = false;
          }
        } else {
          // If we don't have balance data yet, refresh balances
          refreshBalances([$swapState.payToken], $auth.account.owner, false);
          insufficientFunds = false; // Reset until we have data
        }
      } else {
        // Reset insufficient funds flag when no amount is entered
        insufficientFunds = false;
      }
    };
    
    // Execute the async function
    checkBalance();
  });
</script>

<div class="relative flex flex-col" in:fade={{ duration: 420 }}>
  <div class="relative flex flex-col gap-2 mb-2">
    <div class="relative flex flex-col gap-1 min-h-[240px]">
      <!-- Doge image peeking only for Win98 theme -->
      {#if theme.id === 'win98light'}
        <div class="absolute -top-[4.8rem] right-5 z-1 transform translate-x-1/4 select-none pointer-events-none">
          <img 
            src="/images/layingdoge.png" 
            alt="Doge peeking" 
            class="w-48 h-48 object-contain"
            style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"
          />
        </div>
      {/if}
      
      <div class="relative z-10">
        <SwapPanel
          title={PANELS[0].title}
          token={$swapState.payToken}
          amount={$swapState.payAmount}
          onAmountChange={handleAmountChange}
          onTokenSelect={() => handleTokenSelect("pay")}
          showPrice={false}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType="pay"
          otherToken={$swapState.receiveToken}
        />
      </div>

      <SwitchTokensButton 
        isDisabled={isProcessing}
        onSwitch={handleReverseTokens}
      />

      <div class="relative z-10">
        <SwapPanel
          title={PANELS[1].title}
          token={$swapState.receiveToken}
          amount={$swapState.receiveAmount}
          onAmountChange={handleAmountChange}
          onTokenSelect={() => handleTokenSelect("receive")}
          showPrice={true}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType="receive"
          otherToken={$swapState.payToken}
          isLoading={isQuoteLoading}
        />
      </div>
    </div>

    <div class="mt-1">
      <SwapButton 
        text={buttonText}
        isError={!!$swapState.error || $swapState.swapSlippage > $settingsStore.max_slippage || insufficientFunds}
        isProcessing={$swapState.isProcessing}
        isLoading={isQuoteLoading}
        isReady={!($swapState.error || $swapState.swapSlippage > $settingsStore.max_slippage || insufficientFunds) && !($swapState.isProcessing || isQuoteLoading)}
        showShineAnimation={buttonText === "SWAP"}
        disabled={buttonDisabled}
        onClick={handleButtonAction}
        primaryGradientStart={primaryStart}
        primaryGradientEnd={primaryEnd}
        errorGradientStart={errorStart}
        errorGradientEnd={errorEnd}
        processingGradientStart={processingStart}
        processingGradientEnd={processingEnd}
        borderColor={buttonBorder}
        glowColor={glowEffect}
        shine={glowEffect}
        readyGlowStart={primaryStart}
        readyGlowEnd={primaryEnd}
      />
    </div>
  </div>
</div>

{#if $swapState.tokenSelectorOpen}
  <Portal target="main">
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
            // First handle the token selection
            SwapLogicService.handleSelectToken(
              $swapState.tokenSelectorOpen,
              selectedToken,
            );

            // Then update the URL parameter based on which panel was selected
            if (browser) {
              if ($swapState.tokenSelectorOpen === "pay") {
                updateTokenInURL("from", selectedToken.canister_id);
              } else {
                updateTokenInURL("to", selectedToken.canister_id);
              }
            }

            swapState.closeTokenSelector();
          }}
          onClose={() => swapState.closeTokenSelector()}
          currentToken={$swapState.tokenSelectorOpen === "pay"
            ? $swapState.payToken
            : $swapState.receiveToken}
          otherPanelToken={$swapState.tokenSelectorOpen === "pay"
            ? $swapState.receiveToken
            : $swapState.payToken}
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
      userMaxSlippage={$settingsStore.max_slippage}
      routingPath={$swapState.routingPath}
      onConfirm={handleSwap}
      onClose={() => {
        swapState.setShowConfirmation(false);
      }}
      on:quoteUpdate={({ detail }) => {
        swapState.update((state) => ({
          ...state,
          receiveAmount: detail.receiveAmount,
        }));
      }}
    />
  </Portal>
{/if}

{#if $swapState.showSuccessModal}
  <SwapSuccessModal
    show={$swapState.showSuccessModal}
    payAmount={$swapState.successDetails?.payAmount || $swapState.payAmount}
    payToken={$swapState.successDetails?.payToken || $swapState.payToken}
    receiveAmount={$swapState.successDetails?.receiveAmount ||
      $swapState.receiveAmount}
    receiveToken={$swapState.successDetails?.receiveToken ||
      $swapState.receiveToken}
    onClose={() => {
      swapState.setShowSuccessModal(false);
      resetSwapState();
    }}
  />
{/if}

{#if showWalletProvider && browser}
  <Portal target="body">
    <WalletProvider 
      isOpen={showWalletProvider}
      onClose={() => showWalletProvider = false}
      onLogin={() => {
        showWalletProvider = false;
      }}
    />
  </Portal>
{/if}

<style scoped lang="postcss">
  /* No animation classes needed here anymore since they're now in the SwapButton component */
</style>
