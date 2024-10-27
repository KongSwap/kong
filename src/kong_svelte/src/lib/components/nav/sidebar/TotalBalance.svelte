<script lang="ts">
    import { spring } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';

    export let tokens: Array<{ symbol: string; amount: string; usdValue?: number }>;
    export let preferredCurrency: 'USD' | 'EUR' = 'USD';

    const currencySymbols = {
        USD: '$',
        EUR: '€'
    };

    const animatedValue = spring(0, {
        stiffness: 0.1,
        damping: 0.6
    });

    function formatNumber(num: number): string {
        if (num >= 1000000) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                notation: 'compact',
                compactDisplay: 'short'
            }).format(num);
        }
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    $: totalValue = tokens.reduce((acc, token) => {
        return acc + (parseFloat(token.amount.replace(/,/g, '')) * (token.usdValue || 0));
    }, 0);

    $: {
        animatedValue.set(totalValue);
    }

    $: displayValue = `${currencySymbols[preferredCurrency]}${formatNumber($animatedValue)}`;

    let sparklinePoints = '';
    let sparklineData: number[] = [];
    let sparklineInterval: number;

    function generateSparklineData() {
        return Array.from({ length: 24 }, (_, i) => {
            return totalValue * (1 + Math.sin(i / 3) * 0.03);
        });
    }

    function updateSparkline() {
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
    }

    onMount(() => {
        if (browser) {
            sparklineData = generateSparklineData();
            updateSparkline();
            
            sparklineInterval = window.setInterval(() => {
                sparklineData = sparklineData.slice(1);
                sparklineData.push(totalValue * (1 + (Math.random() - 0.5) * 0.06));
                updateSparkline();
            }, 5000);
        }
    });

    onDestroy(() => {
        if (browser && sparklineInterval) {
            clearInterval(sparklineInterval);
        }
    });
</script>

<div class="balance-container pixel-corners">
    <div class="pixel-border-left"></div>
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
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%),
                    linear-gradient(to bottom, var(--sidebar-bg), var(--sidebar-bg));
        border: 2px solid var(--sidebar-border);
        box-shadow: -4px 4px 16px var(--shadow-color),
                    inset -1px -1px 0px var(--sidebar-border-dark),
                    inset 1px 1px 0px var(--shine-color);
        padding: 16px;
        margin: 16px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        position: relative;
        overflow: hidden;
        min-height: 80px;
    }

    .pixel-border-left {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--border-width);
        height: 100%;
        background: linear-gradient(to bottom,
            var(--sidebar-border) 0%,
            var(--sidebar-border-dark) 100%);
        clip-path: polygon(
            0 8px,
            100% 12px,
            100% calc(100% - 12px),
            0 calc(100% - 8px),
            0 calc(100% - 12px),
            50% calc(100% - 16px),
            50% 16px,
            0 12px
        );
        box-shadow: inset -1px 0 0 var(--sidebar-border-dark);
    }

    .value-section {
        flex: 1;
        padding-left: calc(var(--border-width) + 8px);
    }

    .label {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.7em;
        color: var(--sidebar-border-dark);
        margin-bottom: 8px;
        text-transform: uppercase;
        text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.2);
    }

    .value {
        font-family: 'Press Start 2P', monospace;
        font-size: 1.1em;
        color: var(--sidebar-border-dark);
        text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .value.positive {
        color: var(--sidebar-border-dark);
    }

    .chart-section {
        width: 120px;
        height: 40px;
        margin-right: 8px;
    }

    .sparkline {
        width: 100%;
        height: 100%;
    }

    .sparkline-line {
        fill: none;
        stroke: var(--sidebar-border-dark);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
    }

    .sparkline-fill {
        fill: var(--sidebar-border-dark);
        opacity: 0.1;
        stroke: none;
    }

    @media (max-width: 768px) {
        .balance-container {
            flex-direction: row;
            align-items: center;
            margin: 16px 8px;
            padding: 16px 8px;
        }

        .chart-section {
            width: 100px;
            height: 30px;
        }

        .value {
            font-size: 0.9em;
        }
    }
</style>
