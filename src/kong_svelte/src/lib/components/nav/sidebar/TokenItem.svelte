<script lang="ts">
    export let token: {
        symbol: string;
        amount: string;
        icon: string;
    };
    export let selected: boolean;
    export let onSelect: () => void;
    export let onHover: () => void;
</script>

<button 
    class="token-item"
    class:selected
    on:click={onSelect}
    on:mouseenter={onHover}
>
    <div class="selector-arrow">▶</div>
    <div class="token-icon">{token.icon}</div>
    <div class="token-info">
        <span class="token-symbol">{token.symbol}</span>
        <span class="token-amount">{token.amount}</span>
    </div>
    <div class="token-action-hint">
        <span class="action-text">SEND</span>
        <span class="action-arrow">→</span>
    </div>
</button>

<style>
    .token-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: rgba(26, 71, 49, 0.1);
        border: 2px solid rgba(255, 204, 0, 0.3);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: center left;
        width: 100%;
        text-align: left;
        color: inherit;
        font-family: inherit;
    }

    .token-item:hover,
    .token-item.selected {
        background: linear-gradient(90deg, rgba(255, 204, 0, 0.15), rgba(26, 71, 49, 0.05));
        border-color: #ffcc00;
        transform: translateX(8px) scale(1.01);
        box-shadow: 0 0 15px rgba(255, 204, 0, 0.15);
    }

    .selector-arrow {
        position: absolute;
        left: -15px;
        color: #ffcc00;
        font-size: 14px;
        opacity: 0;
        transition: all 0.2s ease;
        text-shadow: 0 0 8px rgba(255, 204, 0, 0.5);
    }

    .token-item.selected .selector-arrow {
        opacity: 1;
        animation: arrowBounce 0.5s infinite alternate;
    }

    .token-icon {
        font-size: 24px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 204, 0, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(255, 204, 0, 0.2);
    }

    .token-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    }

    .token-symbol {
        color: #ffcc00;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        text-shadow: 2px 2px 0 #000;
    }

    .token-amount {
        color: #aaaaaa;
        font-size: 12px;
        font-family: monospace;
        opacity: 0.8;
    }

    .token-action-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        transform: translateX(-10px);
        transition: all 0.3s ease;
    }

    .token-item:hover .token-action-hint,
    .token-item.selected .token-action-hint {
        opacity: 1;
        transform: translateX(0);
    }

    .action-text {
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        color: #ffcc00;
        opacity: 0.6;
    }

    .action-arrow {
        color: #ffcc00;
        font-size: 14px;
        animation: arrowPulse 1s infinite alternate;
    }

    @keyframes arrowBounce {
        from { transform: translateX(0); }
        to { transform: translateX(3px); }
    }

    @keyframes arrowPulse {
        from { opacity: 0.4; transform: translateX(0); }
        to { opacity: 1; transform: translateX(2px); }
    }

    @media (max-width: 768px) {
        .token-item {
            padding: 12px;
        }

        .token-item:hover,
        .token-item.selected {
            transform: translateX(4px) scale(1.005);
        }

        .token-icon {
            font-size: 20px;
            width: 28px;
            height: 28px;
        }

        .token-symbol {
            font-size: 12px;
        }

        .token-amount {
            font-size: 10px;
        }

        .action-text {
            font-size: 8px;
        }
    }
</style>
