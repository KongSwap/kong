<script lang="ts">
    import { fade } from "svelte/transition";
    import Swap from "./Swap.svelte";
    import TokenSelectorButton from "./swap_ui/TokenSelectorButton.svelte";
    import SwapPanel from "./swap_ui/SwapPanel.svelte";
    import SlippageSection from "./swap_ui/settings/SlippageSection.svelte";
    import TransactionHistory from "../sidebar/TransactionHistory.svelte";
    import { walletStore } from "$lib/services/wallet/walletStore";
    import Panel from "$lib/components/common/Panel.svelte";
    import { onMount } from "svelte";
  
    export let initialFromToken: FE.Token | null = null;
    export let initialToToken: FE.Token | null = null;

    let fromToken = initialFromToken;
    let toToken = initialToToken;
    let fromAmount = "";
    let toAmount = "";
    let slippage = 0.5;
    let transactions: any[] = [];
    let container: HTMLElement;
    let chart: any;

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
    <div class="mode-toggle">
        <button class="mode-button active">Pro Mode</button>
    </div>
    
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
                <Swap initialFromToken={fromToken} initialToToken={toToken} />
            </div>
        </div>

        <!-- Transaction History Section -->
        <Panel
            variant="blue"
            type="main"
            className="transaction-history"
            width="100%"
            height="33%"
        >
            <div class="history-container">
                <h2 class="history-title">Transaction History</h2>
                <TransactionHistory />
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
  
    .mode-toggle {
        display: flex;
        justify-content: center;
        padding: 1rem;
    }
  
    .mode-button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        background: var(--color-primary);
        color: var(--color-text-inverse);
        cursor: pointer;
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

    .chart-area {
        flex: 1;
        min-width: 0;
        position: relative;
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
        gap: 1rem;
        width: 400px;
        flex-shrink: 0;
    }

    .history-container {
        padding: 1rem;
        height: 100%;
        overflow-y: auto;
    }

    .history-title {
        margin-bottom: 1rem;
        font-size: 1.2rem;
        font-weight: bold;
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
