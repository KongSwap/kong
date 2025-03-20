<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip
  } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import { formatDate } from '$lib/utils/dateFormatters';
  import { enUS } from 'date-fns/locale';
  import { fetchChartData, type CandleData } from '$lib/api/transactions';

  // Register required components
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip
  );

  export let baseToken: FE.Token;
  export let quoteToken: FE.Token;
  export let price_change_24h: number | null = null;
  
  // Set up event dispatcher for token info
  const dispatch = createEventDispatcher();

  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let currentPrice: string | null = null;
  let priceChange: number | null = null;
  let isLoading = true;
  let data: { x: Date; y: number }[] = [];

  function getChartColor(priceChange: number | null) {
    if (priceChange === null) return '#3b82f6'; // default blue
    return priceChange >= 0 ? '#22c55e' : '#ef4444'; // green : red
  }

  function formatPrice(price: number): string {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  }

  function formatPercentage(current: number, start: number): string {
    const change = ((current - start) / start) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  async function initChart() {
    if (!canvas || !baseToken?.token_id || !quoteToken?.token_id) {
      return;
    }
    isLoading = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fetch last 24h of data
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 24 * 60 * 60;

    try {
      // Determine token IDs for the API call
      let baseId = baseToken.token_id || 1;
      let quoteId = quoteToken.token_id || 1;
      
      // Special case for ICP token
      if (baseToken.symbol === "ICP") {
        baseId = baseToken.token_id || 1;
        // Let quote token know we're using it
        dispatch('quoteTokenUsed', quoteToken);
      }

      const candleData = await fetchChartData(
        quoteId,
        baseId,
        startTime,
        now,
        "15"
      ) as CandleData[];

      if (candleData.length === 0) {
        const noDataElement = document.createElement('div');
        noDataElement.className = 'no-data-message';
        noDataElement.textContent = 'No chart data available';
        canvas.parentNode?.appendChild(noDataElement);
        isLoading = false;
        return;
      }

      // Sort candleData in chronological order (oldest to newest)
      const sortedCandleData = [...candleData].sort((a, b) => a.candle_start - b.candle_start);
      
      const firstPrice = parseFloat(sortedCandleData[0].close_price as string);
      const lastPrice = parseFloat(sortedCandleData[sortedCandleData.length - 1].close_price as string);
      currentPrice = lastPrice.toString();
      priceChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;
      
      // Use the raw price data without inversion
      data = sortedCandleData.map(candle => ({
        x: new Date(candle.candle_start),
        y: parseFloat(candle.close_price as string)
      }));

      const chartColor = getChartColor(price_change_24h);
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `${chartColor}33`); // 20% opacity
      gradient.addColorStop(1, `${chartColor}00`); // 0% opacity

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            data: data.map(d => ({ x: d.x.getTime(), y: d.y })),
            borderColor: chartColor,
            borderWidth: 1.5,
            tension: 0.4,
            pointRadius: 0,
            fill: true,
            backgroundColor: gradient
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              position: 'nearest',
              backgroundColor: '#1a1b1e',
              borderColor: '#2d2e33',
              borderWidth: 1,
              padding: 8,
              titleColor: '#9ca3af',
              bodyColor: '#ffffff',
              displayColors: false,
              callbacks: {
                title: (tooltipItems) => {
                  const date = new Date(tooltipItems[0].parsed.x);
                  return formatDate(date);
                },
                label: (context) => {
                  const price = context.parsed.y;
                  const firstPrice = data[0].y;
                  const percentChange = formatPercentage(price, firstPrice);
                  return [
                    formatPrice(price),
                    percentChange
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              display: false,
              time: {
                unit: 'hour'
              },
              adapters: {
                date: {
                  locale: enUS
                }
              }
            },
            y: {
              display: false,
              grace: '10%'
            }
          },
          interaction: {
            mode: 'index',
            intersect: false
          },
          hover: {
            mode: 'index',
            intersect: false
          }
        },
        plugins: [{
          id: 'verticalCursor',
          beforeDraw: (chart) => {
            if (chart.tooltip?.active) {
              const ctx = chart.ctx;
              const x = chart.tooltip.caretX;
              const topY = chart.scales.y.top;
              const bottomY = chart.scales.y.bottom;

              ctx.save();
              ctx.beginPath();
              ctx.setLineDash([4, 4]);
              ctx.moveTo(x, topY);
              ctx.lineTo(x, bottomY);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.stroke();
              ctx.restore();
            }
          }
        }]
      });
    } catch (error) {
      console.error('Chart initialization failed:', error);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    initChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
    // Clean up any no-data-message elements
    const noDataElement = canvas?.parentNode?.querySelector('.no-data-message');
    if (noDataElement) {
      noDataElement.remove();
    }
  });
</script>

<div class="chart-container pb-4 mb-1">
  {#if isLoading}
    <div class="loading-overlay">
      <svg class="spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
      </svg>
    </div>
  {/if}
  <canvas bind:this={canvas}></canvas>
</div>

<style lang="postcss" scoped>
  .chart-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: theme(colors.kong.bg-dark);
    z-index: 10;
  }

  .spinner {
    width: 24px;
    height: 24px;
    animation: rotate 2s linear infinite;
  }

  .path {
    stroke: theme(colors.kong.accent-blue);
    stroke-linecap: round;
    animation: dash 1.5s ease-in-out infinite;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }

  .no-data-message {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: theme(colors.kong.text-secondary);
    background: theme(colors.kong.bg-dark);
    z-index: 5;
  }
</style> 