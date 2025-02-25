<script lang="ts">
  import Chart from 'chart.js/auto';
  import {
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    TimeSeriesScale
  } from 'chart.js';
  import { onMount, onDestroy } from 'svelte';
  import { formatBalance } from "$lib/utils/numberFormatUtils";

  // Register required Chart.js components
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

  export let market: any;
  export let marketBets: any[];

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function createBetHistoryChart() {
    if (!chartCanvas || !market || !marketBets.length) {
      console.log('Skipping chart creation - missing required data');
      return;
    }

    // Destroy existing chart if it exists
    if (chart) {
      console.log('Destroying existing chart');
      chart.destroy();
    }

    // Get all unique timestamps and sort them
    const allTimestamps = [...new Set(marketBets.map(bet => Number(bet.timestamp)))].sort((a, b) => a - b);
    
    // Group timestamps into 15-minute intervals
    const intervalMs = 15 * 60 * 1000; // 15 minutes in milliseconds
    const groupedData: Map<number, { amounts: number[], timestamp: number }> = new Map();

    // Get start and end times
    const startTime = Math.floor((allTimestamps[0] / 1e6) / intervalMs) * intervalMs;
    const marketEndTimeMs = Number(market.end_time) / 1e6;
    const endTime = Math.min(
      Math.ceil((allTimestamps[allTimestamps.length - 1] / 1e6) / intervalMs) * intervalMs,
      Math.ceil(marketEndTimeMs / intervalMs) * intervalMs
    );

    // Create all intervals between start and end
    for (let intervalStart = startTime; intervalStart <= endTime; intervalStart += intervalMs) {
      groupedData.set(intervalStart, { 
        amounts: new Array(market.outcomes.length).fill(0), 
        timestamp: intervalStart * 1e6 
      });
    }

    // Group bets into their respective intervals
    for (const timestamp of allTimestamps) {
      const timeMs = timestamp / 1e6;
      const intervalStart = Math.floor(timeMs / intervalMs) * intervalMs;
      const interval = groupedData.get(intervalStart)!;
      
      // Sum bet amounts for each outcome in this interval
      marketBets
        .filter(bet => Number(bet.timestamp) === timestamp)
        .forEach(bet => {
          interval.amounts[Number(bet.outcome_index)] += Number(bet.amount);
        });
    }

    // Sort intervals by timestamp
    const sortedIntervals = Array.from(groupedData.entries()).sort(([a], [b]) => a - b);

    // Process bet data by outcome with cumulative amounts
    const datasets = market.outcomes.map((outcome, index) => {
      let cumulative = 0;
      const data = [];

      // Add initial zero point
      data.push({
        x: new Date(startTime),
        y: 0,
        betAmount: 0,
        cumulative: 0
      });

      // Process each interval
      for (const [intervalStart, { amounts }] of sortedIntervals) {
        // Add to cumulative
        cumulative += amounts[index];

        // Always add a point with the current cumulative amount
        data.push({
          x: new Date(intervalStart),
          y: Number(formatBalance(cumulative, 8)),
          betAmount: amounts[index],
          cumulative: cumulative
        });
      }

      // Add final point at market end time with latest cumulative amount
      const lastPoint = data[data.length - 1];
      if (lastPoint && lastPoint.x.getTime() < marketEndTimeMs) {
        data.push({
          x: new Date(marketEndTimeMs),
          y: lastPoint.y,
          betAmount: 0,
          cumulative: lastPoint.cumulative
        });
      }

      return {
        label: outcome,
        data: data,
        borderColor: index === 0 ? '#22c55e' : '#6366f1',
        backgroundColor: index === 0 ? '#22c55e20' : '#6366f120',
        fill: true,
        tension: 0.4,
        pointRadius: (ctx) => {
          const point = ctx.raw as any;
          return point.betAmount > 0 ? 4 : 0;
        },
        pointHoverRadius: 6,
        pointBackgroundColor: index === 0 ? '#22c55e' : '#6366f1',
        pointBorderColor: '#1e293b',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: index === 0 ? '#22c55e' : '#6366f1',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
        hoverBorderWidth: 3,
        cubicInterpolationMode: 'monotone',
      };
    });

    console.log('Final datasets:', datasets);

    const config = {
      type: 'line' as const,
      data: {
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        defaults: {
          font: {
            family: '"Exo 2", sans-serif'
          }
        },
        animation: {
          duration: 750,
          easing: 'easeInOutQuart' as const
        },
        hover: {
          mode: 'index' as const,
          intersect: false
        },
        interaction: {
          mode: 'index' as const,
          intersect: false
        },
        scales: {
          x: {
            type: 'time' as const,
            time: {
              unit: 'minute' as const,
              stepSize: 15,
              displayFormats: {
                minute: 'MMM d, HH:mm'
              }
            },
            grid: { display: false },
            display: false
          },
          y: {
            type: 'linear' as const,
            position: 'right' as const,
            beginAtZero: true,
            title: {
              display: false
            },
            grid: {
              color: '#1e293b40'
            },
            ticks: {
              color: '#94a3b8',
              callback: function(value) {
                return value.toLocaleString() + ' KONG';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            mode: 'index' as const,
            intersect: false,
            position: 'nearest' as const,
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#e2e8f0',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            itemSort: (a, b) => b.raw.y - a.raw.y,
            callbacks: {
              title: (items) => {
                const date = new Date(items[0].parsed.x);
                return date.toLocaleString();
              },
              label: (item) => {
                const dataset = item.dataset.data[item.dataIndex] as any;
                const betAmount = Number(formatBalance(dataset.betAmount || 0, 8));
                const cumulative = Number(formatBalance(dataset.cumulative || dataset.y, 8));
                
                return [
                  `${item.dataset.label}:`,
                  `  • New Bet: ${betAmount.toLocaleString()} KONG`,
                  `  • Total Pool: ${cumulative.toLocaleString()} KONG`
                ];
              }
            }
          }
        }
      }
    };

    try {
      console.log('Creating new chart with config:', config);
      chart = new Chart(chartCanvas, config);
      console.log('Chart created successfully');
    } catch (error) {
      console.error('Failed to create chart:', error);
    }
  }

  // Watch for changes in market or bets
  $: if (market && marketBets) {
    setTimeout(() => {
      createBetHistoryChart();
    }, 0);
  }

  onMount(() => {
    // Add window resize handler
    const handleResize = () => {
      if (chart) {
        createBetHistoryChart();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.destroy();
      }
    };
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div>
