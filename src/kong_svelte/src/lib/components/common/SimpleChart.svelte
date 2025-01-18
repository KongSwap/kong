<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  import { enUS } from 'date-fns/locale';
  import { fetchChartData, type CandleData } from '$lib/services/indexer/api';

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

  function formatDate(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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
      console.log('Missing required tokens:', { baseToken, quoteToken });
      return;
    }
    isLoading = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fetch last 24h of data
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 24 * 60 * 60;

    try {
      console.log('Fetching chart data for:', {
        base: baseToken.symbol,
        quote: quoteToken.symbol,
        baseId: baseToken.token_id,
        quoteId: quoteToken.token_id
      });

      // Handle different pair cases
      let baseId, quoteId;
      
      if (baseToken.symbol === "ckUSDC" || quoteToken.symbol === "ckUSDC") {
        // ckUSDC/ckUSDT pair - ensure ckUSDC is always base
        baseId = baseToken.symbol === "ckUSDC" ? baseToken.token_id : quoteToken.token_id;
        quoteId = baseToken.symbol === "ckUSDT" ? baseToken.token_id : quoteToken.token_id;
      } else if (baseToken.symbol === "ICP") {
        // ICP/ckUSDT pair
        baseId = 1; // ICP's fixed token_id
        quoteId = quoteToken.token_id;
      } else if (quoteToken.symbol === "ICP") {
        // TOKEN/ICP pair
        baseId = baseToken.token_id;
        quoteId = 1; // ICP's fixed token_id
      } else {
        baseId = baseToken.token_id;
        quoteId = quoteToken.token_id;
      }

      // Ensure we have valid IDs before fetching
      if (!baseId || !quoteId) {
        console.error('Invalid token IDs:', { baseId, quoteId, baseToken, quoteToken });
        isLoading = false;
        return;
      }

      const candleData = await fetchChartData(
        baseId,
        quoteId,
        startTime,
        now,
        "15"
      ) as CandleData[];

      console.log('Received candle data:', {
        length: candleData.length,
        first: candleData[0],
        last: candleData[candleData.length - 1]
      });

      if (candleData.length === 0) {
        console.log('No candle data received');
        isLoading = false;
        return;
      }

      const firstPrice = parseFloat(candleData[0].close_price as string);
      data = candleData.map(candle => ({
        x: new Date(candle.candle_start * 1000),
        y: parseFloat(candle.close_price as string)
      }));

      console.log('Processed data:', {
        length: data.length,
        first: data[0],
        last: data[data.length - 1]
      });

      const chartColor = getChartColor(priceChange);
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `${chartColor}33`); // 20% opacity
      gradient.addColorStop(1, `${chartColor}00`); // 0% opacity

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            data,
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
      isLoading = false;
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

<style scoped>
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
</style> 