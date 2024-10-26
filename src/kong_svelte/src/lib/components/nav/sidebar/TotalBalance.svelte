<script lang="ts">
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import { onMount } from 'svelte';

    export let tokens: Array<{ symbol: string; amount: string; usdValue?: number }>;
    export let preferredCurrency: 'USD' | 'EUR' = 'USD';

    const currencySymbols = {
        USD: '$',
        EUR: '€'
    };

    // Animated total value
    const animatedValue = tweened(0, {
        duration: 2000,
        easing: cubicOut
    });

    // Format number with commas and decimal places
    function formatNumber(num: number): string {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    // Calculate total value from tokens
    $: totalValue = tokens.reduce((acc, token) => {
        return acc + (parseFloat(token.amount) * (token.usdValue || 0));
    }, 0);

    // Update animated value when total changes
    $: {
        animatedValue.set(totalValue);
    }

    // Format the final display value
    $: displayValue = `${currencySymbols[preferredCurrency]}${formatNumber($animatedValue)}`;

    // Sparkline data for mini chart (last 24h)
    let sparklinePoints = '';
    let sparklineData = [/* This would come from your data source */];
    
    // Generate sample data for demo
    onMount(() => {
        // Sample data - replace with real historical data
        sparklineData = Array.from({ length: 24 }, (_, i) => {
            return totalValue * (1 + Math.sin(i / 3) * 0.03);
        });

        // Create SVG points
        const width = 100;
        const height = 30;
        const max = Math.max(...sparklineData);
        const min = Math.min(...sparklineData);
        const range = max - min;

        sparklinePoints = sparklineData
            .map((value, index) => {
                const x = (index / (sparklineData.length - 1)) * width;
                const y = height - ((value - min) / range) * height;
                return `${x},${y}`;
            })
            .join(' ');
    });
</script>

<div class="balance-container">
    <div class="value-section">
        <div class="label">Total Balance</div>
        <div class="value" class:positive={totalValue > 0}>
            {displayValue}
        </div>
    </div>
    
    <div class="chart-section">
        <svg 
            viewBox="0 0 100 30" 
            preserveAspectRatio="none"
            class="sparkline"
        >
            <path
                d={`M 0,30 L ${sparklinePoints} L 100,30`}
                class="sparkline-fill"
            />
            <polyline
                points={sparklinePoints}
                class="sparkline-line"
            />
        </svg>
    </div>
</div>

<style>
    .balance-container {
        background: rgba(0, 0, 0, 0.3);
        border: 2px solid var(--border-gradient-start);
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        position: relative;
        overflow: hidden;
    }

    .balance-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
            45deg,
            rgba(255, 204, 0, 0.1),
            transparent 40%
        );
        pointer-events: none;
    }

    .value-section {
        flex: 1;
    }

    .label {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.8em;
        color: #666;
        margin-bottom: 4px;
        text-transform: uppercase;
    }

    .value {
        font-family: 'Press Start 2P', monospace;
        font-size: 1.5em;
        color: var(--border-gradient-start);
        text-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
    }

    .value.positive {
        color: #00ff00;
        text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
    }

    .chart-section {
        width: 100px;
        height: 30px;
    }

    .sparkline {
        width: 100%;
        height: 100%;
    }

    .sparkline-line {
        fill: none;
        stroke: var(--border-gradient-start);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
    }

    .sparkline-fill {
        fill: rgba(255, 204, 0, 0.1);
        stroke: none;
    }

    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }

    @media (max-width: 768px) {
        .balance-container {
            flex-direction: column;
            align-items: stretch;
        }

        .chart-section {
            width: 100%;
        }
    }
</style>
