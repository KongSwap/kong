<script lang="ts">
  import Chart from 'chart.js/auto';
  import type { ChartConfiguration } from 'chart.js';
  import {
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    TimeSeriesScale,
  } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { onMount, onDestroy } from 'svelte';

  // Register Chart.js components
  Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    TimeSeriesScale
  );

  export let history: any;

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    if (history) {
      createPerformanceChart();
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  $: if (history && chartCanvas) {
    createPerformanceChart();
  }

  function createPerformanceChart() {
    if (!chartCanvas || !history) return;

    if (chart) {
      chart.destroy();
    }

    const allBets = [...history.active_bets, ...(history.resolved_bets || [])].sort(
      (a, b) => Number(a.market.created_at - b.market.created_at)
    );

    let runningWagered = 0;
    let runningWon = 0;

    const chartData = allBets.map(bet => {
      runningWagered += Number(bet.bet_amount);
      
      if (bet.market.status && "Closed" in bet.market.status) {
        if (bet.winnings && bet.winnings.length > 0) {
          runningWon += Number(bet.winnings[0]);
        }
      }

      return {
        x: Number(bet.market.created_at) / 1_000_000,
        wagered: Number(formatBalance(runningWagered, 8, 2)),
        won: Number(formatBalance(runningWon, 8, 2))
      };
    });

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Total Wagered',
            data: chartData.map(d => ({ x: d.x, y: d.wagered })),
            borderColor: '#6366f1',
            backgroundColor: '#6366f120',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 2,
          },
          {
            label: 'Total Won',
            data: chartData.map(d => ({ x: d.x, y: d.won })),
            borderColor: '#22c55e',
            backgroundColor: '#22c55e20',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#22c55e',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM d'
              }
            },
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#1e293b40' },
            position: 'right',
            ticks: {
              color: '#94a3b8',
              callback: (value) => value + ' KONG'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#94a3b8',
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#e2e8f0',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              title: (items) => {
                return new Date(items[0].parsed.x).toLocaleDateString();
              },
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${value.toLocaleString()} KONG`;
              }
            }
          }
        }
      }
    };

    // @ts-ignore
    chart = new Chart(chartCanvas, config);
  }
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div> 