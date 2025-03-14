<script lang="ts">
  import Chart from 'chart.js/auto';
  import { onMount } from 'svelte';
  import 'chartjs-adapter-date-fns';
  import type { ChartConfiguration, ChartData, ScatterDataPoint } from 'chart.js';

  export let market: any;
  export let marketBets: any[] = [];

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Safely convert BigInt to Number, handling potential precision loss
  function safeConvertBigInt(value: any): number {
    // If it's a BigInt
    if (typeof value === 'bigint') {
      // Convert to string first to avoid precision issues with very large values
      return Number(value.toString());
    }
    // If it's already a number or something else, try to convert it
    return Number(value);
  }

  // Convert nanosecond timestamps to milliseconds if needed
  function normalizeTimestamp(timestamp: any): number {
    const numValue = safeConvertBigInt(timestamp);
    // If timestamp is in nanoseconds (too large for a reasonable date)
    if (numValue > 1e15) {
      return Math.floor(numValue / 1e6);
    }
    return numValue;
  }

  // Determine the appropriate time unit based on data range
  function determineTimeUnit(startTimeMs: number, endTimeMs: number): 'hour' | 'day' | 'month' | 'year' {
    const rangeMs = endTimeMs - startTimeMs;
    const dayMs = 24 * 60 * 60 * 1000;
    
    if (rangeMs < dayMs * 2) return 'hour'; // Less than 2 days: hours
    if (rangeMs < dayMs * 30) return 'day'; // Less than a month: days
    if (rangeMs < dayMs * 180) return 'month'; // Less than 6 months: months
    return 'year'; // More than 6 months: years
  }

  function createChanceChart() {
    if (!chartCanvas || !market || marketBets.length === 0) {
      console.log('Missing required market or betting data for ChanceLineChart');
      return;
    }

    try {
      console.log('Creating chance line chart with', marketBets.length, 'bets');
      
      const outcomes: string[] = market.outcomes || [];
      const numOutcomes = outcomes.length;

      // Normalize all timestamps first
      const normalizedBets = marketBets.map(bet => ({
        ...bet,
        normalizedTime: normalizeTimestamp(bet.timestamp)
      }));

      // Sort bets by timestamp
      const sortedBets = [...normalizedBets].sort((a, b) => a.normalizedTime - b.normalizedTime);
      
      if (sortedBets.length === 0) {
        console.log('No valid bets found for chance chart');
        return;
      }
      
      // Get time range
      const minTimeMs = sortedBets[0].normalizedTime;
      const maxTimeMs = sortedBets[sortedBets.length - 1].normalizedTime;
      
      // Convert market end time
      const marketEndTimeMs = normalizeTimestamp(market.end_time);
      
      console.log(`Time range: ${new Date(minTimeMs).toISOString()} to ${new Date(maxTimeMs).toISOString()}`);
      console.log(`Market end time: ${new Date(marketEndTimeMs).toISOString()}`);
      
      // Choose appropriate time unit based on data range
      const timeUnit = determineTimeUnit(minTimeMs, Math.max(maxTimeMs, marketEndTimeMs));
      console.log(`Using time unit: ${timeUnit}`);
      
      // Use appropriate interval based on time unit
      const aggregationIntervalMs = (() => {
        switch(timeUnit) {
          case 'hour': return 15 * 60 * 1000; // 15 min intervals
          case 'day': return 60 * 60 * 1000; // 1 hour intervals
          case 'month': return 24 * 60 * 60 * 1000; // 1 day intervals
          case 'year': return 7 * 24 * 60 * 60 * 1000; // 1 week intervals
          default: return 60 * 60 * 1000; // Default to 1 hour
        }
      })();
      
      // Prepare datasets array, one for each outcome
      const datasets = outcomes.map((outcome: string, index: number) => {
        // Use distinct colors for different outcomes
        const colors = ['#22c55e', '#6366f1', '#ec4899', '#f97316', '#8b5cf6', '#14b8a6'];
        const color = index < colors.length ? colors[index] : `hsl(${index * 137.5 % 360}, 70%, 60%)`;
        
        return {
          label: outcome,
          data: [] as { x: number, y: number }[],
          borderColor: color,
          backgroundColor: color + '20', // Add transparency
          fill: false,
          tension: 0.2,
          pointRadius: 3,
          showLine: true
        };
      });

      // Find start and end times rounded to intervals
      const startTime = Math.floor(minTimeMs / aggregationIntervalMs) * aggregationIntervalMs;
      const endTime = Math.min(
        Math.ceil(maxTimeMs / aggregationIntervalMs) * aggregationIntervalMs,
        marketEndTimeMs // Don't go beyond market end time
      );
      
      // Cap the time range to avoid "too far apart" errors
      const maxRangeMs = 180 * 24 * 60 * 60 * 1000; // 180 days max
      const cappedEndTime = Math.min(endTime, startTime + maxRangeMs);
      
      // Create interval buckets for bet aggregation
      const buckets = new Map<number, number[]>();
      for (let t = startTime; t <= cappedEndTime; t += aggregationIntervalMs) {
        buckets.set(t, new Array(numOutcomes).fill(0));
      }

      // Sum bet amounts into buckets
      for (const bet of sortedBets) {
        const bucketTime = Math.floor(bet.normalizedTime / aggregationIntervalMs) * aggregationIntervalMs;
        if (buckets.has(bucketTime)) {
          const outcomeIndex = safeConvertBigInt(bet.outcome_index);
          const amount = safeConvertBigInt(bet.amount);
          if (outcomeIndex < numOutcomes) {
            const arr = buckets.get(bucketTime);
            if (arr) {
              arr[outcomeIndex] += amount;
            }
          }
        }
      }

      // Initialize cumulative amounts
      const runningAmounts = new Array(numOutcomes).fill(0);
      
      // Add initial point (equal probability)
      const equalProbability = 100 / numOutcomes;
      for (let i = 0; i < numOutcomes; i++) {
        datasets[i].data.push({ x: startTime, y: equalProbability });
      }

      // Process buckets chronologically
      const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
      for (const [bucketTime, amounts] of sortedBuckets) {
        for (let i = 0; i < numOutcomes; i++) {
          runningAmounts[i] += amounts[i];
        }
        
        const totalAmount = runningAmounts.reduce((a, b) => a + b, 0);
        
        for (let i = 0; i < numOutcomes; i++) {
          // If no bets yet, use equal probability
          const percentage = totalAmount === 0 
            ? equalProbability 
            : (runningAmounts[i] / totalAmount) * 100;
            
          datasets[i].data.push({ x: bucketTime, y: percentage });
        }
      }

      // Add final point at market end time if needed
      if (cappedEndTime < marketEndTimeMs && cappedEndTime < endTime) {
        for (let i = 0; i < numOutcomes; i++) {
          const lastPoints = datasets[i].data;
          if (lastPoints.length > 0) {
            const lastPoint = lastPoints[lastPoints.length - 1];
            datasets[i].data.push({ x: marketEndTimeMs, y: lastPoint.y });
          }
        }
      }

      if (chart) {
        chart.destroy();
      }

      // Define chart configuration with explicit type
      const config: ChartConfiguration = {
        type: 'line',
        data: {
          datasets: datasets as any
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
                unit: timeUnit,
                displayFormats: {
                  hour: 'MMM d, HH:mm',
                  day: 'MMM d',
                  month: 'MMM yyyy',
                  year: 'yyyy'
                }
              },
              grid: { display: false }
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
                  const label = datasets[datasetIndex]?.label || 'Unknown';
                  return `${label}: ${percentage}%`;
                }
              }
            },
            legend: { 
              display: true,
              position: 'top'
            }
          }
        }
      };

      chart = new Chart(chartCanvas, config as any);
    } catch (error) {
      console.error('Failed to create chance chart:', error);
    }
  }

  onMount(() => {
    if (market && marketBets.length > 0) {
      setTimeout(() => {
        createChanceChart();
      }, 100);
    }
    
    window.addEventListener('resize', createChanceChart);
    return () => {
      window.removeEventListener('resize', createChanceChart);
      if (chart) chart.destroy();
    };
  });

  $: if (market && marketBets.length > 0) {
    setTimeout(() => {
      createChanceChart();
    }, 0);
  }
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div>
