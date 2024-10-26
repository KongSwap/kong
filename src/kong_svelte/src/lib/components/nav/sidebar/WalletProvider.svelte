<script lang="ts">
    export let provider: {
        name: string;
        icon: string;
        description: string;
    };
    export let selected: boolean;
    export let onSelect: () => void;
    export let onHover: () => void;
</script>

<button 
    class="wallet-provider"
    class:selected
    on:click={onSelect}
    on:mouseenter={onHover}
>
    <div class="selector-arrow">▶</div>
    {@html provider.icon}
    <div class="wallet-info">
        <span class="wallet-name">{provider.name}</span>
        <span class="wallet-description">{provider.description}</span>
    </div>
</button>

<style>
    .wallet-provider {
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

    .wallet-provider:hover,
    .wallet-provider.selected {
        background: linear-gradient(90deg, rgba(255, 204, 0, 0.15), rgba(26, 71, 49, 0.05));
        border-color: #ffcc00;
        transform: translateX(15px) scale(1.02);
        box-shadow: 0 0 20px rgba(255, 204, 0, 0.2);
    }

    .selector-arrow {
        position: absolute;
        left: -20px;
        color: #ffcc00;
        font-size: 14px;
        opacity: 0;
        transition: all 0.2s ease;
        text-shadow: 0 0 8px rgba(255, 204, 0, 0.5);
    }

    .wallet-provider.selected .selector-arrow {
        opacity: 1;
        animation: arrowBounce 0.5s infinite alternate;
    }

    .wallet-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    }

    .wallet-name {
        color: #ffcc00;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        text-shadow: 2px 2px 0 #000;
    }

    .wallet-description {
        color: #aaaaaa;
        font-size: 12px;
        font-family: monospace;
        opacity: 0.8;
    }

    @keyframes arrowBounce {
        from { transform: translateX(0); }
        to { transform: translateX(5px); }
    }

    @media (max-width: 768px) {
        .wallet-provider {
            padding: 12px;
        }

        .wallet-provider:hover,
        .wallet-provider.selected {
            transform: translateX(5px) scale(1.01);
        }

        .wallet-name {
            font-size: 12px;
        }

        .wallet-description {
            font-size: 10px;
        }
    }
</style>
