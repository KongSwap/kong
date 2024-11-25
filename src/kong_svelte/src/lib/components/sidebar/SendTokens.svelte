<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { IcrcService } from "$lib/services/icrc/IcrcService";
    import { toastStore } from "$lib/stores/toastStore";
    import { Principal } from "@dfinity/principal";
    import Modal from '$lib/components/common/Modal.svelte';

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
    let maxAmount = parseFloat(token.amount);
    let addressType: 'principal' | 'account' | null = null;
    let showHelp = false;
    let showConfirmation = false;

    function detectAddressType(address: string): 'principal' | 'account' | null {
        if (!address) return null;
        try {
            Principal.fromText(address);
            return 'principal';
        } catch {
            return address.length === 64 ? 'account' : null;
        }
    }

    function validateAddress(address: string): boolean {
        if (!address) return false;
        addressType = detectAddressType(address);
        return addressType !== null;
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
        }
    }

    $: validationMessage = (() => {
        if (!recipientAddress) return { type: 'info', text: 'Enter a Principal ID or Account ID' };
        if (addressType === 'principal') return { type: 'success', text: 'Valid Principal ID' };
        if (addressType === 'account') return { type: 'success', text: 'Valid Account ID' };
        return { type: 'error', text: 'Invalid address format' };
    })();

    async function handlePaste() {
        try {
            const text = await navigator.clipboard.readText();
            recipientAddress = text;
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
                <button type="button" class="help-btn" on:click={() => showHelp = true}>
                    <span>💡 Help</span>
                </button>
            </div>

            <div class="input-group">
                <div class="input-wrapper">
                    <input
                        type="text"
                        bind:value={recipientAddress}
                        placeholder="Paste address or enter manually"
                        class:error={addressType === null && recipientAddress}
                        class:valid={addressType !== null}
                    />
                    <button 
                        type="button"
                        class="action-button"
                        on:click={recipientAddress ? () => recipientAddress = '' : handlePaste}
                    >
                        {#if recipientAddress}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                            </svg>
                        {/if}
                    </button>
                </div>
                
                {#if recipientAddress}
                    <div class="validation-status" class:success={addressType !== null} class:error={addressType === null}>
                        <div class="status-icon">
                            {#if addressType !== null}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                            {:else}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                        <span class="status-text">{validationMessage.text}</span>
                    </div>
                {/if}
            </div>
        </div>

        <div class="id-card">
            <div class="id-header">
                <span>Amount</span>
                <button type="button" class="max-btn" on:click={setMaxAmount}>
                    <span>💰 MAX</span>
                </button>
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
                    <span>Balance: {token.amount} {token.symbol}</span>
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
            disabled={isValidating || !amount || !recipientAddress}
        >
            Review Transfer
        </button>
    </form>

    {#if showHelp}
        <Modal
            isOpen={showHelp}
            onClose={() => showHelp = false}
            title="How to Send Tokens"
            width="min(500px, 95vw)"
            height="auto"
        >
            <div class="help-box">
                <div class="help-header">
                    <span class="help-icon">💡</span>
                    <h3>Sending {token.symbol}</h3>
                </div>
                <div class="help-content">
                    <div class="id-types-info">
                        <h4>Understanding Address Types:</h4>
                        <ul>
                            <li>
                                <strong>Principal ID:</strong> The primary identifier for Internet Computer users. Most dapps and wallets use this format.
                            </li>
                            <li>
                                <strong>Account ID:</strong> A 64-character hex string derived from Principal ID. Some exchanges and services require this format.
                            </li>
                        </ul>
                        <p class="note">Both address types work for sending tokens - use whichever the recipient prefers.</p>
                    </div>
                    <div class="steps-info">
                        <h4>Steps to Send:</h4>
                        <ol>
                            <li>Enter the recipient's Principal ID or Account ID</li>
                            <li>Enter the amount you want to send</li>
                            <li>Double-check the address and amount</li>
                            <li>Click Send to complete the transfer</li>
                        </ol>
                    </div>
                </div>
            </div>
        </Modal>
    {/if}

    {#if showConfirmation}
        <Modal
            isOpen={showConfirmation}
            onClose={() => showConfirmation = false}
            title="Review Your Transfer"
            width="min(560px, 95vw)"
            height="auto"
        >
            <div class="confirm-box">
                <div class="confirm-details">
                    <div class="network-info">
                        <div class="network-badge">
                            <img src="/icp-logo.svg" alt="ICP" class="network-icon" />
                            <span>Internet Computer Network</span>
                        </div>
                    </div>

                    <div class="transfer-summary">
                        <div class="summary-label">Transfer Amount</div>
                        <div class="amount-display">
                            <span class="amount-value">{amount}</span>
                            <span class="token-symbol">{token.symbol}</span>
                        </div>
                        <div class="usd-value">≈ $XX.XX USD</div>
                    </div>

                    <div class="transfer-details">
                        <div class="detail-section">
                            <div class="detail-label">From</div>
                            <div class="detail-value">Your Wallet</div>
                        </div>
                        
                        <div class="flow-arrow">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
                            </svg>
                        </div>

                        <div class="detail-section">
                            <div class="detail-label">To</div>
                            <div class="detail-value recipient">
                                <div class="address-info">
                                    <span class="address">{recipientAddress}</span>
                                    <span class="address-badge">{addressType} ID</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="fee-section">
                        <div class="fee-row">
                            <span>Network Fee</span>
                            <span>0.0001 {token.symbol}</span>
                        </div>
                        <div class="fee-row total">
                            <span>Total Amount</span>
                            <span>{(parseFloat(amount) + 0.0001).toFixed(4)} {token.symbol}</span>
                        </div>
                    </div>

                    <div class="warning-box">
                        <div class="warning-icon">⚠️</div>
                        <div class="warning-content">
                            <h4>Important</h4>
                            <ul>
                                <li>Transfers cannot be reversed once confirmed</li>
                                <li>Double-check the recipient address</li>
                                <li>Ensure sufficient balance for transfer + fees</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="confirm-actions">
                    <button 
                        class="cancel-btn" 
                        on:click={() => showConfirmation = false}
                    >
                        Cancel
                    </button>
                    <button 
                        class="confirm-btn" 
                        class:loading={isValidating}
                        on:click={confirmTransfer}
                        disabled={isValidating}
                    >
                        {#if isValidating}
                            <div class="spinner"></div>
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
        @apply flex flex-col gap-8 py-6;
    }

    .id-card {
        @apply bg-white/5 rounded-2xl p-6 mb-4;
    }

    .id-header {
        @apply flex justify-between items-center mb-4
               text-white/70 text-sm font-medium;
    }

    .help-btn, .max-btn {
        @apply flex items-center gap-2 px-4 py-2
               bg-white/10 rounded-lg hover:bg-white/20
               transition-all text-white;
    }

    .input-group {
        @apply relative;
    }

    .input-wrapper {
        @apply relative flex items-center;
    }

    .action-button {
        @apply absolute right-2 top-1/2 -translate-y-1/2;
        @apply flex items-center justify-center;
        @apply w-8 h-8 rounded-lg;
        @apply text-sm font-medium;
        @apply bg-white/10 text-white/70;
        @apply hover:bg-white/15 hover:text-white;
        @apply transition-colors;
    }

    input {
        @apply w-full px-4 py-3 bg-black/20 
               rounded-xl text-white transition-all
               border border-white/10 hover:border-white/20
               focus:border-indigo-500 focus:outline-none
               pr-12;
        
        &.error {
            @apply border-red-500/50 bg-red-500/10;
        }
        
        &.valid {
            @apply border-green-500/50;
        }
    }

    .error-message {
        @apply text-red-400 text-sm px-2 mb-4;
    }

    .send-btn {
        @apply w-full py-4 bg-indigo-500 text-white
               rounded-xl font-medium transition-all
               hover:bg-indigo-600 disabled:opacity-50
               disabled:cursor-not-allowed relative
               flex items-center justify-center;
    }

    /* Confirmation Modal Styles */
    .confirm-box {
        @apply p-8 flex flex-col gap-8;
    }

    .confirm-details {
        @apply space-y-8;
    }

    .network-info {
        @apply flex justify-center;
    }

    .network-badge {
        @apply flex items-center gap-2 px-4 py-2 
               bg-purple-500/10 rounded-full border border-purple-500/20;
    }

    .network-icon {
        @apply w-5 h-5;
    }

    .transfer-summary {
        @apply flex flex-col items-center gap-2 py-4;
    }

    .summary-label {
        @apply text-white/60 text-sm;
    }

    .amount-display {
        @apply flex items-baseline gap-2;
    }

    .amount-value {
        @apply text-3xl font-bold text-white;
    }

    .token-symbol {
        @apply text-xl text-white/70;
    }

    .usd-value {
        @apply text-white/50 text-sm;
    }

    .transfer-details {
        @apply space-y-4 bg-black/20 rounded-2xl p-6;
    }

    .detail-section {
        @apply space-y-2;
    }

    .detail-label {
        @apply text-sm text-white/60;
    }

    .detail-value {
        @apply text-white font-medium;
        
        &.recipient {
            @apply space-y-1;
        }
    }

    .address-info {
        @apply flex flex-col gap-1;
    }

    .address {
        @apply font-mono text-sm break-all bg-black/20 
               p-3 rounded-lg border border-white/5;
    }

    .address-badge {
        @apply inline-flex items-center px-2 py-1
               rounded-md bg-white/10 text-white/70 
               text-xs w-fit;
    }

    .flow-arrow {
        @apply flex justify-center py-4 text-white/40;
        
        svg {
            @apply w-6 h-6;
        }
    }

    .fee-section {
        @apply space-y-2 bg-black/20 rounded-xl p-4;
    }

    .fee-row {
        @apply flex justify-between text-sm text-white/70;
        
        &.total {
            @apply pt-2 border-t border-white/10 
                   text-white font-medium;
        }
    }

    .warning-box {
        @apply flex gap-4 p-6 bg-yellow-500/10 
               rounded-xl border border-yellow-500/20;
    }

    .warning-content {
        @apply space-y-2;
        
        h4 {
            @apply text-yellow-500 font-medium;
        }
        
        ul {
            @apply text-sm text-yellow-500/90 space-y-1 list-disc pl-4;
        }
    }

    .warning-icon {
        @apply text-xl;
    }

    .confirm-actions {
        @apply flex gap-4 pt-4 border-t border-white/10;
    }

    .cancel-btn {
        @apply flex-1 py-3 bg-white/10 text-white/90
               rounded-xl font-medium transition-all
               hover:bg-white/20;
    }

    .confirm-btn {
        @apply flex-[2] py-3 bg-indigo-500 text-white
               rounded-xl font-medium transition-all
               hover:bg-indigo-600 disabled:opacity-50
               disabled:cursor-not-allowed
               flex items-center justify-center gap-2;

        &.loading {
            @apply bg-indigo-500/50;
        }
    }

    .spinner {
        @apply w-5 h-5 border-2 border-white/20 
               border-t-white rounded-full animate-spin;
    }

    @media (max-width: 640px) {
        .container {
            @apply gap-6 py-4;
        }

        .id-card {
            @apply p-4;
        }
        
        .confirm-box {
            @apply p-4;
        }
        
        .transfer-details {
            @apply p-4;
        }
        
        .warning-box {
            @apply p-4;
        }
    }

    .validation-status {
        @apply flex items-center gap-2 mt-2 px-2;
        @apply text-sm;

        &.success {
            @apply text-green-400;
        }

        &.error {
            @apply text-red-400;
        }
    }

    .status-icon {
        @apply flex items-center justify-center;
    }

    .status-text {
        @apply font-medium;
    }
</style>
// End of Selection
