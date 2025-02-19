<script lang="ts">
  import Chart from 'chart.js/auto';
  import { onMount } from 'svelte';
  import 'chartjs-adapter-date-fns';
  import type { ChartConfiguration, ChartData, ScatterDataPoint } from 'chart.js';

  export let market: any;
  export let marketBets: any[] = [];

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function createChanceChart() {
    if (!chartCanvas || !market || marketBets.length === 0) {
      console.log('Missing required market or betting data for ChanceLineChart');
      return;
    }

    const outcomes: string[] = market.outcomes || [];
    const numOutcomes = outcomes.length;

    // Prepare datasets array, one for each outcome
    const datasets = outcomes.map((outcome: string, index: number) => ({
      label: outcome,
      data: [{
        x: new Date(marketBets[0].timestamp), // Start at the time of the first bet
        y: 50 // Start at 50%
      }] as { x: Date, y: number }[],
      borderColor: index === 0 ? '#22c55e' : '#6366f1',
      backgroundColor: index === 0 ? '#22c55e20' : '#6366f120',
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      showLine: true
    }));

    // New cumulative calculation using grouping by 1-minute intervals
    const intervalMs = 60 * 1000; // 1 minute intervals
    const sortedBets = [...marketBets].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    const minTimeMs = Math.floor(Number(sortedBets[0].timestamp) / 1e6);
    const maxTimeMs = Math.ceil(Number(sortedBets[sortedBets.length - 1].timestamp) / 1e6);
    const startTime = Math.floor(minTimeMs / intervalMs) * intervalMs;
    const endTime = Math.ceil(maxTimeMs / intervalMs) * intervalMs;

    // Create buckets for each 1-minute interval
    const buckets = new Map<number, number[]>();
    for (let t = startTime; t <= endTime; t += intervalMs) {
      buckets.set(t, new Array(numOutcomes).fill(0));
    }

    // Sum bet amounts into their respective minute buckets
    for (const bet of sortedBets) {
      const betTimeMs = Number(bet.timestamp) / 1e6;
      const bucketTime = Math.floor(betTimeMs / intervalMs) * intervalMs;
      const arr = buckets.get(bucketTime);
      if (arr) {
        arr[Number(bet.outcome_index)] += Number(bet.amount);
      }
    }

    // Initialize cumulative amounts
    const runningAmounts = new Array(numOutcomes).fill(0);
    // Initialize each dataset with an initial value of 50% at the start time
    const initDate = new Date(startTime);
    for (let i = 0; i < numOutcomes; i++) {
      datasets[i].data.push({ x: initDate, y: 50 });
    }

    // Process each bucket in chronological order
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    for (const [bucketTime, sums] of sortedBuckets) {
      for (let i = 0; i < numOutcomes; i++) {
        runningAmounts[i] += sums[i];
      }
      const totalAmount = runningAmounts.reduce((a, b) => a + b, 0);
      const bucketDate = new Date(bucketTime);
      for (let i = 0; i < numOutcomes; i++) {
        const percentage = totalAmount === 0 ? 50 : (runningAmounts[i] / totalAmount) * 100;
        datasets[i].data.push({ x: bucketDate, y: percentage });
      }
    }

    // Add a final data point at the current time if needed
    const now = new Date();
    if (datasets[0].data[datasets[0].data.length - 1].x.getTime() < now.getTime()) {
      for (let i = 0; i < numOutcomes; i++) {
        const lastPoint = datasets[i].data[datasets[i].data.length - 1];
        datasets[i].data.push({ x: now, y: lastPoint.y });
      }
    }

    if (chart) {
      chart.destroy();
    }

    // Define chart configuration with explicit type
    const config: ChartConfiguration<'line', ScatterDataPoint[]> = {
      type: 'line',
      data: {
        datasets: datasets.map(ds => ({
          ...ds,
          data: ds.data.map(point => ({
            x: point.x.getTime(),
            y: point.y
          }))
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute',
              displayFormats: {
                minute: 'MMM d, HH:mm'
              }
            },
            grid: { display: false },
            display: false
          },
          y: {
            type: 'linear',
            min: 0,
            max: 100,
            position: 'right',
            ticks: {
              callback: (val) => val + '%'
            }
          }
        },
        plugins: {
          tooltip: {
            mode: 'index',
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
