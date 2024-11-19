<script lang="ts">
    import { fade } from "svelte/transition";
    import Swap from "./Swap.svelte";
    import TransactionHistory from "../sidebar/TransactionHistory.svelte";
    import Panel from "$lib/components/common/Panel.svelte";
    import { onMount } from "svelte";
    import { createEventDispatcher } from 'svelte';

    export let initialFromToken: FE.Token | null = null;
    export let initialToToken: FE.Token | null = null;
    export let currentMode: 'normal' | 'pro' = 'pro';

    let fromToken = initialFromToken;
    let toToken = initialToToken;
    let chart: any;
    let activeHistoryTab: 'my' | 'pair' | 'orders' = 'my';

    const dispatch = createEventDispatcher<{
        modeChange: { mode: 'normal' | 'pro' };
    }>();

    onMount(() => {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
            if (window.TradingView) {
                // Small delay to ensure container is ready
                setTimeout(() => {
                    chart = new window.TradingView.widget({
                        "autosize": true,
                        "symbol": "BINANCE:BTCUSDT",
                        "interval": "D",
                        "timezone": "Etc/UTC",
                        "theme": "dark",
                        "style": "1",
                        "locale": "en",
                        "toolbar_bg": "#f1f3f6",
                        "enable_publishing": false,
                        "hide_side_toolbar": false,
                        "allow_symbol_change": true,
                        "container_id": "tradingview_chart"
                    });
                }, 100);
            }
        };
        document.head.appendChild(script);

        return () => {
            if (chart) {
                try {
                    // Clean up chart if possible
                    chart.remove();
                } catch (e) {
                    console.error('Error cleaning up chart:', e);
                }
            }
        };
    });

    function handleFromTokenSelect() {
        // TODO: Implement token selection
    }

    function handleToTokenSelect() {
        // TODO: Implement token selection
    }

    function handleFromAmountChange(event: CustomEvent) {
        // TODO: Implement amount change
    }

    function handleToAmountChange(event: CustomEvent) {
        // TODO: Implement amount change
    }
</script>

<div class="swap-pro-container" in:fade={{ duration: 420 }}>
    <div class="layout-container">
        <!-- Main content section -->
        <div class="main-content">
            <!-- Chart Area -->
            <Panel 
                variant="green" 
                type="main" 
                className="chart-area"
                width="100%"
                height="100%"
            >
                <div class="chart-wrapper">
                    <div id="tradingview_chart" class="chart-placeholder">
                    </div>
                </div>
            </Panel>

            <!-- Right side panels -->
            <div class="right-panels">
                <Swap 
                    initialFromToken={fromToken} 
                    initialToToken={toToken} 
                    currentMode={currentMode}
                    on:modeChange
                />
                
            </div>
        </div>

        <!-- Transaction History Section -->
        <Panel
            variant="green"
            type="main"
            className="transaction-history"
            width="100%"
            height="40%"
        >
            <div class="history-container">
                <div class="history-header">
                    <div class="tab-navigation">
                        <button
                            class="tab-button"
                            class:active={activeHistoryTab === 'my'}
                            on:click={() => activeHistoryTab = 'my'}
                        >
                            {#if activeHistoryTab === 'my'}
                                <img src="/stats/banana.webp" class="w-5 h-5 mr-1.5 object-contain" alt="" />
                            {/if}
                            My History
                            {#if activeHistoryTab === 'my'}
                                <img src="/stats/banana.webp" class="w-5 h-5 ml-1.5 object-contain" alt="" />
                            {/if}
                        </button>
                        <button
                            class="tab-button"
                            class:active={activeHistoryTab === 'pair'}
                            on:click={() => activeHistoryTab = 'pair'}
                        >
                            {#if activeHistoryTab === 'pair'}
                                <img src="/stats/banana.webp" class="w-5 h-5 mr-1.5 object-contain" alt="" />
                            {/if}
                            Pair History
                            {#if activeHistoryTab === 'pair'}
                                <img src="/stats/banana.webp" class="w-5 h-5 ml-1.5 object-contain" alt="" />
                            {/if}
                        </button>
                        <button
                            class="tab-button"
                            class:active={activeHistoryTab === 'orders'}
                            on:click={() => activeHistoryTab = 'orders'}
                        >
                            {#if activeHistoryTab === 'orders'}
                                <img src="/stats/banana.webp" class="w-5 h-5 mr-1.5 object-contain" alt="" />
                            {/if}
                            My Active Orders
                            {#if activeHistoryTab === 'orders'}
                                <img src="/stats/banana.webp" class="w-5 h-5 ml-1.5 object-contain" alt="" />
                            {/if}
                        </button>
                    </div>
                </div>
                
                {#if activeHistoryTab === 'my'}
                    <TransactionHistory />
                {:else if activeHistoryTab === 'pair'}
                    <div class="placeholder-content">
                        <p>Pair history coming soon</p>
                    </div>
                {:else}
                    <div class="placeholder-content">
                        <p>Active orders coming soon</p>
                    </div>
                {/if}
            </div>
        </Panel>
    </div>
</div>

<style lang="postcss">
    .swap-pro-container {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--color-background);
    }

    .layout-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 0 1rem 1rem 1rem;
        min-height: 0;
        margin: 0 auto;
        width: 100%;
    }

    .main-content {
        display: flex;
        gap: 1rem;
        height: 70%;
        min-height: 0;
    }

    .chart-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .chart-placeholder {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-background-secondary);
        border-radius: 0.5rem;
        overflow: hidden;
    }

    .right-panels {
        display: flex;
        flex-direction: column;
        width: 400px;
        flex-shrink: 0;
    }

    .history-container {
        height: 100%;
        overflow-y: auto;
    }

    .history-header {
        margin-bottom: 1rem;
        border-bottom: 2px solid var(--color-border);
        padding: 0 0.5rem;
    }

    .tab-navigation {
        display: flex;
        gap: 1.5rem;
        margin-bottom: -2px;
    }

    .tab-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1rem;
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        font-size: 1.125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 2px solid transparent;
    }

    .tab-button:hover {
        color: var(--color-text);
    }

    .tab-button.active {
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 2px solid #ffcd1f;
    }

    :global([data-theme="pixel"]) .tab-button {
        font-family: 'Press Start 2P', cursive;
        font-size: 0.75rem;
        padding: 0.75rem;
    }

    :global([data-theme="pixel"]) .tab-button.active {
        background: #ffcd1f;
        border: 2px solid black;
        border-bottom: none;
        margin-bottom: -1px;
        color: black;
    }

    .placeholder-content {
        display: flex;
        align-items: center;
        justify-content: center;
        height: calc(100% - 3rem);
        color: var(--color-text-secondary);
        font-style: italic;
    }

    :global(#tradingview_chart),
    :global(.tradingview-widget-container) {
        width: 100% !important;
        height: 100% !important;
    }

    :global(.tradingview-widget-container > div) {
        width: 100% !important;
        height: 100% !important;
    }

</style>
