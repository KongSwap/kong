<script lang="ts">
    import { TokenService } from "$lib/services/tokens/TokenService";
    import { PoolService } from "$lib/services/pools/PoolService";
    import { onMount } from "svelte";
    import { tokenStore, loadBalances, formattedTokens } from "$lib/services/tokens/tokenStore";
    import { get } from "svelte/store";
    import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
    import { debounce } from "lodash-es";
    import { parseTokenAmount, formatBalance } from "$lib/utils/numberFormatUtils";
    import { goto, replaceState } from '$app/navigation';
    import { page } from '$app/stores';
    import Modal from "$lib/components/common/Modal.svelte";
    import { auth } from "$lib/services/auth";

    // Props
    export let showModal = false;
    export let onClose: () => void;
    export let initialToken0: FE.Token | null = null;
    export let initialToken1: FE.Token | null = null;

    // Local state
    let token0 = initialToken0;
    let token1 = initialToken1;
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
      { label: 'Sending Tokens', completed: false },
      { label: 'Updating LPs', completed: false },
      { label: 'Success', completed: false }
    ];

    let showTokenModal = false;
    let activeTokenIndex: 0 | 1 = 0;
    let searchQuery = "";
    let tokens: FE.Token[] = [];

    let activeInput: 0 | 1 | null = null;
    let statusMessage: string = "";

    let previewMode = false;
    let showReview = false;

    // Update tokens when props change
    $: {
      if (initialToken0 !== token0) token0 = initialToken0;
      if (initialToken1 !== token1) token1 = initialToken1;
    }

    // Handle URL parameters
    async function initializeFromParams() {
      const token0Id = $page.url.searchParams.get('token0');
      const token1Id = $page.url.searchParams.get('token1');

      if (token0Id || token1Id) {
        const allTokens = get(formattedTokens);

        if (token0Id) {
          const foundToken0 = allTokens.find(t => t.canister_id === token0Id);
          if (foundToken0) {
            token0 = foundToken0;
          }
        }

        if (token1Id) {
          const foundToken1 = allTokens.find(t => t.canister_id === token1Id);
          if (foundToken1) {
            token1 = foundToken1;
          }
        }
      }
    }

    onMount(async () => {
      try {
        await Promise.all([initializeFromParams(), loadBalances($auth?.account?.owner)]);
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

        const store = get(tokenStore);
        const balance0 = store.balances[token0.canister_id];
        const balance1 = store.balances[token1.canister_id];

        if (index === 0) {
          const requiredAmount = await PoolService.addLiquidityAmounts(
            token0.token,
            parseTokenAmount(amount, token0.decimals),
            token1.token,
          );

          const requiredAmount1 = requiredAmount.Ok.amount_1;

          // Check if token1 amount exceeds balance
          if (balance1.in_tokens - BigInt(token1.fee_fixed) < requiredAmount1) {
            // If it exceeds, calculate backwards from token1's max balance
            const reverseAmount = await PoolService.addLiquidityAmounts(
              token1.token,
              balance1.in_tokens - BigInt(token1.fee_fixed),
              token0.token,
            );
            amount0 = formatBalance(reverseAmount.Ok.amount_1, token0.decimals).toString();
            amount1 = formatBalance((balance1.in_tokens - BigInt(token1.fee_fixed)).toString(), token1.decimals).toString();
          } else {
            amount1 = formatBalance((requiredAmount1 - BigInt(token1.fee_fixed)).toString(), token1.decimals).toString();
          }
        } else {
          const requiredAmount = await PoolService.addLiquidityAmounts(
            token1.token,
            parseTokenAmount(amount, token1.decimals),
            token0.token,
          );

          const requiredAmount0 = requiredAmount.Ok.amount_1;

          // Check if token0 amount exceeds balance
          if (balance0.in_tokens - BigInt(token0.fee_fixed) < requiredAmount0) {
            // If it exceeds, calculate backwards from token0's max balance
            const reverseAmount = await PoolService.addLiquidityAmounts(
              token0.token,
              balance0.in_tokens - BigInt(token0.fee_fixed),
              token1.token,
            );
            amount0 = formatBalance((balance0.in_tokens - BigInt(token0.fee_fixed)).toString(), token0.decimals).toString();
            amount1 = formatBalance(reverseAmount.Ok.amount_1, token1.decimals).toString();
          } else {
            amount0 = formatBalance((requiredAmount0 - BigInt(token0.fee_fixed)).toString(), token0.decimals).toString();
          }
        }
      } catch (err) {
        error = err.message;
      } finally {
        loading = false;
        isProcessingOutput = false;
      }
    }

    async function handleConfirm() {
      showReview = false;
      loading = true;
      error = null;
      previewMode = true;
      statusMessage = "Submitting liquidity request...";
      statusSteps = statusSteps.map(step => ({ ...step, completed: false }));

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
                  if (requestStatus.statuses.some(s => 
                      s.toLowerCase().includes('failed') || 
                      s.toLowerCase().includes('error')
                  )) {
                      loading = false;
                      previewMode = false;
                      error = requestStatus.statuses[requestStatus.statuses.length - 2]
                      // Add failed status to steps
                      statusSteps = statusSteps.map(step => ({
                          ...step,
                          completed: false,
                          failed: true
                      }));
                      return;
                  }

                  if (requestStatus.statuses.includes('Success')) {
                      loading = false;
                      setTimeout(() => {
                          previewMode = false;
                          showReview = false;
                          goto('/pools');
                      }, 1000);
                  } else {
                      // Continue polling
                      setTimeout(checkStatus, 500);
                  }
              } catch (err) {
                  console.error("Error polling request status:", err);
                  statusMessage = "Error polling request status: " + err.message;
                  loading = false;
                  error = err.message;
                  previewMode = false;
                  // Mark all incomplete steps as failed
                  statusSteps = statusSteps.map(step => ({
                      ...step,
                      failed: !step.completed
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
          statusSteps = statusSteps.map(step => ({
              ...step,
              completed: false,
              failed: true
          }));
      }
    }

    function updateStatusSteps(rawStatuses: string[]) {
      const stepsToMatch = {
        'Sending Tokens': [
          'Sending token 0',
          'Token 0 sent',
          'Sending token 1',
          'Token 1 sent'
        ],
        'Updating LPs': [
          'Updating liquidity pool',
          'Liquidity pool updated',
          'Updating user LP token amount',
          'User LP token amount updated'
        ],
        'Success': ['Success']
      };

      // Check for any failure states in the raw statuses
      const hasFailure = rawStatuses.some(status => 
          status.toLowerCase().includes('failed') || 
          status.toLowerCase().includes('error')
      );

      // Update steps based on latest statuses
      statusSteps = statusSteps.map(step => {
          const matches = stepsToMatch[step.label];
          const isCompleted = matches.every(match => 
              rawStatuses.some(status => status.includes(match))
          );
          
          // Special case for "Sending Tokens"
          if (step.label === 'Sending Tokens') {
              const token0Sent = rawStatuses.includes('Token 0 sent');
              const token1Sent = rawStatuses.includes('Token 1 sent');
              const token0Failed = rawStatuses.some(s => s.includes('Token 0') && s.includes('failed'));
              const token1Failed = rawStatuses.some(s => s.includes('Token 1') && s.includes('failed'));
              
              return {
                  ...step,
                  completed: token0Sent && token1Sent,
                  failed: token0Failed || token1Failed
              };
          }

          return {
              ...step,
              completed: isCompleted,
              failed: hasFailure && !isCompleted
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
      if (token0) params.set('token0', token0.canister_id);
      if (token1) params.set('token1', token1.canister_id);
      const newUrl = `/pools/add${params.toString() ? '?' + params.toString() : ''}`;
      replaceState(newUrl, null);
      updateBalances();
    }
  </script>

    <AddLiquidityForm
      bind:token0
      bind:token1
      bind:amount0
      bind:amount1
      bind:loading
      bind:error
      {token0Balance}
      {token1Balance}
      onTokenSelect={handleTokenSelect}
      onInput={handleInput}
      onSubmit={handleConfirm}
    />

  <style lang="postcss">
  </style>
