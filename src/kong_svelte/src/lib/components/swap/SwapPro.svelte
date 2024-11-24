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
    
    // Add nav height constant
    const NAV_HEIGHT = 64; // Assuming 64px nav height, adjust as needed

    let fromToken = initialFromToken;
    let toToken = initialToToken;
    let chart: any;
    let activeHistoryTab: 'my' | 'pair' | 'orders' = 'my';
    let isChartMinimized = false;
    let isFullscreen = false;
    let isMobile: boolean;
    let containerHeight: number;
    let chartContainer: HTMLElement;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: 'normal' | 'pro' };
    }>();

    function initChart() {
        if (window.TradingView) {
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
                "container_id": "tradingview_chart",
                "height": "100%",
                "width": "100%"
            });
        }
    }

    onMount(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        isMobile = mediaQuery.matches;
        
        const handleResize = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
            if (chart) {
                chart.resize();
            }
        };
        
        mediaQuery.addEventListener('change', handleResize);
        
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
            initChart();
        };
        document.head.appendChild(script);

        return () => {
            mediaQuery.removeEventListener('change', handleResize);
            if (chart) {
                try {
                    chart.remove();
                } catch (e) {
                    console.error('Error cleaning up chart:', e);
                }
            }
        };
    });

    $: if (isFullscreen && chart) {
        setTimeout(() => {
            chart.resize();
        }, 100);
    }

</script>

<div 
    class="swap-pro-container" 
>
    <div class="layout-container">
        <div class="main-content" class:mobile={isMobile}>
            <!-- Chart Area -->
            <Panel 
                variant="green" 
                type="main" 
                className={`chart-area ${isChartMinimized ? 'minimized' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
                width="100%"
                height="100%"
            >
                <div class="chart-controls">
                    <div class="chart-buttons">
                        <button 
                            class="chart-control-btn"
                            on:click={() => isFullscreen = !isFullscreen}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                {#if isFullscreen}
                                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                                {:else}
                                    <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
                                {/if}
                            </svg>
                        </button>
                        <button 
                            class="chart-control-btn"
                            on:click={() => isChartMinimized = !isChartMinimized}
                            title={isChartMinimized ? 'Maximize' : 'Minimize'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                {#if isChartMinimized}
                                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                                {:else}
                                    <path d="M4 14h6m-6-4h6m4 0h6m-6 4h6" />
                                {/if}
                            </svg>
                        </button>
                    </div>
                </div>
                <div 
                    class="chart-wrapper" 
                    class:minimized={isChartMinimized}
                    class:fullscreen={isFullscreen}
                    bind:this={chartContainer}
                >
                    <div id="tradingview_chart" class="chart-placeholder">
                    </div>
                </div>
            </Panel>

            <!-- Right side panels -->
            <div class="right-panels" class:mobile={isMobile}>
                <div class="swap-section">
                    <Swap 
                        initialFromToken={fromToken} 
                        initialToToken={toToken} 
                        currentMode={currentMode}
                        on:modeChange
                    />
                </div>

                <!-- Transaction History Section -->
                <Panel variant="green" type="main" className="history-section">
                    <div class="history-header">
                        <div class="tab-navigation">
                            <button
                                class="tab-button"
                                class:active={activeHistoryTab === 'my'}
                                on:click={() => activeHistoryTab = 'my'}
                            >
                                <div class="tab-content">
                                    <span>My Swaps</span>
                                    {#if activeHistoryTab === 'my'}
                                        <img src="/stats/banana.webp" class="tab-icon" alt="" />
                                    {/if}
                                </div>
                            </button>
                            <button
                                class="tab-button"
                                class:active={activeHistoryTab === 'pair'}
                                on:click={() => activeHistoryTab = 'pair'}
                            >
                                <div class="tab-content">
                                    <span>Market Swaps</span>
                                    {#if activeHistoryTab === 'pair'}
                                        <img src="/stats/banana.webp" class="tab-icon" alt="" />
                                    {/if}
                                </div>
                            </button>
                        </div>
                    </div>
                    <div class="history-content">
                        <TransactionHistory />
                    </div>
                </Panel>
            </div>
        </div>
    </div>
</div>

<style lang="postcss">
    .swap-pro-container {
        width: 100%;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        background: var(--color-background);
        overflow: hidden;
        position: relative;
        padding: 0 1rem;
    }

    .layout-container {
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .main-content {
        display: flex;
        gap: 0.5rem;
        flex: 1;
        overflow: hidden;
    }

    .chart-controls {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 102;
        display: flex;
        gap: 0.5rem;
        opacity: 0.4;
        transition: opacity 0.2s ease;
    }

    .chart-controls:hover {
        opacity: 1;
    }

    .chart-buttons {
        display: flex;
        gap: 0.25rem;
        background: var(--color-background);
        padding: 0.25rem;
        border-radius: 0.5rem;
        border: 1px solid var(--color-border);
        backdrop-filter: blur(8px);
    }

    .chart-control-btn {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        width: 2rem;
        height: 2rem;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--color-text-secondary);
    }

    .chart-control-btn:hover {
        background: var(--color-background);
        color: var(--color-text);
    }

    .chart-control-btn svg {
        transition: transform 0.2s ease;
    }

    .chart-control-btn:hover svg {
        transform: scale(1.1);
    }

    .chart-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
        transition: all 0.3s ease;
    }

    .chart-wrapper.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 999;
        background: var(--color-background);
    }

    .chart-wrapper.fullscreen :global(.tradingview-widget-container),
    .chart-wrapper.fullscreen :global(.tradingview-widget-container > div),
    .chart-wrapper.fullscreen :global(#tradingview_chart) {
        width: 100vw !important;
        height: 100vh !important;
    }

    .chart-controls {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        display: flex;
        gap: 0.5rem;
        opacity: 0.4;
        transition: opacity 0.2s ease;
    }

    .chart-wrapper.minimized {
        opacity: 0;
        pointer-events: none;
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

    /* TODO will be different for pixel */
    .right-panels {
        display: flex;
        flex-direction: column;
        min-width: 500px;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        gap: 0.25rem; /* Gap between panels  pixel todo*/
    }

    .swap-section {
        flex: 0 0 auto;
    }

    .history-header {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    /* Modern theme specific styles */
    :global([data-theme="modern"]) .history-header {
        min-height: 140px;
    }

    .history-content {
        flex: 1;
        overflow: auto;
    }

    .history-header {
        flex-shrink: 0;
        background: var(--color-background);
        border-bottom: 2px solid var(--color-border);
        z-index: 10;
    }

    .tab-navigation {
        display: flex;
        gap: 1rem;
        margin-bottom: -2px;
    }

    .tab-button {
        position: relative;
        padding: 0.75rem 1rem;
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 2px solid transparent;
        white-space: nowrap;
    }

    .tab-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .tab-icon {
        width: 1.25rem;
        height: 1.25rem;
        object-fit: contain;
    }

    /* Pixel theme specific styles */
    :global([data-theme="pixel"]) .tab-button {
        font-family: 'Press Start 2P', cursive;
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
    }

    :global([data-theme="pixel"]) .tab-icon {
        image-rendering: pixelated;
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

    /* Mobile styles */
    .main-content.mobile {
        flex-direction: column;
        height: auto;
        max-height: calc(100% - 0.5rem);
    }

    .right-panels.mobile {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        flex: 0 0 auto;
    }

    @media (min-width: 1920px) {
        .right-panels {
            max-width: 600px;
        }
    }

    @media (max-width: 1200px) {
        .right-panels {
            width: 400px;
            flex: 0 0 400px;
        }
    }
</style>
