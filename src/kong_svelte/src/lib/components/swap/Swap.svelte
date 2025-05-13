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
  import { auth } from "$lib/stores/auth";
  import {
    getTokenDecimals,
    currentUserBalancesStore
  } from "$lib/stores/tokenStore";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapStatusStore } from "$lib/stores/swapStore";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { livePools } from "$lib/stores/poolStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { browser } from "$app/environment";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { tick } from "svelte";
  import { SwapButtonService } from "$lib/services/swap/SwapButtonService";
  import { 
    refreshBalances, 
  } from "$lib/stores/balancesStore";
  import {
    themeId,
    primaryColor,
    secondaryColor,
    errorColorStart,
    errorColorEnd,
    processingColorStart,
    processingColorEnd,
    buttonBorderColor,
    glowEffectColor
  } from "$lib/stores/derivedThemeStore";
  import SwapButton from "./swap_ui/SwapButton.svelte";
  import SwitchTokensButton from "./swap_ui/SwitchTokensButton.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  
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
  let isInitialized = $state(false);
  let currentSwapId: string | null = null;
  let isQuoteLoading = $state(false);
  let insufficientFunds = $state(false);
  let hasValidPool = $state(false);
  let lastProcessedSearchParams = $state<string | null>(null);

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
      refreshBalances([$swapState.payToken, $swapState.receiveToken], $auth.account?.owner, true);
    } else {
      console.warn('Resetting balance states - missing auth or tokens');
      insufficientFunds = false;
    }
  });

  let buttonText = $derived(
    !$auth.isConnected ? "Connect Wallet" :
    (!$swapState.payAmount || $swapState.payAmount === "0") ? "Enter Amount" : 
    insufficientFunds ? "Insufficient Balance" :
    SwapButtonService.getButtonText($swapState, $settingsStore, isQuoteLoading, insufficientFunds, $auth)
  );

  let buttonDisabled = $derived(
    // Never disable the button when it says "Connect Wallet"
    buttonText === "Connect Wallet" ? false :
    // Otherwise use normal disable logic
    !$swapState.payAmount || $swapState.payAmount === "0" || 
    SwapButtonService.isButtonDisabled($swapState, insufficientFunds, isQuoteLoading, $auth)
  );

  // More direct token lookup by canister ID
  async function findTokenByCanisterId(canisterId: string): Promise<Kong.Token | null> {
    if (!canisterId) return null;
    
    // First check in userTokens
    if ($userTokens.tokens && $userTokens.tokens.length > 0) {
      const token = $userTokens.tokens.find(t => t.address === canisterId);
      if (token) return token;
    }
    
    // If not found, try to fetch it
    try {
      // Wrap canisterId in an array to match the expected parameter type
      const tokens = await fetchTokensByCanisterId([canisterId]);
      if (tokens && tokens.length > 0) {
        return tokens[0];
      }
    } catch (error) {
      console.error(`Error fetching token ${canisterId}:`, error);
    }
    
    return null;
  }

  // Refactored function to process URL parameters
  async function handleUrlTokenParams(searchParams: URLSearchParams) {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (!fromParam && !toParam) return; // Nothing to do if no params

    // Wait for user tokens if necessary
    let attempts = 0;
    while ((!$userTokens.tokens || $userTokens.tokens.length === 0) && attempts < 5) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }

    const currentPayTokenId = $swapState.payToken?.address;
    const currentReceiveTokenId = $swapState.receiveToken?.address;

    // Find tokens only if params exist and are different from current state
    const [fromToken, toToken] = await Promise.all([
      (fromParam && fromParam !== currentPayTokenId) ? findTokenByCanisterId(fromParam) : Promise.resolve($swapState.payToken),
      (toParam && toParam !== currentReceiveTokenId) ? findTokenByCanisterId(toParam) : Promise.resolve($swapState.receiveToken)
    ]);

    const newPayToken = fromParam ? (await findTokenByCanisterId(fromParam)) : $swapState.payToken;
    const newReceiveToken = toParam ? (await findTokenByCanisterId(toParam)) : $swapState.receiveToken;

    // Update state only if tokens actually changed
    if (newPayToken?.address !== currentPayTokenId || newReceiveToken?.address !== currentReceiveTokenId) {
      console.log('Updating tokens from URL params:', { fromParam, toParam, newPayToken, newReceiveToken });
      swapState.update(state => ({
        ...state,
        payToken: newPayToken || state.payToken, // Keep existing if lookup failed
        receiveToken: newReceiveToken || state.receiveToken, // Keep existing if lookup failed
        payAmount: "", // Reset amounts when tokens change via URL
        receiveAmount: "",
        error: null
      }));
      await tick(); // Ensure state updates before potential balance refresh or quote update
      // Resetting quote is handled by the $effect watching payAmount/tokens

      // Update the tracker *after* successful processing
      lastProcessedSearchParams = searchParams.toString();
    } else {
      console.log('Token lookup resulted in no change.');
      // Still update the tracker even if no state change occurred, 
      // to prevent reprocessing the same unchanged params.
      lastProcessedSearchParams = searchParams.toString();
    }
  }

  // Update onMount with direct URL token handling
  onMount(async () => {
    if (browser) {
      try {
        console.debug('Swap.svelte onMount: Processing initial URL params.');
        // Process initial URL params
        const initialSearchParams = new URL(window.location.href).searchParams;
        await handleUrlTokenParams(initialSearchParams);
        // Set the initial last processed params after mount processing
        lastProcessedSearchParams = initialSearchParams.toString();

        await tick();
        
        // If no tokens were set (or couldn't be found from URL), initialize default tokens
        if (!$swapState.payToken || !$swapState.receiveToken) {
          await swapState.initializeTokens(null, null);
        }
        
        isInitialized = true;
      } catch (error) {
        console.error('Error during token initialization:', error);
        // Fallback to default tokens
        await swapState.initializeTokens(null, null);
        isInitialized = true;
      }
    }
  });

  // Add effect to react to page URL changes
  $effect(() => {
    if (browser && isInitialized && $page.url.searchParams) {
      const searchParams = $page.url.searchParams;
      const currentSearchString = searchParams.toString();
      
      // Only run if the search string has actually changed
      if (currentSearchString !== lastProcessedSearchParams) {
        console.log('Swap.svelte $effect: URL search params changed, processing:', currentSearchString);
        Promise.resolve().then(() => handleUrlTokenParams(searchParams));
      } else {
        // Optional: Log that we skipped due to unchanged params
        // console.log('Swap.svelte $effect: URL search params unchanged, skipping processing:', currentSearchString);
      }
    }
  });

  $effect(() => {
    if ($auth.isConnected) {
      settingsStore.initializeStore();
    }
  });

  // Modify the poolExists function to add more debugging
  function poolExists(
    payToken: Kong.Token | null,
    receiveToken: Kong.Token | null,
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
          getTokenDecimals($swapState.payToken.address).toString(),
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

      resetSwapState();
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
      walletProviderStore.open(() => {
        // After successful connection, we can attempt the action again if needed
        if ($swapState.payAmount && $swapState.payAmount !== "0" && 
            $swapState.payToken && $swapState.receiveToken) {
          handleSwapClick();
        }
      });
      return;
    }

    if ($swapState.swapSlippage > $settingsStore.max_slippage) {
      goto('/settings');
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
    await refreshBalances([$swapState.payToken, $swapState.receiveToken], $auth.account?.owner, true);

    // Update amounts and quote
    if (tempReceiveAmount && tempReceiveAmount !== "0") {
      swapState.setPayAmount(tempReceiveAmount);
    } else if (tempPayAmount) {
      swapState.setPayAmount(tempPayAmount);
    }
    await updateSwapQuote();
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
        // Get the most up-to-date state inside the timeout callback
        const currentState = get(swapState);
        
        // Verify the state is still valid before making the API call
        if (
          !currentState.payToken ||
          !currentState.receiveToken ||
          !hasValidPool ||
          !currentState.payAmount ||
          currentState.payAmount === "0"
        ) {
          swapState.update((s) => ({
            ...s,
            receiveAmount: "0",
            swapSlippage: 0,
          }));
          isQuoteLoading = false;
          return;
        }
        
        const quote = await SwapService.getSwapQuote(
          currentState.payToken,
          currentState.receiveToken,
          currentState.payAmount,
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
        $swapState.payToken?.address !== previousPayToken?.address ||
        $swapState.receiveToken?.address !==
          previousReceiveToken?.address)
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

  // Add effect to check if user has sufficient balance
  $effect(() => {
    const checkBalance = async () => {
      if ($auth.account?.owner && $swapState.payToken?.address && $swapState.payAmount && $swapState.payAmount !== "0") {
        // Check if we have balance data for this token
        if ($currentUserBalancesStore && $currentUserBalancesStore[$swapState.payToken.address]) {
          try {
            // Convert payAmount to a number that can be compared with the BigInt
            const payAmount = parseFloat($swapState.payAmount);
            
            // Get the BigInt balance and convert to number for comparison
            const balanceBigInt = $currentUserBalancesStore[$swapState.payToken.address].in_tokens;
            
            // Get token decimals (this is async)
            const decimals = await getTokenDecimals($swapState.payToken.address);
            const divisor = Math.pow(10, Number(decimals) || 8);
            const balanceAsNumber = Number(balanceBigInt) / divisor;
            
            // Update insufficient funds flag
            insufficientFunds = payAmount > balanceAsNumber;
          } catch (error) {
            console.error('Error calculating balance:', error);
            insufficientFunds = false;
          }
        } else {
          // If we don't have balance data yet, refresh balances
          refreshBalances([$swapState.payToken], $auth.account.owner, true);
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

<div class="relative flex flex-col w-full max-w-xl mx-auto" in:fade={{ duration: 420 }}>
  <div class="relative flex flex-col gap-2 mb-2">
    <div class="relative flex flex-col gap-1 min-h-[240px] px-3 md:px-0">
      <!-- Doge image peeking only for Win98 theme -->
      {#if $themeId === 'microswap'}
        <div class="absolute -top-[4.8rem] right-5 z-1 transform translate-x-1/4 select-none pointer-events-none">
          <img 
            src="/images/layingdoge.webp" 
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
          showPrice={false}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType="pay"
        />
      </div>

      <SwitchTokensButton 
        isDisabled={$swapState.isProcessing}
        onSwitch={handleReverseTokens}
      />

      <div class="relative z-10">
        <SwapPanel
          title={PANELS[1].title}
          token={$swapState.receiveToken}
          amount={$swapState.receiveAmount}
          onAmountChange={handleAmountChange}
          showPrice={true}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType="receive"
          isLoading={isQuoteLoading}
        />
      </div>
    </div>

    <div class="mt-1 px-3 md:px-0">
      <SwapButton 
        text={buttonText}
        isError={!!$swapState.error || $swapState.swapSlippage > $settingsStore.max_slippage || insufficientFunds}
        isProcessing={$swapState.isProcessing}
        isLoading={isQuoteLoading}
        showShineAnimation={buttonText === "SWAP"}
        disabled={buttonDisabled}
        onClick={handleButtonAction}
        primaryGradientStart={$primaryColor}
        primaryGradientEnd={$secondaryColor}
        errorGradientStart={$errorColorStart}
        errorGradientEnd={$errorColorEnd}
        processingGradientStart={$processingColorStart}
        processingGradientEnd={$processingColorEnd}
        borderColor={$buttonBorderColor}
        glowColor={$glowEffectColor}
        shine={$glowEffectColor}
        readyGlowStart={$primaryColor}
        readyGlowEnd={$secondaryColor}
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
      onConfirm={handleSwap}
      onClose={() => {
        swapState.setShowConfirmation(false);
      }}
    />
  </Portal>
{/if}

<style scoped lang="postcss">
  /* No animation classes needed here anymore since they're now in the SwapButton component */
</style>
