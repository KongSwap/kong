<script lang="ts">
    import { fade } from 'svelte/transition';
    import { backOut } from 'svelte/easing';
    import { tweened } from 'svelte/motion';
    import { IcrcService } from "$lib/services/icrc/IcrcService";
    import { tokenLogoStore } from "$lib/services/tokens/tokenLogos";
    import { toastStore } from "$lib/stores/toastStore";
    import { Principal } from "@dfinity/principal";
    import Button from '$lib/components/common/Button.svelte';

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

    const progress = tweened(0, {
        duration: 1000,
        easing: backOut
    });

    function detectAddressType(address: string): 'principal' | 'account' | null {
        try {
            Principal.fromText(address);
            return 'principal';
        } catch {
            if (address.length === 64) {
                return 'account';
            }
            return null;
        }
    }

    function validateAddress(address: string): boolean {
        const type = detectAddressType(address);
        addressType = type;
        return type !== null;
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
        
        // Only allow one decimal point
        const decimalPoints = value.match(/\./g)?.length || 0;
        if (decimalPoints > 1) {
            value = value.slice(0, value.lastIndexOf('.'));
        }

        // Limit decimal places to token decimals
        const parts = value.split('.');
        if (parts[1] && parts[1].length > token.decimals) {
            value = `${parts[0]}.${parts[1].slice(0, token.decimals)}`;
        }

        amount = value;
        errorMessage = '';
        validateAmount(value);
    }

    async function handleSubmit() {
        isValidating = true;
        errorMessage = '';

        if (!validateAddress(recipientAddress)) {
            errorMessage = 'Invalid address format';
            isValidating = false;
            return;
        }

        if (!validateAmount(amount)) {
            isValidating = false;
            return;
        }

        try {
            progress.set(0);
            const decimals = token.decimals || 8;
            const amountBigInt = BigInt(
                Math.floor(parseFloat(amount) * Math.pow(10, decimals))
            );

            const result = await IcrcService.icrc1Transfer(
                token,
                recipientAddress,
                amountBigInt
            );

            if (result?.Ok) {
                toastStore.success("Token sent successfully");
                recipientAddress = '';
                amount = '';
            } else if (result?.Err) {
                const errMsg = typeof result.Err === "object"
                    ? Object.entries(result.Err)[0][0]
                    : JSON.stringify(result.Err);
                errorMessage = `Failed to send token: ${errMsg}`;
                toastStore.error(errorMessage);
            }
        } catch (err) {
            errorMessage = err.message || "Failed to send token";
            toastStore.error(errorMessage);
        } finally {
            isValidating = false;
            await progress.set(1);
        }
    }

    function setMaxAmount() {
        amount = maxAmount.toString();
        errorMessage = '';
    }

    function formatBalance(amount: string, decimals: number = 8): string {
        const num = parseFloat(amount);
        if (isNaN(num)) return '0';
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    }

    $: addressTypeText = addressType 
        ? `Detected ${addressType.charAt(0).toUpperCase() + addressType.slice(1)} ID format`
        : 'Enter Principal ID or Account ID';
</script>

<div class="send-container">
    <div class="header">
        <div class="token-info">
            <img
                src={$tokenLogoStore[token.canister_id] ?? "/tokens/not_verified.webp"}
                alt={token.symbol}
                class="token-logo"
            />
            <div class="token-details">
                <span class="token-name">{token.symbol}</span>
                <div class="balance-display">
                    <span class="balance-label">Available:</span>
                    <span class="balance-amount">{formatBalance(token.amount, token.decimals)} {token.symbol}</span>
                </div>
            </div>
        </div>
    </div>

    <form class="send-form" on:submit|preventDefault={handleSubmit}>
        <div class="input-group">
            <label for="recipient" class="input-label">Recipient</label>
            <div class="input-wrapper">
                <input
                    type="text"
                    id="recipient"
                    bind:value={recipientAddress}
                    placeholder="Enter Principal ID or Account ID"
                    class:error={errorMessage.includes('address')}
                    class:valid={addressType !== null}
                />
                {#if addressType}
                    <div class="validation-badge">
                        <span class="validation-icon">✓</span>
                        <span>{addressType}</span>
                    </div>
                {/if}
            </div>
        </div>

        <div class="input-group">
            <label class="input-label">Amount</label>
            <div class="amount-input-wrapper">
                <input
                    type="text"
                    inputmode="decimal"
                    placeholder="0.00"
                    bind:value={amount}
                    on:input={handleAmountInput}
                    class:error={errorMessage.includes('balance') || errorMessage.includes('Amount')}
                />
                <button type="button" class="max-button" on:click={setMaxAmount}>
                    <span class="max-text">MAX</span>
                </button>
            </div>
        </div>

        {#if errorMessage}
            <div class="error-message" in:fade>
                <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12" y2="16" />
                </svg>
                {errorMessage}
            </div>
        {/if}

        <Button
            type="submit"
            variant="yellow"
            text={isValidating ? "Sending..." : `Send ${token.symbol}`}
            disabled={isValidating || !amount || !recipientAddress}
            loading={isValidating}
            size="lg"
            class="send-button"
        />
    </form>
</div>

<style lang="postcss">
    .send-container {
        @apply flex flex-col;
    }

    .header {
        @apply flex items-center px-6 py-4 border-b border-white/10;
    }

    .token-info {
        @apply flex items-center gap-3 flex-1;
    }

    .token-logo {
        @apply w-10 h-10 rounded-full ring-2 ring-white/10;
    }

    .token-details {
        @apply flex flex-col;
    }

    .token-name {
        @apply text-xl font-bold text-white;
    }

    .balance-display {
        @apply flex items-center gap-1.5 mt-0.5;
    }

    .balance-label {
        @apply text-sm text-white/50;
    }

    .balance-amount {
        @apply text-sm font-medium text-white/90;
    }

    .send-form {
        @apply flex flex-col gap-6 p-6;
    }

    .input-group {
        @apply flex flex-col gap-2;
    }

    .input-label {
        @apply text-sm font-medium text-white/80;
    }

    .input-wrapper {
        @apply relative;
    }

    input {
        @apply w-full px-4 py-3.5 bg-white/5 rounded-xl
               border-2 border-white/10
               text-white placeholder-white/30
               focus:outline-none focus:border-yellow-500/50 focus:bg-white/[0.07]
               transition-all duration-200;
    }

    input.error {
        @apply border-red-500/50 bg-red-500/5;
    }

    input.valid {
        @apply border-green-500/50 bg-green-500/5;
    }

    .validation-badge {
        @apply absolute right-3 top-1/2 -translate-y-1/2
               flex items-center gap-1.5 px-2.5 py-1
               bg-green-500/10 text-green-400
               rounded-full text-xs font-medium;
    }

    .validation-icon {
        @apply text-green-400;
    }

    .amount-input-wrapper {
        @apply relative flex gap-2;
    }

    .max-button {
        @apply px-4 bg-yellow-500/10 text-yellow-500 rounded-xl
               border-2 border-yellow-500/20
               hover:bg-yellow-500/20 hover:border-yellow-500/30
               active:bg-yellow-500/30
               transition-all duration-200
               text-sm font-semibold whitespace-nowrap;
    }

    .max-text {
        @apply tracking-wide;
    }

    .error-message {
        @apply flex items-center gap-2 p-4 
               bg-red-500/10 border border-red-500/20
               text-red-400 rounded-xl text-sm;
    }

    .error-icon {
        @apply w-5 h-5 stroke-2;
    }

    :global(.send-button) {
        @apply w-full mt-2 !rounded-xl !py-3.5 !text-base !font-semibold;
    }

    @media (max-width: 640px) {
        .header {
            @apply px-4 py-4;
        }

        .send-form {
            @apply p-4 gap-4;
        }

        input {
            @apply text-base;
        }

        .max-button {
            @apply px-4 py-3.5;
        }

        :global(.send-button) {
            @apply !py-4;
        }
    }
</style>
