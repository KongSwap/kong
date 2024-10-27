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
    class="token-item pixel-corners"
    class:selected
    on:click={onSelect}
    on:mouseenter={onHover}
>
    <div class="pixel-border-left"></div>
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
    <div class="shine-effect"></div>
</button>

<style>
    :root {
        --sidebar-bg: #1a3121;
        --sidebar-bg-rgb: 26, 49, 33;
        --sidebar-border: #ffcc00;
        --sidebar-border-rgb: 255, 204, 0;
        --sidebar-border-dark: #cc9900;
        --shadow-color: rgba(0, 0, 0, 0.3);
        --shine-color: rgba(255, 255, 255, 0.1);
        --text-secondary: #aaaaaa;
        --border-width: 4px;
    }
    .token-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--sidebar-bg);
        border: 2px solid var(--sidebar-border);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: center left;
        width: 100%;
        text-align: left;
        color: inherit;
        font-family: inherit;
        overflow: hidden;
    }

    .pixel-border-left {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--border-width);
        height: 100%;
        background: var(--sidebar-border);
        clip-path: polygon(
            0 0,
            100% 4px,
            100% calc(100% - 4px),
            0 100%,
            0 calc(100% - 8px),
            50% calc(100% - 12px),
            50% 12px,
            0 8px
        );
    }

    .shine-effect {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%);
        pointer-events: none;
        opacity: 0.5;
        transition: opacity 0.3s ease;
    }

    .token-item:hover .shine-effect {
        opacity: 0.8;
    }

    .token-item:hover,
    .token-item.selected {
        background: linear-gradient(90deg, 
            rgba(var(--sidebar-border-rgb), 0.15), 
            rgba(var(--sidebar-bg-rgb), 0.05)
        );
        border-color: var(--sidebar-border-dark);
        transform: translateX(8px) scale(1.01);
        box-shadow: -4px 4px 16px var(--shadow-color);
    }

    .selector-arrow {
        position: absolute;
        left: calc(var(--border-width) + 4px);
        color: var(--sidebar-border-dark);
        font-size: 14px;
        opacity: 0;
        transition: all 0.2s ease;
        text-shadow: 0 0 8px var(--shadow-color);
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
        background: rgba(var(--sidebar-border-rgb), 0.1);
        border-radius: 8px;
        border: 1px solid rgba(var(--sidebar-border-rgb), 0.2);
        margin-left: calc(var(--border-width) + 16px);
    }

    .token-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    }

    .token-symbol {
        color: var(--sidebar-border-dark);
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        text-shadow: 1px 1px 0 var(--shadow-color);
    }

    .token-amount {
        color: var(--text-secondary);
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
        color: var(--sidebar-border-dark);
        opacity: 0.6;
    }

    .action-arrow {
        color: var(--sidebar-border-dark);
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
            margin-left: calc(var(--border-width) + 12px);
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

        .selector-arrow {
            left: calc(var(--border-width) + 2px);
            font-size: 12px;
        }
    }
</style>
