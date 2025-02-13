<script lang="ts">
  import Chart from 'chart.js/auto';
  import { onMount } from 'svelte';
  import 'chartjs-adapter-date-fns';
  import type { ChartConfiguration, ChartData } from 'chart.js';

  export let market: any;
  export let marketBets: any[] = [];

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function createChanceChart() {
    if (!chartCanvas || !market || marketBets.length === 0) {
      console.log('Missing required market or betting data for ChanceLineChart');
      return;
    }

    // Extract unique timestamps from marketBets, sorted ascending
    const allTimestamps = [...new Set(marketBets.map(bet => Number(bet.timestamp)))].sort((a, b) => a - b);

    const outcomes: string[] = market.outcomes || [];
    const numOutcomes = outcomes.length;

    // Initialize cumulative bet counts for each outcome
    const cumulative: number[] = new Array(numOutcomes).fill(0);

    // Prepare datasets array, one for each outcome
    const datasets = outcomes.map((outcome: string, index: number) => ({
      label: outcome,
      data: [{
        x: new Date(allTimestamps[0] / 1e6 - 1000), // Start 1 second before first bet
        y: 50 // Start at 50%
      }] as { x: Date, y: number }[],
      borderColor: index === 0 ? '#22c55e' : '#6366f1',
      backgroundColor: index === 0 ? '#22c55e20' : '#6366f120',
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      showLine: true
    }));

    // Group timestamps into 15-minute intervals
    const intervalMs = 15 * 60 * 1000; // 15 minutes in milliseconds
    const groupedData: Map<number, { counts: number[], timestamp: number }> = new Map();

    // Get start and end times
    const startTime = Math.floor((allTimestamps[0] / 1e6) / intervalMs) * intervalMs;
    const endTime = Math.ceil((allTimestamps[allTimestamps.length - 1] / 1e6) / intervalMs) * intervalMs;

    // Create all intervals between start and end
    for (let intervalStart = startTime; intervalStart <= endTime; intervalStart += intervalMs) {
      groupedData.set(intervalStart, { 
        counts: new Array(numOutcomes).fill(0), 
        timestamp: intervalStart * 1e6 
      });
    }

    // Group bets into their respective intervals
    for (const timestamp of allTimestamps) {
      const timeMs = timestamp / 1e6;
      const intervalStart = Math.floor(timeMs / intervalMs) * intervalMs;
      const interval = groupedData.get(intervalStart)!;
      
      // Count bets for each outcome in this interval
      for (let i = 0; i < numOutcomes; i++) {
        const count = marketBets.filter(bet => 
          Number(bet.outcome_index) === i && 
          Number(bet.timestamp) === timestamp
        ).length;
        interval.counts[i] += count;
      }
    }

    // Sort intervals by timestamp
    const sortedIntervals = Array.from(groupedData.entries()).sort(([a], [b]) => a - b);

    // Calculate cumulative percentages for each interval
    let runningCounts = new Array(numOutcomes).fill(0);

    // Add initial 50-50 point at the start
    datasets.forEach(ds => {
      ds.data = [{
        x: new Date(startTime),
        y: 50
      }];
    });

    // Process each interval
    for (const [intervalStart, { counts }] of sortedIntervals) {
      // Update running counts
      for (let i = 0; i < numOutcomes; i++) {
        runningCounts[i] += counts[i];
      }

      const totalCount = runningCounts.reduce((sum, count) => sum + count, 0);
      
      // Calculate and add percentages for each outcome
      for (let i = 0; i < numOutcomes; i++) {
        const percentage = totalCount === 0 ? 50 : (runningCounts[i] / totalCount) * 100;
        datasets[i].data.push({
          x: new Date(intervalStart),
          y: percentage
        });
      }
    }

    // If we only have one point, add another at the next interval
    datasets.forEach(ds => {
      if (ds.data.length === 1) {
        ds.data.push({ 
          x: new Date(startTime + intervalMs), 
          y: ds.data[0].y 
        });
      }
    });

    if (chart) {
      chart.destroy();
    }

    // Define chart configuration with explicit type
    const config = {
      type: 'line' as const,
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => val + '%'
            }
          }
        },
        plugins: {
          tooltip: {
            mode: 'index' as const,
            intersect: false,
            callbacks: {
              title: (items) => {
                if (items.length === 0) return '';
                const date = new Date(items[0].parsed.x);
                return date.toLocaleString();
              },
              label: (context) => {
                const datasetIndex = context.datasetIndex;
                const percentage = context.parsed.y.toFixed(1);
                const label = context.dataset.label;
                return `${label}: ${percentage}%`;
              }
            }
          },
          legend: { display: true }
        }
      }
    };

    chart = new Chart(chartCanvas, config);
  }

  onMount(() => {
    createChanceChart();
    window.addEventListener('resize', createChanceChart);
    return () => {
      window.removeEventListener('resize', createChanceChart);
      if (chart) chart.destroy();
    };
  });

  $: if (market && marketBets.length > 0) {
    createChanceChart();
  }
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div>
