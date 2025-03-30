<script lang="ts">
    import { onMount } from 'svelte';
    import { Principal } from '@dfinity/principal';
    import { toastStore } from '$lib/stores/toastStore';
    import { formatCycles } from '$lib/utils/cycles';
    import { auth } from '$lib/stores/auth';
    import { SwapService } from '$lib/services/swap/SwapService';
    import { TCyclesService } from '$lib/services/canister/tcycles-service';

    export let canisterId: string | null = null;

    // Constants
    const KONG_DECIMALS = 8;
    const TCYCLES_DECIMALS = 12; // TCycles have 12 decimals (1 TCycle = 1 trillion cycles)
    const MIN_KONG_AMOUNT = 10;

    let kongAmount = MIN_KONG_AMOUNT; // Default amount
    let estimatedCycles: bigint = BigInt(0);
    let isLoading = false;
    let canisterIdInput = '';
    let kongTCyclesRate = "0";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let fee: bigint = BigInt(0);
    let formattedFee = "0";
    
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
        console.log("TopUpTCycles component mounted with canisterId:", canisterId);
        
        if (canisterId) {
            canisterIdInput = canisterId;
            console.log("Setting canisterIdInput to:", canisterIdInput);
            validateCanisterId();
        }
        
        // Get the fee for TCycles operations
        try {
            fee = await TCyclesService.getFee();
            formattedFee = SwapService.fromBigInt(fee, TCYCLES_DECIMALS);
            console.log("TCycles fee:", formattedFee, "T-Cycles");
        } catch (error) {
            console.error("Error getting TCycles fee:", error);
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
            
            // Use the SwapService to get a quote for KONG to TCycles
            const kongE8s = SwapService.toBigInt(kongAmount.toString(), KONG_DECIMALS);
            const quoteResult = await SwapService.getKongToTCyclesQuote(kongE8s, KONG_DECIMALS, TCYCLES_DECIMALS);
            
            // Convert the receive amount to bigint for display
            const tcyclesAmount = SwapService.toBigInt(quoteResult.receiveAmount, TCYCLES_DECIMALS);
            
            // Set the estimated cycles (1 TCycle = 1 trillion cycles)
            estimatedCycles = tcyclesAmount;
            
            // Set the KONG to TCycles rate for reference
            const tcyclesValue = parseFloat(quoteResult.receiveAmount);
            kongTCyclesRate = (tcyclesValue / kongAmount).toFixed(6);
            
        } catch (error) {
            console.error('Error calculating cycles:', error);
            // Fallback to simple calculation if the service call fails
            toastStore.error(`Error calculating cycles: ${error.message}`);
        }
    }

    async function handleSubmit() {
        if (!validateCanisterId() || !validateAmount()) {
            return;
        }

        isLoading = true;
        try {
            // Inform user that the process is starting
            toastStore.info(`Starting top-up process for canister ${canisterIdInput}...`);
            
            // Step 1: Swap KONG to TCycles
            toastStore.info(`Converting ${kongAmount} KONG to TCycles...`);
            const kongE8s = SwapService.toBigInt(kongAmount.toString(), KONG_DECIMALS);
            
            // Swap KONG to TCycles (this is a placeholder - you'll need to implement this in SwapService)
            const tcyclesAmount = await SwapService.swapKongToTCycles(kongE8s);
            
            // Step 2: Use the received TCycles to top up the canister
            toastStore.info(`Adding cycles to canister ${canisterIdInput} (fee: ${formattedFee} T-Cycles)...`);
            
            // Convert canisterId to Principal
            const canisterPrincipal = Principal.fromText(canisterIdInput);
            
            // Top up the canister using TCyclesService
            const blockIndex = await TCyclesService.topUpCanister(canisterPrincipal, tcyclesAmount);
            
            // Final success message
            const netCycles = tcyclesAmount - fee;
            toastStore.success(`Successfully topped up canister with ${formatCycles(netCycles)} cycles (after ${formattedFee} T-Cycles fee)`);
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

<div class="flex flex-col w-full">
    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Canister ID Input -->
        <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
            <label for="canisterId" class="block mb-2 text-sm font-medium text-kong-text-primary">
                Canister ID
            </label>
            <div class="relative">
                <input
                    type="text"
                    id="canisterId"
                    bind:value={canisterIdInput}
                    on:blur={validateCanisterId}
                    class="w-full px-4 py-3 text-kong-text-primary {!!canisterId ? 'bg-kong-bg-dark font-medium' : 'bg-kong-bg-secondary'} border {!!canisterId ? 'border-kong-accent-blue' : 'border-kong-border'} rounded-md focus:outline-none focus:ring-2 focus:ring-kong-accent-blue"
                    placeholder="Enter canister ID"
                    readonly={!!canisterId}
                />
                {#if !!canisterId}
                    <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                        <span class="text-kong-accent-blue">
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
        <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
            <label for="kongAmount" class="block mb-2 text-sm font-medium text-kong-text-primary">
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
                    class="w-full px-4 py-3 text-kong-text-primary bg-kong-bg-secondary border border-kong-border rounded-md focus:outline-none focus:ring-2 focus:ring-kong-accent-blue"
                    placeholder="Enter KONG amount"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span class="text-kong-text-secondary">KONG</span>
                </div>
            </div>
            {#if amountError}
                <p class="mt-1 text-sm text-red-400">{amountError}</p>
            {/if}
            <p class="mt-1 text-xs text-kong-text-secondary">Minimum: {MIN_KONG_AMOUNT} KONG</p>
        </div>
        
        <!-- Estimated Cycles Card -->
        <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
            <h3 class="mb-3 text-base font-medium text-kong-text-primary">Estimated Cycles</h3>
            <div class="flex items-center justify-between">
                <span class="text-kong-text-secondary">Cycles to receive:</span>
                <span class="text-xl font-semibold text-kong-text-primary">{formatCycles(estimatedCycles)}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
                <span class="text-kong-text-secondary">Transaction fee:</span>
                <span class="text-sm font-medium text-kong-text-primary">{formattedFee} T-Cycles</span>
            </div>
            <p class="mt-2 text-xs text-kong-text-secondary">
                The actual amount of cycles may vary based on the current exchange rates. A fee of {formattedFee} T-Cycles will be deducted from your balance for the transaction.
            </p>
        </div>
        
        <div class="flex justify-end pt-4">
            <!-- Submit Button -->
            <button
                type="submit"
                class="px-6 py-2.5 font-medium text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
        
        {#if !$auth.isConnected}
            <div class="p-4 border rounded-lg bg-yellow-900/30 border-yellow-700/50">
                <p class="text-sm text-center text-yellow-400">
                    You need to connect your wallet to top up a canister.
                </p>
            </div>
        {/if}
    </form>
    
    <div class="mt-6 p-4 border rounded-lg bg-kong-bg-light/5 border-kong-border/10">
        <h3 class="mb-2 text-base font-medium text-kong-text-primary">About TCycles Top-Up</h3>
        <p class="text-sm text-kong-text-secondary mb-2">
            This method uses the TCycles ledger to top up your canister, which can be more efficient than the traditional ICP path.
        </p>
        <p class="text-sm text-kong-text-secondary">
            Make sure you have enough KONG in your wallet before proceeding.
        </p>
    </div>
</div> 