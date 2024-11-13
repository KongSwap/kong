<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { backOut } from 'svelte/easing';
    import { tweened } from 'svelte/motion';

    export let token: {
        symbol: string;
        amount: string;
        icon: string;
    };

    type TokenTransaction = {
        type: 'send' | 'receive';
        amount: string;
        to?: string;
        from?: string;
        timestamp: number;
        status: 'pending' | 'completed' | 'failed';
    };

    let recipientAddress = '';
    let amount;
    let maxAmount = parseFloat(token.amount);
    let isValidating = false;
    let errorMessage = '';

    let tokenTransactions: TokenTransaction[] = [
        {
            type: 'send',
            amount: '0.5',
            to: '0x1234...5678',
            timestamp: Date.now() - 3600000,
            status: 'completed'
        },
        {
            type: 'receive',
            amount: '1.0',
            from: '0x8765...4321',
            timestamp: Date.now() - 86400000,
            status: 'completed'
        }
    ];

    const progress = tweened(0, {
        duration: 1000,
        easing: backOut
    });

    function validateAddress(address: string): boolean {
        // Add your address validation logic here
        return address.startsWith('0x') && address.length === 42;
    }

    function validateAmount(value: string): boolean {
        const numValue = parseFloat(value);
        return !isNaN(numValue) && numValue > 0 && numValue <= maxAmount;
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
            errorMessage = 'Invalid amount';
            isValidating = false;
            return;
        }

        // Simulate transaction progress
        progress.set(0);
        await progress.set(1);

        // Add to transaction history
        tokenTransactions = [{
            type: 'send',
            amount,
            to: recipientAddress,
            timestamp: Date.now(),
            status: 'pending'
        }, ...tokenTransactions];

        // Reset form
        recipientAddress = '';
        amount = '';
        isValidating = false;
    }

    function formatTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} day${days === 1 ? '' : 's'} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        } else {
            return 'just now';
        }
    }

    function setMaxAmount() {
        amount = maxAmount.toString();
    }
</script>

<div class="send-token-container" in:fly={{ y: 20, duration: 300 }}>
    <div class="token-info">
        <div class="token-icon">{token.icon}</div>
        <div class="token-details">
            <span class="token-symbol">{token.symbol}</span>
            <span class="token-balance">Balance: {token.amount}</span>
        </div>
    </div>

    <form class="send-form" on:submit|preventDefault={handleSubmit}>
        <div class="input-group">
            <label for="recipient">Recipient Address</label>
            <input
                type="text"
                id="recipient"
                bind:value={recipientAddress}
                placeholder="0x..."
                class:error={errorMessage.includes('address')}
            />
        </div>

        <div class="input-group">
            <label for="amount">Amount</label>
            <div class="amount-input">
                <input
                    type="number"
                    id="amount"
                    bind:value={amount}
                    placeholder="0.0"
                    step="0.000001"
                    min="0"
                    max={maxAmount}
                    class:error={errorMessage.includes('amount')}
                />
                <button type="button" class="max-button" on:click={setMaxAmount}>MAX</button>
            </div>
        </div>

        {#if errorMessage}
            <div class="error-message" in:fade>
                {errorMessage}
            </div>
        {/if}

        <button type="submit" class="send-button" disabled={isValidating}>
            {#if isValidating}
                <div class="progress-bar" style="width: {$progress * 100}%"></div>
                <span>Processing...</span>
            {:else}
                <span>Send {token.symbol}</span>
            {/if}
        </button>
    </form>

    <div class="transaction-history">
        <h3>Recent Transactions</h3>
        {#if tokenTransactions.length === 0}
            <div class="empty-state">No transactions yet</div>
        {:else}
            {#each tokenTransactions as tx}
                <div class="transaction-item" class:pending={tx.status === 'pending'}>
                    <div class="tx-icon">
                        {tx.type === 'send' ? '↗' : '↙'}
                    </div>
                    <div class="tx-details">
                        <span class="tx-amount">{tx.amount} {token.symbol}</span>
                        <span class="tx-address">
                            {tx.type === 'send' ? `To: ${tx.to}` : `From: ${tx.from}`}
                        </span>
                    </div>
                    <div class="tx-time">
                        {formatTime(tx.timestamp)}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<style lang="scss">
    .send-token-container {
        padding: 1rem;
    }

    .token-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
        padding: 1rem;
        background: rgba(255, 204, 0, 0.1);
        border: 2px solid #ffcc00;
    }

    .token-icon {
        font-size: 2rem;
        width: 3rem;
        height: 3rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        border: 1px solid rgba(255, 204, 0, 0.3);
    }

    .token-details {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .token-symbol {
        font-family: 'Press Start 2P', monospace;
        font-size: 1rem;
        color: #ffcc00;
    }

    .token-balance {
        font-family: monospace;
        color: #aaa;
    }

    .send-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        label {
            font-family: 'Press Start 2P', monospace;
            font-size: 0.75rem;
            color: #ffcc00;
        }

        input {
            padding: 0.75rem;
            background: #000;
            border: 2px solid rgba(255, 204, 0, 0.3);
            color: #fff;
            font-family: monospace;
            transition: all 0.3s ease;

            &:focus {
                border-color: #ffcc00;
                outline: none;
            }

            &.error {
                border-color: #ff4444;
            }
        }
    }

    .amount-input {
        display: flex;
        gap: 0.5rem;

        input {
            flex: 1;
        }
    }

    .max-button {
        padding: 0 1rem;
        background: rgba(255, 204, 0, 0.1);
        border: 2px solid #ffcc00;
        color: #ffcc00;
        font-family: 'Press Start 2P', monospace;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
            background: #ffcc00;
            color: #000;
        }
    }

    .error-message {
        color: #ff4444;
        font-size: 0.875rem;
        padding: 0.5rem;
        background: rgba(255, 68, 68, 0.1);
        border: 1px solid rgba(255, 68, 68, 0.3);
    }

    .send-button {
        position: relative;
        padding: 1rem;
        background: #000;
        border: 2px solid #ffcc00;
        color: #ffcc00;
        font-family: 'Press Start 2P', monospace;
        font-size: 0.875rem;
        cursor: pointer;
        overflow: hidden;
        transition: all 0.3s ease;

        &:hover:not(:disabled) {
            background: #ffcc00;
            color: #000;
        }

        &:disabled {
            opacity: 0.7;
            cursor: wait;
        }
    }

    .progress-bar {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: rgba(255, 204, 0, 0.2);
        transition: width 0.3s ease;
    }

    .transaction-history {
        h3 {
            font-family: 'Press Start 2P', monospace;
            font-size: 0.875rem;
            color: #ffcc00;
            margin-bottom: 1rem;
        }
    }

    .transaction-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(26, 71, 49, 0.1);
        border: 1px solid rgba(255, 204, 0, 0.3);
        margin-bottom: 0.5rem;
        transition: all 0.3s ease;

        &:hover {
            transform: translateX(5px);
            border-color: #ffcc00;
        }

        &.pending {
            border-style: dashed;
            animation: pulse 2s infinite;
        }
    }

    .tx-icon {
        font-size: 1.25rem;
        color: #ffcc00;
    }

    .tx-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .tx-amount {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.75rem;
        color: #ffcc00;
    }

    .tx-address {
        font-family: monospace;
        font-size: 0.75rem;
        color: #aaa;
    }

    .tx-time {
        font-size: 0.75rem;
        color: #666;
    }

    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }

    @media (max-width: 768px) {
        .token-info {
            padding: 0.75rem;
        }

        .token-icon {
            font-size: 1.5rem;
            width: 2.5rem;
            height: 2.5rem;
        }

        .token-symbol {
            font-size: 0.875rem;
        }

        .send-button {
            padding: 0.75rem;
            font-size: 0.75rem;
        }
    }
</style>
