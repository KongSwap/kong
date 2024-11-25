<script lang="ts">
    import { fade } from 'svelte/transition';
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
                    <span>💡</span>
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
                        {#if recipientAddress}✕{:else}📋{/if}
                    </button>
                </div>
                
                {#if recipientAddress}
                    <div class="validation-status" class:success={addressType !== null} class:error={addressType === null}>
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
            Send Tokens
        </button>
    </form>

    {#if showHelp}
        <Modal
            isOpen={showHelp}
            onClose={() => showHelp = false}
            title="How to Send Tokens"
            width="min(600px, 95vw)"
            height="auto"
        >
            <div class="help-content">
                <div class="help-section">
                    <h3>Supported Address Types</h3>
                    <div class="address-types">
                        <div class="address-type">
                            <span class="icon">🔑</span>
                            <div>
                                <h4>Principal ID</h4>
                                <p>The native identifier for Internet Computer users and canisters.</p>
                                <code class="example">
                                    2vxsx-fae3i-kkp2w-yxca6-g44zk-<wbr>
                                    o3br2-xjqyl-cmxgg-4kew2-2y7mh-pae
                                </code>
                                <ul class="features">
                                    <li>Length: 27-29 characters with dashes</li>
                                    <li>Used for direct canister interactions</li>
                                    <li>Common within ecosystem</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <div class="address-type">
                            <span class="icon">📝</span>
                            <div>
                                <h4>Account ID</h4>
                                <p>A derived address used specifically for token transactions.</p>
                                <code class="example">
                                    03e3d86f29a069c6f2c5c48e01bc084e<wbr>
                                    4ea18ad02b0eec8fccadf4487183c223
                                </code>
                                <ul class="features">
                                    <li>Always 64 characters (hexadecimal)</li>
                                    <li>Derived from Principal ID</li>
                                    <li>Used by most wallet apps (Plug, Stoic, AstroX)</li>
                                    <li>More secure for token operations</li>
                                    <li>Common for CEXs</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="divider"></div>
                
                <div class="help-section">
                    <h3>Which One Should I Use?</h3>
                    <div class="guidance">
                        <div class="choice-section">
                            <h4>Use Account ID for:</h4>
                            <ul>
                                <li>Sending to wallet apps (NFID, NNS, Oisy)</li>
                                <li>When you see a 64-character hex address</li>
                                <li>Most token transfers (safer option)</li>
                            </ul>
                        </div>
                        
                        <div class="choice-divider"></div>
                        
                        <div class="choice-section">
                            <h4>Use Principal ID for:</h4>
                            <ul>
                                <li>Sending to canisters directly</li>
                                <li>When you see a dashed format address</li>
                                <li>Developer interactions</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="divider"></div>
                
                <div class="warning-box">
                    <span class="warning-icon">⚠️</span>
                    <div class="warning-content">
                        <h4>Important Safety Tips</h4>
                        <ul>
                            <li>Always double-check addresses before sending</li>
                            <li>Start with small test amounts for new recipients</li>
                            <li>Transfers cannot be reversed once confirmed</li>
                            <li>Keep your Principal ID private if using it for authentication</li>
                        </ul>
                        <a href="https://internetcomputer.org/docs/current/developer-docs/defi/wallets/overview" target="_blank" rel="noopener" class="learn-more">
                            Learn more about IC wallets →
                        </a>
                    </div>
                </div>
            </div>
        </Modal>
    {/if}

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

    .help-btn, .max-btn {
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

    .help-content {
        @apply p-6 space-y-6;
        
        a {
            @apply text-indigo-400 hover:text-indigo-300 hover:underline;
        }

        .example {
            @apply block p-2 my-2 bg-black/20 rounded font-mono text-xs md:text-sm 
                   text-indigo-300 break-all leading-relaxed;
            
            wbr {
                @apply select-none;
            }
        }

        .guidance {
            @apply space-y-6;

            .choice-section {
                @apply bg-white/5 rounded-lg p-4;

                h4 {
                    @apply text-sm font-medium text-indigo-300 mb-3;
                }

                ul {
                    @apply space-y-2;
                    li {
                        @apply flex items-center gap-2 text-sm text-white/70
                               before:content-['•'] before:text-indigo-400;
                    }
                }
            }

            .choice-divider {
                @apply border-t border-white/10 my-2;
            }
        }

        .learn-more {
            @apply block mt-4 text-sm font-medium;
        }

        .help-section {
            @apply space-y-4;
            
            h3 {
                @apply text-xl font-medium text-white/90 mb-4;
            }
        }

        .divider {
            @apply my-6 border-t border-white/10;
        }

        .address-types {
            @apply space-y-6;
        }

        .address-type {
            @apply flex items-start gap-4 p-5 rounded-lg bg-white/5;

            .icon {
                @apply text-2xl;
            }

            h4 {
                @apply font-medium text-lg text-white/90 mb-2;
            }

            p {
                @apply text-sm text-white/70 mb-2;
            }

            .example {
                @apply block p-2 my-2 bg-black/20 rounded font-mono text-sm text-indigo-300;
            }

            .features {
                @apply mt-3 space-y-1 text-sm text-white/70;
                li {
                    @apply flex items-center gap-2 before:content-['•'] before:text-indigo-400;
                }
            }
        }

        .warning-box {
            @apply flex items-start gap-4 p-5 rounded-lg bg-yellow-500/10 border border-yellow-500/20;
            
            .warning-icon {
                @apply text-xl;
            }

            .warning-content {
                @apply flex-1;
                
                h4 {
                    @apply font-medium text-yellow-200/90 mb-2;
                }

                ul {
                    @apply space-y-1 text-sm text-yellow-100/80;
                    li {
                        @apply flex items-center gap-2 before:content-['•'] before:text-yellow-500;
                    }
                }
            }
        }
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
