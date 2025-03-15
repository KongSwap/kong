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
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import 'chartjs-adapter-date-fns';

  // Create event dispatcher for error events
  const dispatch = createEventDispatcher<{ error: string }>();

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

  // Format a date to YYYY-MM-DD string (for grouping by day)
  function formatDateToDay(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function createDailyBetChart() {
    if (!chartCanvas || !market || !marketBets || !marketBets.length || chartInitialized) {
      return;
    }

    try {
      // Make a local copy of the bets to avoid reactivity issues
      const betsToProcess = [...marketBets];
      
      // Filter valid bets that have timestamp and amount
      const validBets = betsToProcess.filter(bet => {
        return bet && 
               bet.hasOwnProperty('timestamp') && 
               bet.hasOwnProperty('amount');
      });

      if (validBets.length === 0) {
        console.log("No valid bets found with amounts for chart");
        return;
      }
      
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
      
      if (dailyBetsArray.length === 0) {
        console.log("No daily bet data available after processing");
        return;
      }
      
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

      // Determine the appropriate time unit
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
                unit: timeUnit,
                displayFormats: {
                  hour: "HH:mm",
                  day: "MMM d",
                  month: "MMM yyyy",
                  year: "yyyy"
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
                  // Ensure amount is a number before calling toFixed()
                  let amount: number;
                  if (typeof yValue === 'object' && yValue !== null) {
                    amount = Number(yValue.y);
                  } else {
                    amount = Number(yValue);
                  }
                  
                  if (isNaN(amount)) {
                    return `Amount: 0 KONG`;
                  }
                  
                  return `Amount: ${amount.toFixed(2)} KONG`;
                },
              },
            },
            legend: {
              display: true,
            },
          },
        },
      } as any);
      
      // Mark chart as initialized to prevent duplicate initializations
      chartInitialized = true;
    } catch (error) {
      console.error('Failed to create bet history chart:', error);
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
            // Clean up existing chart before recreating
            chart.destroy();
            chart = null;
            chartInitialized = false;
            // Recreate chart
            createDailyBetChart();
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
        createDailyBetChart();
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

  // Helper function to determine the appropriate time unit based on the data range
  function determineTimeUnit(startTimeMs: number, endTimeMs: number): 'hour' | 'day' | 'month' | 'year' {
    const rangeMs = endTimeMs - startTimeMs;
    const dayMs = 24 * 60 * 60 * 1000;
    
    if (rangeMs < dayMs * 2) return 'hour'; // Less than 2 days: hours
    if (rangeMs < dayMs * 30) return 'day'; // Less than a month: days
    if (rangeMs < dayMs * 180) return 'month'; // Less than 6 months: months
    return 'year'; // More than 6 months: years
  }
</script>

<div class="h-[300px]">
  <canvas bind:this={chartCanvas}></canvas>
</div>
