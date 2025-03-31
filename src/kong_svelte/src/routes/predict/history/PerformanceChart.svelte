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

    console.log("Creating personal betting history chart:", history);
    
    // Create a timeline of all bets in chronological order
    const timeline = [];
    
    // First, extract all bets with their timestamps
    [...(history.active_bets || []), ...(history.resolved_bets || [])].forEach(bet => {
      // Get timestamp from the bet
      const timestamp = Number(bet.market.created_at) / 1_000_000;
      
      // Add the bet to the timeline
      timeline.push({
        timestamp,
        type: 'bet_placed',
        amount: Number(bet.bet_amount),
        questionText: bet.market.question,
        outcomeText: bet.outcome_text,
        resolved: bet.market.status && "Closed" in bet.market.status,
        won: bet.market.status && 
             "Closed" in bet.market.status && 
             bet.market.status.Closed.some(outcome => outcome == bet.outcome_index),
        winnings: bet.winnings && bet.winnings.length > 0 ? Number(bet.winnings[0]) : 0
      });
    });
    
    // Sort timeline chronologically
    timeline.sort((a, b) => a.timestamp - b.timestamp);
    
    // If we have no bets, create a simple empty chart
    if (timeline.length === 0) {
      timeline.push({
        timestamp: Date.now() / 1000 - (60 * 60 * 24 * 30),
        type: 'start',
        amount: 0,
        questionText: 'Start',
        outcomeText: '',
        resolved: false,
        won: false,
        winnings: 0
      });
      
      timeline.push({
        timestamp: Date.now() / 1000,
        type: 'current',
        amount: 0,
        questionText: 'Current',
        outcomeText: '',
        resolved: false,
        won: false,
        winnings: 0
      });
    }
    
    // Group data points by day
    const groupedByDay = {};
    
    // First pass: group events by day
    timeline.forEach(event => {
      // Convert timestamp to date string (YYYY-MM-DD format)
      const date = new Date(event.timestamp * 1000);
      const dateString = date.toISOString().split('T')[0];
      
      if (!groupedByDay[dateString]) {
        groupedByDay[dateString] = {
          timestamp: new Date(dateString).getTime() / 1000,
          events: []
        };
      }
      
      groupedByDay[dateString].events.push(event);
    });
    
    // Calculate running totals for each day
    let wageredTotal = 0;
    let wonTotal = 0;
    
    const chartData = Object.keys(groupedByDay).sort().map(dateString => {
      const dayData = groupedByDay[dateString];
      
      // Process all events for this day
      dayData.events.forEach(event => {
        if (event.type === 'bet_placed') {
          wageredTotal += event.amount;
          
          // If this bet is already resolved and won, add winnings
          if (event.resolved && event.won) {
            wonTotal += event.winnings;
          }
        }
      });
      
      // Return a single data point for this day
      return {
        x: dayData.timestamp,
        wagered: wageredTotal,
        won: wonTotal
      };
    });
    
    console.log("Chart data points (grouped by day):", chartData);

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
            tension: 0.2,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
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
            tension: 0.2,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#22c55e',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000
        },
        interaction: {
          mode: 'nearest',
          intersect: false,
          axis: 'x'
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
              callback: (value) => formatBalance(value, 8, 2) + ' KONG'
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
                return `${label}: ${formatBalance(value, 8, 2)} KONG`;
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