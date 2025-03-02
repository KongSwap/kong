<script lang="ts">
    import { onMount } from 'svelte';
    import { Principal } from '@dfinity/principal';
    import { toastStore } from '$lib/stores/toastStore';
    import { formatICP, icpToE8s } from '$lib/utils/icp';
    import { formatCycles } from '$lib/utils/cycles';
    import { topUpCanister, calculateCyclesFromIcp } from '$lib/services/canister/top_up_canister';
    import { auth } from '$lib/services/auth';
    import { SwapService } from '$lib/services/swap/SwapService';
    import { fetchICPtoXDRRates } from '$lib/services/canister/ic-api';

    export let canisterId: string | null = null;

    // Constants
    const KONG_DECIMALS = 8;
    const ICP_DECIMALS = 8;
    const MIN_KONG_AMOUNT = 10;

    let kongAmount = MIN_KONG_AMOUNT; // Default amount - changed from 390 to MIN_KONG_AMOUNT (10)
    let icpAmount = "0";
    let estimatedCycles: bigint = BigInt(0);
    let isLoading = false;
    let canisterIdInput = '';
    let kongIcpRate = "0";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    // Validation
    let canisterIdError = '';
    let amountError = '';

    // Update canisterIdInput whenever canisterId prop changes
    $: {
        console.log("canisterId prop in reactive statement:", canisterId);
        if (canisterId) {
            canisterIdInput = canisterId;
            validateCanisterId();
        }
    }

    onMount(async () => {
        console.log("TopUp component mounted with canisterId:", canisterId);
        
        if (canisterId) {
            canisterIdInput = canisterId;
            console.log("Setting canisterIdInput to:", canisterIdInput);
            validateCanisterId();
        }
        
        // Calculate estimated cycles on mount
        estimateCycles();
    });

    function validateCanisterId() {
        canisterIdError = '';
        try {
            if (!canisterIdInput) {
                canisterIdError = 'Canister ID is required';
                return false;
            }
            
            // Validate that it's a valid Principal
            Principal.fromText(canisterIdInput);
            return true;
        } catch (error) {
            canisterIdError = 'Invalid canister ID';
            return false;
        }
    }

    function validateAmount() {
        amountError = '';
        // Handle empty or non-numeric input
        if (kongAmount === null || kongAmount === undefined || isNaN(Number(kongAmount)) || Number(kongAmount) === 0) {
            amountError = `Amount must be at least ${MIN_KONG_AMOUNT} KONG`;
            return false;
        }
        
        if (Number(kongAmount) < MIN_KONG_AMOUNT) {
            amountError = `Amount must be at least ${MIN_KONG_AMOUNT} KONG`;
            return false;
        }
        return true;
    }

    // Debounced function to estimate cycles
    function debouncedEstimateCycles() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
            estimateCycles();
        }, 500); // 500ms debounce
    }

    async function estimateCycles() {
        try {
            // Handle empty or invalid input
            if (kongAmount === null || kongAmount === undefined || isNaN(Number(kongAmount)) || Number(kongAmount) <= 0) {
                estimatedCycles = BigInt(0);
                return;
            }
            
            // Step 1: KONG to ICP calculation (no actual swap yet)
            const kongE8s = SwapService.toBigInt(kongAmount.toString(), KONG_DECIMALS);
            const quoteResult = await SwapService.getKongToIcpQuote(kongE8s, KONG_DECIMALS, ICP_DECIMALS);
            icpAmount = quoteResult.receiveAmount;
            
            // Step 2: ICP to XDR conversion
            const xdrRatesResponse = await fetchICPtoXDRRates();
            
            // Extract the rate value from the response
            const xdrRateValue = getXDRRate(xdrRatesResponse.icp_xdr_conversion_rates);
            
            // XDR rate is in 10,000ths, so divide by 10,000 to get the actual rate
            const xdrPerIcp = xdrRateValue / 10000;
            
            // Calculate the XDR amount
            const icpValue = parseFloat(icpAmount);
            const xdrAmount = icpValue * xdrPerIcp;
            
            // Step 3: XDR to T-Cycles (1 XDR = 1T cycles)
            const tCycles = xdrAmount;
            
            // Convert to bigint for display
            estimatedCycles = BigInt(Math.floor(tCycles * 1_000_000_000_000));
            
            // Set the KONG to ICP rate for reference
            kongIcpRate = (icpValue / kongAmount).toFixed(6);
        } catch (error) {
            console.error('Error calculating cycles:', error);
            // Fallback to simple calculation if the service call fails
            toastStore.error(`Error calculating cycles: ${error.message}`);
        }
    }

    // Helper function to get the most recent XDR rate from the API response
    function getXDRRate(ratesArray: [number, number][]): number {
        if (!ratesArray || !Array.isArray(ratesArray) || ratesArray.length === 0) {
            console.error("Invalid XDR rates array:", ratesArray);
            throw new Error("Invalid XDR rates data");
        }
        
        // Sort by timestamp (first element in inner array) to get most recent
        const sortedRates = [...ratesArray].sort((a, b) => b[0] - a[0]);
        
        // The rate is the second element in the inner array
        const latestRate = sortedRates[0][1];
        console.log("Latest XDR rate value:", latestRate);
        
        return latestRate;
    }

    async function handleSubmit() {
        if (!validateCanisterId() || !validateAmount()) {
            return;
        }

        isLoading = true;
        try {
            // Inform user that the process is starting
            toastStore.info(`Starting top-up process for canister ${canisterIdInput}...`);
            
            // Step 1: Swap KONG to ICP (but don't mention ICP to the user)
            toastStore.info(`Converting ${kongAmount} KONG to cycles...`);
            const kongE8s = SwapService.toBigInt(kongAmount.toString(), KONG_DECIMALS);
            const icpE8s = await SwapService.swapKongToIcp(kongE8s);
            
            // Don't show the intermediate ICP conversion message
            const icpReceived = SwapService.fromBigInt(icpE8s, ICP_DECIMALS);
            
            // Step 2: Use the received ICP to top up the canister
            toastStore.info(`Adding cycles to canister ${canisterIdInput}...`);
            await topUpCanister({
                canister_id: canisterIdInput,
                amount: icpE8s
            });
            
            // Final success message
            toastStore.success(`Successfully topped up canister with ${formatCycles(estimatedCycles)} cycles`);
        } catch (error) {
            console.error('Top up error:', error);
            toastStore.error(`An error occurred: ${error.message || 'Unknown error'}`);
        } finally {
            isLoading = false;
        }
    }

    // Update estimated cycles when KONG amount changes
    $: {
        kongAmount;
        debouncedEstimateCycles();
    }
</script>

<div class="max-w-3xl mx-auto">
    <div class="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div class="p-6 border-b border-gray-700">
            <h2 class="text-2xl font-bold text-white">Top Up Canister with KONG</h2>
            <p class="mt-2 text-gray-400">Add cycles to your canister to keep it running on the Internet Computer</p>
        </div>
        
        <form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
            <!-- Canister ID Input -->
            <div>
                <label for="canisterId" class="block mb-2 text-sm font-medium text-gray-300">
                    Canister ID
                </label>
                <div class="relative">
                    <input
                        type="text"
                        id="canisterId"
                        bind:value={canisterIdInput}
                        on:blur={validateCanisterId}
                        class="w-full px-4 py-3 text-white {!!canisterId ? 'bg-gray-800 font-medium' : 'bg-gray-700'} border {!!canisterId ? 'border-blue-500' : 'border-gray-600'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter canister ID"
                        readonly={!!canisterId}
                    />
                    {#if !!canisterId}
                        <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                            <span class="text-blue-400">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </div>
                    {/if}
                </div>
                {#if canisterIdError}
                    <p class="mt-1 text-sm text-red-400">{canisterIdError}</p>
                {/if}
                {#if !!canisterId}
                    <p class="mt-1 text-xs text-green-400">Canister ID automatically filled from your request</p>
                {/if}
            </div>
            
            <!-- KONG Amount Input -->
            <div>
                <label for="kongAmount" class="block mb-2 text-sm font-medium text-gray-300">
                    KONG Amount
                </label>
                <div class="relative">
                    <input
                        type="number"
                        id="kongAmount"
                        bind:value={kongAmount}
                        on:blur={validateAmount}
                        min={MIN_KONG_AMOUNT}
                        step="1"
                        class="w-full px-4 py-3 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter KONG amount"
                    />
                    <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span class="text-gray-400">KONG</span>
                    </div>
                </div>
                {#if amountError}
                    <p class="mt-1 text-sm text-red-400">{amountError}</p>
                {/if}
                <p class="mt-1 text-xs text-gray-500">Minimum: {MIN_KONG_AMOUNT} KONG</p>
            </div>
            
            <!-- Estimated Cycles Card -->
            <div class="bg-gray-700 rounded-lg p-5 border border-gray-600">
                <div class="flex items-center justify-between">
                    <span class="text-gray-300">Estimated Cycles:</span>
                    <span class="text-xl font-semibold text-white">{formatCycles(estimatedCycles)}</span>
                </div>
                <p class="mt-2 text-xs text-gray-400">
                    The actual amount of cycles may vary based on the current exchange rates.
                </p>
            </div>
            
            <!-- Submit Button -->
            <button
                type="submit"
                class="w-full px-4 py-3 text-white font-medium transition-colors bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !$auth.isConnected}
            >
                {#if isLoading}
                    <span class="flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                    </span>
                {:else}
                    Top Up Canister
                {/if}
            </button>
            
            {#if !$auth.isConnected}
                <div class="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-md">
                    <p class="text-sm text-center text-yellow-400">
                        You need to connect your wallet to top up a canister.
                    </p>
                </div>
            {/if}
        </form>
        
        <div class="p-6 bg-gray-750 border-t border-gray-700">
            <h3 class="text-lg font-semibold text-white mb-2">About Canister Top-Up</h3>
            <p class="text-sm text-gray-400 mb-2">
                Topping up a canister adds cycles that are used to pay for computation, storage, and bandwidth on the Internet Computer.
            </p>
            <p class="text-sm text-gray-400">
                Make sure you have enough KONG in your wallet before proceeding.
            </p>
        </div>
    </div>
</div> 
