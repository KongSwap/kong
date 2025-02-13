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
    
    // Process bet data by outcome
    const betsByOutcome = market.outcomes.map((_, index) => {
      return marketBets
        .filter(bet => Number(bet.outcome_index) === index)
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    });

    // Calculate cumulative amounts with continuous lines
    const datasets = market.outcomes.map((outcome, index) => {
      let cumulative = 0;
      const data = [];

      // Add initial zero point
      if (allTimestamps.length > 0) {
        data.push({
          x: allTimestamps[0] / 1_000_000 - 1000, // 1 second before first bet
          y: 0,
          betAmount: 0,
          cumulative: 0
        });
      }

      // Process each timestamp
      allTimestamps.forEach(timestamp => {
        // Find any bets for this outcome at this timestamp
        const betsAtTime = betsByOutcome[index].filter(bet => Number(bet.timestamp) === timestamp);
        
        // Calculate bet amount for this timestamp
        const timestampTotal = betsAtTime.length > 0 
          ? betsAtTime.reduce((sum, bet) => sum + Number(bet.amount), 0)
          : 0;
        
        // Add to cumulative
        cumulative += timestampTotal;

        // Get the previous point's cumulative value (or 0 if no previous point)
        const prevPoint = data[data.length - 1];
        const prevCumulative = prevPoint ? prevPoint.cumulative : 0;
        
        // If there are no bets at this timestamp, use the previous cumulative amount
        const currentCumulative = timestampTotal === 0 ? prevCumulative : cumulative;
        
        // Always add a point with the current cumulative amount
        data.push({
          x: timestamp / 1_000_000,
          y: Number(formatBalance(currentCumulative, 8)),
          betAmount: timestampTotal,
          cumulative: currentCumulative
        });

        // Update the running cumulative to match what we just used
        cumulative = currentCumulative;
      });

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
              unit: 'hour' as const,
              displayFormats: {
                hour: 'MMM d, HH:mm'
              }
            },
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8'
            }
          },
          y: {
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
            position: 'top' as const,
            labels: {
              color: '#94a3b8',
              usePointStyle: true,
              pointStyle: 'circle' as const,
              padding: 20
            }
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
