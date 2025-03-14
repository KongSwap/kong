<script lang="ts">
  import Chart from 'chart.js/auto';
  import {
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
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
    BarElement,
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

  // Format a date to YYYY-MM-DD string (for grouping by day)
  function formatDateToDay(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function createDailyBetChart() {
    if (!chartCanvas || !market || !marketBets.length) {
      console.log('Skipping chart creation - missing required data');
      return;
    }

    // Destroy existing chart if it exists
    if (chart) {
      console.log('Destroying existing chart');
      chart.destroy();
    }

    try {
      console.log('Creating daily bet amount chart');
      
      // Filter valid bets that have timestamp and amount
      const validBets = marketBets.filter(bet => {
        return bet && bet.timestamp && bet.hasOwnProperty('amount');
      });

      if (validBets.length === 0) {
        console.log("No valid bets found with amounts");
        return;
      }

      console.log(`Processing ${validBets.length} bets for chart`);
      
      // Normalize timestamps and extract amounts
      const processedBets = validBets.map(bet => {
        // Safe conversion from BigInt to Number
        const rawTimestamp = safeConvertBigInt(bet.timestamp);
        const betAmount = safeConvertBigInt(bet.amount);
        
        // Determine if timestamp is in nanoseconds (too large for a reasonable date)
        let normalizedTimestamp = rawTimestamp;
        if (normalizedTimestamp > 1e15) { // If timestamp is too large (likely nanoseconds)
          normalizedTimestamp = Math.floor(normalizedTimestamp / 1e6);
        }
        
        // Create a Date object and get the day string
        const betDate = new Date(normalizedTimestamp);
        const betDay = formatDateToDay(betDate);
        
        return {
          date: betDate,
          day: betDay,
          amount: betAmount
        };
      });
      
      // Group bets by day and sum amounts
      const dailyBets = processedBets.reduce((acc, bet) => {
        if (!acc[bet.day]) {
          acc[bet.day] = {
            day: bet.day,
            date: bet.date,
            totalAmount: 0
          };
        }
        acc[bet.day].totalAmount += bet.amount;
        return acc;
      }, {} as Record<string, { day: string, date: Date, totalAmount: number }>);
      
      // Convert to array and sort by date
      const dailyBetsArray = Object.values(dailyBets).sort((a, b) => 
        a.date.getTime() - b.date.getTime()
      );
      
      console.log('Daily bet amounts:', dailyBetsArray);
      
      // Create data points for the chart
      const dataPoints = dailyBetsArray.map(daily => ({
        x: daily.date,
        y: daily.totalAmount / 100000000 // Convert from token units (assumed 8 decimals)
      }));
      
      const ctx = chartCanvas.getContext("2d");
      if (!ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      // Determine the appropriate time unit (should be 'day' for daily data)
      const startTimeMs = dataPoints[0]?.x.getTime() || Date.now();
      const endTimeMs = dataPoints[dataPoints.length - 1]?.x.getTime() || Date.now();
      const timeUnit = determineTimeUnit(startTimeMs, endTimeMs);
      
      // Create chart with type assertion to satisfy TypeScript
      chart = new Chart(ctx, {
        type: "bar",
        data: {
          datasets: [
            {
              label: "Daily Bet Amount",
              data: dataPoints,
              backgroundColor: "rgba(54, 162, 235, 0.7)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: "time",
              time: {
                unit: 'day',
                displayFormats: {
                  day: "MMM d",
                },
              },
              title: {
                display: true,
                text: "Date",
              },
            },
            y: {
              title: {
                display: true,
                text: "Amount (KONG)",
              },
              ticks: {
                callback: function(value) {
                  return value.toFixed(2) + " KONG";
                },
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const yValue = context.raw as any;
                  const amount = typeof yValue === 'object' && yValue !== null ? 
                    Number(yValue.y) : Number(yValue);
                  return `Amount: ${amount.toFixed(2)} KONG`;
                },
              },
            },
            legend: {
              display: true,
            },
          },
        },
      } as any); // Type assertion to resolve TypeScript errors
    } catch (error) {
      console.error('Failed to create chart:', error);
    }
  }

  // Watch for changes in market or bets
  $: if (market && marketBets && marketBets.length > 0) {
    setTimeout(() => {
      createDailyBetChart();
    }, 0);
  }

  onMount(() => {
    // Add window resize handler
    const handleResize = () => {
      if (chart) {
        createDailyBetChart();
      }
    };
    window.addEventListener('resize', handleResize);

    // Create chart on mount if data is available
    if (market && marketBets && marketBets.length > 0) {
      setTimeout(() => {
        createDailyBetChart();
      }, 100); // Slightly longer delay to ensure DOM is ready
    }

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

  // Helper function to determine the appropriate time unit based on the data range
  function determineTimeUnit(startTimeMs: number, endTimeMs: number): 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' {
    const rangeMs = endTimeMs - startTimeMs;
    
    if (rangeMs < 1000 * 60 * 5) return 'second'; // Less than 5 minutes: seconds
    if (rangeMs < 1000 * 60 * 60 * 2) return 'minute'; // Less than 2 hours: minutes
    if (rangeMs < 1000 * 60 * 60 * 24 * 2) return 'hour'; // Less than 2 days: hours
    if (rangeMs < 1000 * 60 * 60 * 24 * 30) return 'day'; // Less than a month: days
    if (rangeMs < 1000 * 60 * 60 * 24 * 30 * 6) return 'month'; // Less than 6 months: months
    return 'year'; // More than 6 months: years
  }
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div>
