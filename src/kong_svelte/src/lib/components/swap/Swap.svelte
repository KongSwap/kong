<script lang="ts">
  import SwapPanel from "./swap_ui/SwapPanel.svelte";
  import TokenSelectorDropdown from "./swap_ui/TokenSelectorDropdown.svelte";
  import SwapConfirmation from "./swap_ui/SwapConfirmation.svelte";
  import Portal from "svelte-portal";
  import { Principal } from "@dfinity/principal";
  import { onMount, onDestroy } from "svelte";
  import { swapState } from "$lib/stores/swapStateStore";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { auth } from "$lib/stores/auth";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapStatusStore } from "$lib/stores/swapStore";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { browser } from "$app/environment";
  import { tick } from "svelte";
  import { getSwapButtonText, isSwapButtonDisabled } from "./utils";
  import { refreshBalances } from "$lib/stores/balancesStore";
  import { themeId } from "$lib/stores/derivedThemeStore";
  import SwapButton from "./swap_ui/SwapButton.svelte";
  import SwitchTokensButton from "./swap_ui/SwitchTokensButton.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { disableBodyScroll, enableBodyScroll } from "$lib/utils/scrollUtils";

  // Import custom hooks
  import { useSwapQuote } from "$lib/hooks/useSwapQuote.svelte";
  import { useBalanceCheck } from "$lib/hooks/useBalanceCheck.svelte";
  import { useUrlTokens } from "$lib/hooks/useUrlTokens.svelte";
  import SwapInfoDisplay from "./swap_ui/SwapInfoDisplay.svelte";
  import SwapRoutingPath from "./swap_ui/SwapRoutingPath.svelte";

  // Types
  type PanelType = "pay" | "receive";

  let { widthFull = false } = $props<{ widthFull?: boolean }>();

  $inspect(widthFull);

  // Constants
  const PANELS = { PAY: "pay" as PanelType, RECEIVE: "receive" as PanelType };
  const DROPDOWN_WIDTH = 360;
  const MARGIN = 16;
  const SEARCH_HEADER_HEIGHT = 56;

  // Initialize hooks
  const {
    isQuoteLoading,
    updateSwapQuote,
    updateReverseQuote,
    cleanup: cleanupQuotes,
  } = useSwapQuote();
  const { insufficientFunds, checkBalance, getTokenDecimals } =
    useBalanceCheck();
  const { handleUrlTokenParams, lastProcessedSearchParams } = useUrlTokens();

  // State
  let isInitialized = $state(false);
  let currentSwapId: string | null = null;
  let hasValidPool = $state(false);
  let lastEditedPanel: PanelType | null = null;

  // Derived values
  let buttonText = $derived(
    !$auth.isConnected
      ? "Connect Wallet"
      : !$swapState.payAmount || $swapState.payAmount === "0"
        ? "Enter Amount"
        : insufficientFunds()
          ? "Insufficient Balance"
          : getSwapButtonText(
              $swapState,
              $settingsStore,
              isQuoteLoading(),
              insufficientFunds(),
              $auth,
            ),
  );

  let buttonDisabled = $derived(
    buttonText === "Connect Wallet"
      ? false
      : !$swapState.payAmount ||
          $swapState.payAmount === "0" ||
          isSwapButtonDisabled(
            $swapState,
            insufficientFunds(),
            isQuoteLoading(),
            $auth,
          ),
  );

  // Helper functions
  function getDropdownPosition(
    pos: { x: number; y: number; windowWidth: number } | null,
  ) {
    if (!pos) return { top: 0, left: 0 };
    let left = pos.x;
    if (left + DROPDOWN_WIDTH > pos.windowWidth - MARGIN) {
      left = Math.max(MARGIN, pos.x - DROPDOWN_WIDTH - 8);
    }
    const top = pos.y - SEARCH_HEADER_HEIGHT - 8;
    return { top, left };
  }

  function poolExists(
    payToken: Kong.Token | null,
    receiveToken: Kong.Token | null,
  ): boolean {
    if (!payToken || !receiveToken) return false;
    // Always return true to allow the backend to handle routing (including multi-hop swaps)
    return true;
  }

  function resetSwapState() {
    cleanupQuotes();
    swapState.update((state) => ({
      ...state,
      payAmount: "",
      receiveAmount: "",
      error: null,
      isProcessing: false,
      showConfirmation: false,
      swapSlippage: 0,
      lpFees: null,
      routingPath: null,
    }));
  }

  // Event handlers
  async function handleAmountChange(event: CustomEvent) {
    const { value, panelType } = event.detail;
    lastEditedPanel = panelType;

    if (panelType === PANELS.PAY) {
      swapState.setPayAmount(value);
      await updateSwapQuote(hasValidPool);
    } else {
      swapState.setReceiveAmount(value);
      await updateReverseQuote(hasValidPool);
    }
  }

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
    await refreshBalances(
      [$swapState.payToken, $swapState.receiveToken],
      $auth.account?.owner?.toString(),
      true,
    );

    // Update amounts and quote
    if (tempReceiveAmount && tempReceiveAmount !== "0") {
      swapState.setPayAmount(tempReceiveAmount);
    } else if (tempPayAmount) {
      swapState.setPayAmount(tempPayAmount);
    }
    await updateSwapQuote(hasValidPool);
  }

  async function handleSwapClick(): Promise<void> {
    if (!$auth.isConnected) {
      sidebarStore.toggleExpand();
      return;
    }

    if (!$swapState.payToken || !$swapState.receiveToken) return;

    // Delay the modal opening to allow the press effect to show
    setTimeout(() => {
      swapState.update((state) => ({
        ...state,
        showConfirmation: true,
        isProcessing: false,
        error: null,
        showSuccessModal: false,
      }));
    }, 200);
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
          (await getTokenDecimals($swapState.payToken.address)).toString(),
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
        if (
          $swapState.payAmount &&
          $swapState.payAmount !== "0" &&
          $swapState.payToken &&
          $swapState.receiveToken
        ) {
          handleSwapClick();
        }
      });
      return;
    }

    if ($swapState.swapSlippage > $settingsStore.max_slippage) {
      goto("/settings");
      return;
    }

    if (insufficientFunds()) {
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

  // Effects

  $effect(() => {
    if($swapState.showConfirmation) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }
  });

  $effect(() => {
    if (
      $auth.account?.owner &&
      ($swapState.payToken || $swapState.receiveToken)
    ) {
      refreshBalances(
        [$swapState.payToken, $swapState.receiveToken],
        $auth.account?.owner?.toString(),
        true,
      );
    }
  });

  $effect(() => {
    if ($auth.isConnected) {
      settingsStore.initializeStore();
    }
  });

  $effect(() => {
    hasValidPool = poolExists($swapState.payToken, $swapState.receiveToken);
  });

  $effect(() => {
    checkBalance(
      $auth.account?.owner,
      $swapState.payToken,
      $swapState.payAmount,
    );
  });

  $effect(() => {
    if (browser && isInitialized && $page.url.searchParams) {
      const searchParams = $page.url.searchParams;
      const currentSearchString = searchParams.toString();

      if (currentSearchString !== lastProcessedSearchParams()) {
        Promise.resolve().then(() => handleUrlTokenParams(searchParams));
      }
    }
  });

  // Quote update effect
  let previousPayAmount = "";
  let previousPayToken = null;
  let previousReceiveToken = null;

  $effect(() => {
    if (
      lastEditedPanel === PANELS.PAY &&
      $swapState.payToken &&
      $swapState.receiveToken &&
      $swapState.payAmount &&
      ($swapState.payAmount !== previousPayAmount ||
        $swapState.payToken?.address !== previousPayToken?.address ||
        $swapState.receiveToken?.address !== previousReceiveToken?.address)
    ) {
      previousPayAmount = $swapState.payAmount;
      previousPayToken = $swapState.payToken;
      previousReceiveToken = $swapState.receiveToken;
      updateSwapQuote(hasValidPool);
    }
  });

  // Lifecycle
  onMount(async () => {
    if (browser) {
      try {
        const initialSearchParams = new URL(window.location.href).searchParams;
        await handleUrlTokenParams(initialSearchParams);
        await tick();

        if (!$swapState.payToken || !$swapState.receiveToken) {
          await swapState.initializeTokens(null, null);
        }

        isInitialized = true;
      } catch (error) {
        console.error("Error during token initialization:", error);
        await swapState.initializeTokens(null, null);
        isInitialized = true;
      }
    }
  });

  onDestroy(() => {
    resetSwapState();
  });
</script>

<div
  class="relative flex flex-col w-full {widthFull
    ? '!max-w-none'
    : '!max-w-[max(32rem,500px)]'} mx-auto"
>
  <div class="relative flex flex-col gap-2 rounded-lg">
    <div class="relative flex flex-col min-h-[220px] sm:px-3 md:px-0">
      <!-- Doge image peeking only for Win98 theme -->
      {#if $themeId === "microswap"}
        <div
          class="absolute -top-[4.8rem] right-5 z-1 transform translate-x-1/4 select-none pointer-events-none"
        >
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
          title="Send"
          token={$swapState.payToken}
          amount={$swapState.payAmount}
          onAmountChange={handleAmountChange}
          showPrice={false}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType={PANELS.PAY}
        />
      </div>

      <div class="relative my-0.5">
        <SwitchTokensButton
          isDisabled={$swapState.isProcessing}
          onSwitch={handleReverseTokens}
        />
      </div>

      <div class="relative z-10">
        <SwapPanel
          title="Receive"
          token={$swapState.receiveToken}
          amount={$swapState.receiveAmount}
          onAmountChange={handleAmountChange}
          showPrice={true}
          slippage={$swapState.swapSlippage}
          disabled={false}
          panelType={PANELS.RECEIVE}
          isLoading={isQuoteLoading()}
        />
      </div>
    </div>

    <SwapRoutingPath
      routingPath={$swapState.routingPath}
      isLoading={isQuoteLoading()}
    />

    <SwapInfoDisplay
      payToken={$swapState.payToken}
      payAmount={$swapState.payAmount}
      receiveToken={$swapState.receiveToken}
      receiveAmount={$swapState.receiveAmount}
      priceImpact={$swapState.swapSlippage}
      gasFees={$swapState.gasFees}
      lpFees={$swapState.lpFees}
      isLoading={isQuoteLoading()}
    />

    <div class="mt-1 sm:px-3 md:px-0 rounded-lg">
      <SwapButton
        text={buttonText}
        isError={!!$swapState.error ||
          $swapState.swapSlippage > $settingsStore.max_slippage ||
          insufficientFunds()}
        isProcessing={$swapState.isProcessing}
        isLoading={isQuoteLoading()}
        disabled={buttonDisabled}
        onClick={handleButtonAction}
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
        style="left: {position.left}px; top: {position.top}px;"
      >
        <TokenSelectorDropdown
          show={true}
          onSelect={(selectedToken: Kong.Token) => {
            SwapService.handleSelectToken(
              $swapState.tokenSelectorOpen,
              selectedToken,
            );
            swapState.closeTokenSelector();
          }}
          onClose={() => swapState.closeTokenSelector()}
          currentToken={$swapState.tokenSelectorOpen === PANELS.PAY
            ? $swapState.payToken
            : $swapState.receiveToken}
          otherPanelToken={$swapState.tokenSelectorOpen === PANELS.PAY
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
      routingPath={$swapState.routingPath}
      onConfirm={handleSwap}
      onClose={() => swapState.setShowConfirmation(false)}
    />
  </Portal>
{/if}
