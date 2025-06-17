<script lang="ts">
  import Chart from 'chart.js/auto';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import 'chartjs-adapter-date-fns';
  import type { ChartConfiguration } from 'chart.js';

  // Create event dispatcher for error events
  const dispatch = createEventDispatcher<{ error: string }>();

  export let market: any;
  export let marketBets: any[] = [];

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let chartInitialized = false;

  // Safely convert BigInt to Number, handling potential precision loss
  function safeConvertBigInt(value: any): number {
    // Handle undefined or null
    if (value === undefined || value === null) return 0;
    
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
    if (timestamp === undefined || timestamp === null) return 0;
    
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
    if (!chartCanvas || !market || !marketBets || marketBets.length === 0 || chartInitialized) {
      return;
    }

    try {
      // Create local copy to avoid reactivity issues
      const betsToProcess = [...marketBets];
      
      const outcomes: string[] = market.outcomes || [];
      const numOutcomes = outcomes.length;
      
      if (numOutcomes === 0) {
        console.error("No outcomes found in market data");
        return;
      }

      // Normalize all timestamps first
      const normalizedBets = betsToProcess.map(bet => ({
        ...bet,
        normalizedTime: normalizeTimestamp(bet.timestamp)
      }));

      // Sort bets by timestamp
      const sortedBets = [...normalizedBets].sort((a, b) => a.normalizedTime - b.normalizedTime);
      
      if (sortedBets.length === 0) {
        return;
      }
      
      // Get time range
      const minTimeMs = sortedBets[0].normalizedTime;
      const maxTimeMs = sortedBets[sortedBets.length - 1].normalizedTime;
      
      // Convert market end time
      const marketEndTimeMs = normalizeTimestamp(market.end_time);
      
      // Choose appropriate time unit based on data range
      const timeUnit = determineTimeUnit(minTimeMs, Math.max(maxTimeMs, marketEndTimeMs));
      
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
        marketEndTimeMs || Infinity // Don't go beyond market end time if available
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
        if (!bet || bet.normalizedTime === undefined || bet.normalizedTime === null) continue;
        
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
      if (marketEndTimeMs && cappedEndTime < marketEndTimeMs && cappedEndTime < endTime) {
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
        chart = null;
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
      chartInitialized = true;
    } catch (error) {
      console.error('Failed to create chance chart:', error);
      // Dispatch error event to parent
      dispatch('error', error instanceof Error ? error.message : 'Failed to create chart');
    }
  }

  onMount(() => {
    // Add window resize handler with proper debouncing
    let resizeTimeout: ReturnType<typeof setTimeout>;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (chart) {
          try {
            chart.destroy();
            chart = null;
            chartInitialized = false;
            createChanceChart();
          } catch (error) {
            console.error('Error during chart resize:', error);
            dispatch('error', 'Failed to update chart on resize');
          }
        }
      }, 250); // 250ms debounce
    };
    
    window.addEventListener('resize', handleResize);

    // Create chart with a slight delay to ensure DOM is ready
    setTimeout(() => {
      try {
        createChanceChart();
      } catch (error) {
        console.error('Error during initial chart creation:', error);
        dispatch('error', 'Failed to create chart');
      }
    }, 100);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      if (chart) {
        chart.destroy();
        chart = null;
      }
    };
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  });
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div>
