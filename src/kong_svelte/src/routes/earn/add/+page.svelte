<script lang="ts">
  import { TokenService } from "$lib/services/tokens/TokenService";
  import { PoolService } from "$lib/services/pools/PoolService";
  import { onMount } from "svelte";
  import { tokenStore, formattedTokens } from "$lib/services/tokens/tokenStore";
  import { get } from "svelte/store";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import TokenSelectionModal from "$lib/components/liquidity/add_liquidity/TokenSelectionModal.svelte";
  import { debounce } from "lodash-es";
  import {
    parseTokenAmount,
    formatTokenAmount,
  } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { walletStore } from "$lib/services/wallet/walletStore";

  let token0: FE.Token | null = null;
  let token1: FE.Token | null = null;
  let amount0: string = "";
  let amount1: string = "";
  let loading = false;
  let error: string | null = null;
  let poolShare: string = "0";
  let token0Balance: string = "0";
  let token1Balance: string = "0";
  let isProcessingOutput = false;

  // Modal state variables
  let statusSteps = [
    { label: "Sending Tokens", completed: false },
    { label: "Updating LPs", completed: false },
    { label: "Success", completed: false },
  ];

  let showTokenModal = false;
  let activeTokenIndex: 0 | 1 = 0;
  let searchQuery = "";
  let tokens: FE.Token[] = [];

  let activeInput: 0 | 1 | null = null;
  let statusMessage: string = "";

  let previewMode = false;

  // Add confirmation modal state
  let showReview = false;

  // Handle URL parameters
  async function initializeFromParams() {
    const token0Id = $page.url.searchParams.get("token0");
    const token1Id = $page.url.searchParams.get("token1");

    if (token0Id || token1Id) {
      const allTokens = get(formattedTokens);

      if (token0Id) {
        const foundToken0 = allTokens.find((t) => t.canister_id === token0Id);
        if (foundToken0) {
          token0 = foundToken0;
        }
      }

      if (token1Id) {
        const foundToken1 = allTokens.find((t) => t.canister_id === token1Id);
        if (foundToken1) {
          token1 = foundToken1;
        }
      }
    }
  }

  onMount(async () => {
    try {
      await Promise.all([initializeFromParams(), tokenStore.loadBalances($walletStore?.account?.owner)]);
      tokens = get(formattedTokens);
    } catch (err) {
      console.error("Error initializing:", err);
      error = "Failed to initialize tokens";
    }
  });

  function handleTokenSelect(index: 0 | 1) {
    activeTokenIndex = index;
    searchQuery = ""; // Reset search query
    showTokenModal = true;
  }

  function closeModal() {
    showTokenModal = false;
    searchQuery = ""; // Reset search query when closing
  }

  function selectToken(token: FE.Token) {
    if (activeTokenIndex === 0) {
      token0 = token;
    } else {
      token1 = token;
    }
    closeModal();
    error = null;
  }

  // Debounced calculation to prevent excessive API calls
  const debouncedCalculate = debounce(async (amount: string, index: 0 | 1) => {
    if (!amount || isNaN(parseFloat(amount))) {
      if (index === 0) amount1 = "";
      else amount0 = "";
      return;
    }
    await calculateLiquidityAmount(amount, index);
  }, 300);

  function handleInput(index: 0 | 1, value: string) {
    if (index === 0) {
      amount0 = value;
    } else {
      amount1 = value;
    }
    activeInput = index;
    debouncedCalculate(value, index);
  }

  async function calculateLiquidityAmount(amount: string, index: 0 | 1) {
    if (!token0 || !token1) {
      error = "Please select both tokens.";
      return;
    }

    try {
      loading = true;
      error = null;
      isProcessingOutput = true;

      const balance0 = $tokenStore.balances[token0.canister_id];
      const balance1 = $tokenStore.balances[token1.canister_id];

      if (index === 0) {
        const requiredAmount = await PoolService.addLiquidityAmounts(
          token0.token,
          parseTokenAmount(amount, token0.decimals),
          token1.token,
        );

        const requiredAmount1 = requiredAmount.Ok.amount_1;

        // Check if token1 amount exceeds balance
        if (balance1.in_tokens - token1.fee < requiredAmount1) {
          // If it exceeds, calculate backwards from token1's max balance
          const reverseAmount = await PoolService.addLiquidityAmounts(
            token1.token,
            balance1.in_tokens - token1.fee,
            token0.token,
          );
          amount0 = formatTokenAmount(
            reverseAmount.Ok.amount_1,
            token0.decimals,
          ).toString();
          amount1 = formatTokenAmount(
            (balance1.in_tokens - token1.fee).toString(),
            token1.decimals,
          ).toString();
        } else {
          amount1 = formatTokenAmount(
            (requiredAmount1 - token1.fee).toString(),
            token1.decimals,
          ).toString();
        }
      } else {
        const requiredAmount = await PoolService.addLiquidityAmounts(
          token1.token,
          parseTokenAmount(amount, token1.decimals),
          token0.token,
        );

        const requiredAmount0 = requiredAmount.Ok.amount_1;

        // Check if token0 amount exceeds balance
        if (balance0.in_tokens - token0.fee < requiredAmount0) {
          // If it exceeds, calculate backwards from token0's max balance
          const reverseAmount = await PoolService.addLiquidityAmounts(
            token0.token,
            balance0.in_tokens - token0.fee,
            token1.token,
          );
          amount0 = formatTokenAmount(
            (balance0.in_tokens - token0.fee).toString(),
            token0.decimals,
          ).toString();
          amount1 = formatTokenAmount(
            reverseAmount.Ok.amount_1,
            token1.decimals,
          ).toString();
        } else {
          amount0 = formatTokenAmount(
            (requiredAmount0 - token0.fee).toString(),
            token0.decimals,
          ).toString();
        }
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
      isProcessingOutput = false;
    }
  }

  async function handleSubmit() {
    showReview = true;
  }

  function handleCancel() {
    showReview = false;
  }

  async function handleConfirm() {
    showReview = false;
    loading = true;
    error = null;
    previewMode = true;
    statusMessage = "Submitting liquidity request...";
    statusSteps = statusSteps.map((step) => ({ ...step, completed: false }));

    try {
      const params = {
        token_0: token0,
        amount_0: parseTokenAmount(amount0, token0.decimals),
        token_1: token1,
        amount_1: parseTokenAmount(amount1, token1.decimals),
      };

      const requestId = await PoolService.addLiquidity(params);

      // Poll for request status
      const checkStatus = async () => {
        try {
          const requestStatus = await PoolService.pollRequestStatus(requestId);
          updateStatusSteps(requestStatus.statuses);

          // Check for failure states first
          if (
            requestStatus.statuses.some(
              (s) =>
                s.toLowerCase().includes("failed") ||
                s.toLowerCase().includes("error"),
            )
          ) {
            loading = false;
            previewMode = false;
            error = requestStatus.statuses[requestStatus.statuses.length - 2];
            // Add failed status to steps
            statusSteps = statusSteps.map((step) => ({
              ...step,
              completed: false,
              failed: true,
            }));
            return;
          }

          if (requestStatus.statuses.includes("Success")) {
            loading = false;
            setTimeout(() => {
              previewMode = false;
              goto("/pools");
            }, 2000);
          } else {
            // Continue polling
            setTimeout(checkStatus, 2000);
          }
        } catch (err) {
          console.error("Error polling request status:", err);
          statusMessage = "Error polling request status: " + err.message;
          loading = false;
          error = err.message;
          previewMode = false;
          // Mark all incomplete steps as failed
          statusSteps = statusSteps.map((step) => ({
            ...step,
            failed: !step.completed,
          }));
        }
      };

      checkStatus(); // Start polling
    } catch (err) {
      console.error("Error adding liquidity:", err);
      error = err.message;
      loading = false;
      previewMode = false;
      // Mark all steps as failed
      statusSteps = statusSteps.map((step) => ({
        ...step,
        completed: false,
        failed: true,
      }));
    }
  }

  function updateStatusSteps(rawStatuses: string[]) {
    const stepsToMatch = {
      "Sending Tokens": [
        "Sending token 0",
        "Token 0 sent",
        "Sending token 1",
        "Token 1 sent",
      ],
      "Updating LPs": [
        "Updating liquidity pool",
        "Liquidity pool updated",
        "Updating user LP token amount",
        "User LP token amount updated",
      ],
      Success: ["Success"],
    };

    // Check for any failure states in the raw statuses
    const hasFailure = rawStatuses.some(
      (status) =>
        status.toLowerCase().includes("failed") ||
        status.toLowerCase().includes("error"),
    );

    // Update steps based on latest statuses
    statusSteps = statusSteps.map((step) => {
      const matches = stepsToMatch[step.label];
      const isCompleted = matches.every((match) =>
        rawStatuses.some((status) => status.includes(match)),
      );

      // Special case for "Sending Tokens"
      if (step.label === "Sending Tokens") {
        const token0Sent = rawStatuses.includes("Token 0 sent");
        const token1Sent = rawStatuses.includes("Token 1 sent");
        const token0Failed = rawStatuses.some(
          (s) => s.includes("Token 0") && s.includes("failed"),
        );
        const token1Failed = rawStatuses.some(
          (s) => s.includes("Token 1") && s.includes("failed"),
        );

        return {
          ...step,
          completed: token0Sent && token1Sent,
          failed: token0Failed || token1Failed,
        };
      }

      return {
        ...step,
        completed: isCompleted,
        failed: hasFailure && !isCompleted,
      };
    });
  }

  async function updateBalances() {
    if (!token0 || !token1) return;

    try {
      const balances = await TokenService.fetchBalances([token0, token1]);
      if (token0) {
        token0Balance =
          balances[token0.canister_id]?.in_tokens.toString() || "0";
      }
      if (token1) {
        token1Balance =
          balances[token1.canister_id]?.in_tokens.toString() || "0";
      }
    } catch (err) {
      console.error("Error fetching balances:", err);
    }
  }

  $: if (token0 || token1) {
    const params = new URLSearchParams();
    if (token0) params.set("token0", token0.canister_id);
    if (token1) params.set("token1", token1.canister_id);
    const newUrl = `/pools/add${params.toString() ? "?" + params.toString() : ""}`;
    window.history.replaceState(null, "", newUrl);
    updateBalances();
  }

  function getCurrentStep(): string {
    const currentStep = statusSteps.find((step) => !step.completed);
    return currentStep ? currentStep.label : "Success";
  }
</script>

<!-- Main content -->
<div class="mx-auto p-4 max-w-3xl w-full">
  <div
    class="min-w-3xl w-full flex flex-col justify-center p-4 md:p-6 space-y-8 mt-32"
  >
    <div
      class="bg-white dark:bg-emerald-900/70 dark:bg-opacity-80 dark:backdrop-blur-md rounded-2xl shadow-lg p-6 w-full"
    >
      <AddLiquidityForm
        {token0}
        {token1}
        {amount0}
        {amount1}
        {loading}
        {previewMode}
        {error}
        {statusSteps}
        {showReview}
        {token0Balance}
        {token1Balance}
        {getCurrentStep}
        onTokenSelect={handleTokenSelect}
        onInput={handleInput}
        onSubmit={handleSubmit}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {isProcessingOutput}
      />
    </div>
  </div>
</div>

<!-- Token selection modal -->
<TokenSelectionModal
  show={showTokenModal}
  {tokens}
  helperText={activeTokenIndex === 1
    ? "Only ICP and ckUSDT pairs are supported"
    : ""}
  bind:searchQuery
  onClose={closeModal}
  onSelect={selectToken}
/>
