<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { IcrcService } from "$lib/services/icrc/IcrcService";
    import { toastStore } from "$lib/stores/toastStore";
    import { Principal } from "@dfinity/principal";
    import Modal from '$lib/components/common/Modal.svelte';
    import { formatTokenAmount } from '$lib/utils/numberFormatUtils';

    export let token: {
        symbol: string;
        amount: string;
        canister_id: string;
        decimals: number;
    };

    let recipientAddress = '';
    let amount = '';
    let isValidating = false;
    let errorMessage = '';
    $: maxAmount = parseFloat(formatTokenAmount(token.balance, token.decimals));
    let addressType: 'principal' | 'account' | null = null;
    let showConfirmation = false;

    function isValidHex(str: string): boolean {
        const hexRegex = /^[0-9a-fA-F]+$/;
        return hexRegex.test(str);
    }

    function detectAddressType(address: string): 'principal' | 'account' | null {
        if (!address) return null;

        // Check for Account ID (64 character hex string)
        if (address.length === 64 && isValidHex(address)) {
            return 'account';
        }

        // Check for Principal ID
        try {
            Principal.fromText(address);
            return 'principal';
        } catch {
            return null;
        }
    }

    function validateAddress(address: string): boolean {
        if (!address) return false;

        const cleanAddress = address.trim();
        
        if (cleanAddress.length === 0) {
            errorMessage = 'Address cannot be empty';
            return false;
        }

        addressType = detectAddressType(cleanAddress);

        if (addressType === 'account') {
            errorMessage = 'Only Principal IDs are currently supported. Account ID support coming soon!';
            return false;
        }

        if (addressType === null) {
            errorMessage = 'Invalid address format';
            return false;
        }

        // Principal-specific validation
        try {
            const principal = Principal.fromText(cleanAddress);
            if (principal.isAnonymous()) {
                errorMessage = 'Cannot send to anonymous principal';
                return false;
            }
        } catch (err) {
            errorMessage = 'Invalid Principal ID format';
            return false;
        }

        errorMessage = '';
        return true;
    }

    function validateAmount(value: string): boolean {
        if (!value) return false;
        const numValue = parseFloat(value);
        
        if (isNaN(numValue) || numValue <= 0) {
            errorMessage = 'Amount must be greater than 0';
            return false;
        }
        
        if (numValue > maxAmount) {
            errorMessage = 'Insufficient balance';
            return false;
        }
        
        return true;
    }

    function handleAmountInput(event: Event) {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(/[^0-9.]/g, '');
        
        const parts = value.split('.');
        if (parts.length > 2) {
            value = `${parts[0]}.${parts[1]}`;
        }

        if (parts[1]?.length > token.decimals) {
            value = `${parts[0]}.${parts[1].slice(0, token.decimals)}`;
        }

        amount = value;
        errorMessage = '';
        validateAmount(value);
    }

    async function handleSubmit() {
        showConfirmation = true;
    }

    async function confirmTransfer() {
        isValidating = true;
        errorMessage = '';
        showConfirmation = false;

        try {
            const decimals = token.decimals || 8;
            const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));

            const result = await IcrcService.icrc1Transfer(token, recipientAddress, amountBigInt);

            if (result?.Ok) {
                toastStore.success("Transfer successful");
                recipientAddress = '';
                amount = '';
            } else if (result?.Err) {
                const errMsg = typeof result.Err === "object" 
                    ? Object.keys(result.Err)[0]
                    : String(result.Err);
                errorMessage = `Transfer failed: ${errMsg}`;
                toastStore.error(errorMessage);
            }
        } catch (err) {
            errorMessage = err.message || "Transfer failed";
            toastStore.error(errorMessage);
        } finally {
            isValidating = false;
        }
    }

    function setMaxAmount() {
        amount = maxAmount.toString();
        errorMessage = '';
    }

    $: {
        if (recipientAddress) {
            validateAddress(recipientAddress);
        } else {
            addressType = null;
            errorMessage = '';
        }
    }

    $: validationMessage = (() => {
        if (!recipientAddress) return { type: 'info', text: 'Enter a Principal ID (sending to Account IDs coming soon)' };
        if (errorMessage) return { type: 'error', text: errorMessage };
        if (addressType === 'principal') return { type: 'success', text: 'Valid Principal ID' };
        if (addressType === 'account') return { type: 'error', text: 'Currently only sending to Principal IDs is supported' };
        return { type: 'error', text: 'Invalid address format' };
    })();

    async function handlePaste() {
        try {
            const text = await navigator.clipboard.readText();
            recipientAddress = text.trim();
        } catch (err) {
            toastStore.error('Failed to paste from clipboard');
        }
    }
</script>

<div class="container" transition:fade>
    <form on:submit|preventDefault={handleSubmit}>
        <div class="id-card">
            <div class="id-header">
                <span>Recipient Address</span>
            </div>

            <div class="input-group">
                <div class="input-wrapper">
                    <input
                        type="text"
                        bind:value={recipientAddress}
                        placeholder="Paste address or enter manually"
                        class:error={errorMessage && recipientAddress}
                        class:valid={addressType === 'principal' && !errorMessage}
                    />
                    <button 
                        type="button"
                        class="action-button"
                        on:click={recipientAddress ? () => recipientAddress = '' : handlePaste}
                    >
                        {#if recipientAddress}✕{:else}📋{/if}
                    </button>
                </div>
                
                {#if recipientAddress}
                    <div 
                        class="validation-status" 
                        class:success={validationMessage.type === 'success'} 
                        class:error={validationMessage.type === 'error'}
                    >
                        <span class="status-text">{validationMessage.text}</span>
                    </div>
                {/if}
            </div>
        </div>

        <div class="id-card">
            <div class="id-header">
                <span>Amount</span>
                <button type="button" class="max-btn" on:click={setMaxAmount}>MAX</button>
            </div>

            <div class="input-group">
                <input
                    type="text"
                    inputmode="decimal"
                    placeholder="Enter amount"
                    bind:value={amount}
                    on:input={handleAmountInput}
                    class:error={errorMessage.includes('balance') || errorMessage.includes('Amount')}
                />
                <div class="balance-info">
                    <span>Balance: {formatTokenAmount(token.balance, token.decimals)} {token.symbol}</span>
                </div>
            </div>
        </div>

        {#if errorMessage}
            <div class="error-message" transition:fade={{duration: 200}}>
                {errorMessage}
            </div>
        {/if}

        <button 
            type="submit" 
            class="send-btn"
            disabled={isValidating || !amount || !recipientAddress || addressType === 'account'}
        >
            {#if addressType === 'account'}
                Sending to Account IDs coming soon
            {:else}
                Send Tokens
            {/if}
        </button>
    </form>

    {#if showConfirmation}
        <Modal
            isOpen={showConfirmation}
            onClose={() => showConfirmation = false}
            title="Confirm Your Transfer"
            width="min(450px, 95vw)"
            height="auto"
        >
            <div class="confirm-box">
                <div class="confirm-details">
                    <div class="transfer-summary">
                        <div class="amount-display">
                            <span class="amount">{amount}</span>
                            <span class="symbol">{token.symbol}</span>
                        </div>
                    </div>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="label">To Address</span>
                            <span class="value address">{recipientAddress}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Address Type</span>
                            <span class="value type">{addressType}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Network Fee</span>
                            <span class="value">0.0001 {token.symbol}</span>
                        </div>
                        <div class="detail-item total">
                            <span class="label">Total Amount</span>
                            <span class="value">{(parseFloat(amount) + 0.0001).toFixed(4)} {token.symbol}</span>
                        </div>
                    </div>
                </div>

                <div class="confirm-actions">
                    <button class="cancel-btn" on:click={() => showConfirmation = false}>Cancel</button>
                    <button 
                        class="confirm-btn" 
                        class:loading={isValidating}
                        on:click={confirmTransfer}
                        disabled={isValidating}
                    >
                        {#if isValidating}
                            <span class="loading-spinner"></span>
                            Processing...
                        {:else}
                            Confirm Transfer
                        {/if}
                    </button>
                </div>
            </div>
        </Modal>
    {/if}
</div>

<style lang="postcss">
    .container {
        @apply flex flex-col gap-4 py-4;
    }

    .id-card {
        @apply bg-white/5 rounded-xl p-4 mb-2;
    }

    .id-header {
        @apply flex justify-between items-center mb-2 text-white/70 text-sm;
    }

    .max-btn {
        @apply px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20 text-white;
    }

    .input-wrapper {
        @apply relative flex items-center;
    }

    .action-button {
        @apply absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 
               flex items-center justify-center rounded-lg
               bg-white/10 text-white/70 hover:bg-white/15;
    }

    input {
        @apply w-full px-3 py-2 bg-black/20 rounded-lg text-white
               border border-white/10 hover:border-white/20
               focus:border-indigo-500 focus:outline-none pr-10;
        
        &.error { @apply border-red-500/50 bg-red-500/10; }
        &.valid { @apply border-green-500/50; }
    }

    .error-message {
        @apply text-red-400 text-sm px-2 mb-2;
    }

    .send-btn {
        @apply w-full py-3 bg-indigo-500 text-white rounded-lg
               font-medium hover:bg-indigo-600 disabled:opacity-50;
    }

    .validation-status {
        @apply text-sm mt-1 px-1;
        &.success { @apply text-green-400; }
        &.error { @apply text-red-400; }
    }

    .balance-info {
        @apply text-right mt-1 text-sm text-white/60;
    }

    .confirm-box {
        @apply p-6;
        
        .transfer-summary {
            @apply mb-6 text-center;
            
            .amount-display {
                @apply flex items-baseline justify-center gap-2;
                
                .amount {
                    @apply text-3xl font-bold text-white;
                }
                
                .symbol {
                    @apply text-lg text-white/70;
                }
            }
        }
        
        .details-grid {
            @apply space-y-3 mb-6;
            
            .detail-item {
                @apply flex justify-between items-center p-3 rounded-lg bg-white/5;
                
                .label {
                    @apply text-sm text-white/60;
                }
                
                .value {
                    @apply text-sm text-white/90;
                    
                    &.address {
                        @apply max-w-[200px] truncate;
                    }
                    
                    &.type {
                        @apply capitalize;
                    }
                }
                
                &.total {
                    @apply mt-4 bg-white/10;
                    .label, .value {
                        @apply font-medium text-white;
                    }
                }
            }
        }
        
        .confirm-actions {
            @apply flex gap-3 pt-4 border-t border-white/10;
            
            button {
                @apply flex-1 py-3 rounded-lg font-medium text-center justify-center items-center gap-2;
            }
            
            .cancel-btn {
                @apply bg-white/10 hover:bg-white/15 text-white/90;
            }
            
            .confirm-btn {
                @apply bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed;
                &.loading {
                    @apply bg-indigo-500/50;
                }
            }
        }
    }

    .loading-spinner {
        @apply inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin;
    }
</style>
