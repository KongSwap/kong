import { onMount } from 'svelte';
import type { Chart as ChartJS, ChartOptions, ChartDataset } from 'chart.js/auto';

interface GradientOptions {
  colorStart: string;
  colorEnd: string;
}

export function getGradient(
  ctx: CanvasRenderingContext2D, 
  chartArea: { bottom: number; top: number }, 
  options: GradientOptions
) {
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, options.colorStart);
  gradient.addColorStop(1, options.colorEnd);
  return gradient;
}

export interface PoolBalanceHistoryItem {
  pool_id: number;
  date: string;
  day_index: number;
  token_0_balance: number;
  token_1_balance: number;
  lp_token_supply: number;
  token_0_price_usd: number;
  token_1_price_usd: number;
  tvl_usd: number;
}

// Function to check if data shows variation or is completely flat
export function checkDataVariation(data: PoolBalanceHistoryItem[]): boolean {
  // Check for token 0
  const token0Variation = data.some((item, i) => {
    return i > 0 && Math.abs(item.token_0_balance - data[i-1].token_0_balance) > 0.00001;
  });
  
  // Check for token 1
  const token1Variation = data.some((item, i) => {
    return i > 0 && Math.abs(item.token_1_balance - data[i-1].token_1_balance) > 0.00001;
  });
  
  // Check for LP token supply
  const lpVariation = data.some((item, i) => {
    return i > 0 && Math.abs(item.lp_token_supply - data[i-1].lp_token_supply) > 0.00001;
  });
  
  return token0Variation || token1Variation || lpVariation;
}

// Load Chart.js with theme detection
export async function initializeChart() {
  let Chart = null;
  let isChartAvailable = false;
  let isDarkMode = false;
  let observer: MutationObserver | null = null;
  
  try {
    // Dynamic import for client-side only
    Chart = (await import('chart.js/auto')).default;
    isChartAvailable = true;
    
    // Detect current theme
    isDarkMode = document.documentElement.classList.contains('dark');
    
    // Watch for theme changes
    observer = new MutationObserver(() => {
      const newDarkMode = document.documentElement.classList.contains('dark');
      if (newDarkMode !== isDarkMode) {
        isDarkMode = newDarkMode;
      }
    });
    
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class']
    });
  } catch (error) {
    console.error('Failed to load Chart.js:', error);
    isChartAvailable = false;
  }
  
  return {
    Chart,
    isChartAvailable,
    isDarkMode,
    observer
  };
}

// Common chart theme settings
export function getChartThemeColors(isDarkMode: boolean) {
  return {
    token0Color: 'rgba(0, 149, 235, 1)', // Kong blue
    token1Color: 'rgba(0, 180, 115, 1)', // Accent green
    tvlColor: 'rgba(111, 93, 251, 1)', // Accent purple
    changePointColor: isDarkMode ? 'rgba(234, 67, 53, 1)' : 'rgba(220, 38, 38, 1)', // Accent red
    tooltipBgColor: isDarkMode ? 'rgba(20, 24, 38, 0.95)' : 'rgba(235, 244, 252, 0.95)',
    tooltipBorderColor: isDarkMode ? 'rgba(35, 39, 53, 1)' : 'rgba(214, 226, 240, 1)',
    tooltipTextColor: isDarkMode ? 'rgba(255, 255, 255, 1)' : 'rgba(15, 23, 42, 1)',
    gridColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    tickColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    pointBorderColor: isDarkMode ? 'rgba(13, 17, 31, 1)' : 'rgba(255, 255, 255, 1)'
  };
}

// Clean up chart resources
export function cleanupChart(chart: ChartJS | null, observer: MutationObserver | null) {
  if (chart) {
    chart.destroy();
  }
  
  if (observer) {
    observer.disconnect();
  }
}

// Helper function to format numbers consistently
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Create theme-aware gradient for chart backgrounds
export function createChartGradient(
  ctx: CanvasRenderingContext2D, 
  isDarkMode: boolean, 
  colorRgb: string, 
  height = 250
): CanvasGradient {
  // Create gradient from bottom to top of the chart area
  // Use the maximum height of the canvas to ensure it covers the entire chart
  const canvasHeight = ctx.canvas.height || height;
  const gradient = ctx.createLinearGradient(0, canvasHeight, 0, 0);
  
  // Start with more opacity at the top
  gradient.addColorStop(0, `${colorRgb.replace('1)', '0.05)')}`); // More visible at bottom
  gradient.addColorStop(0.7, `${colorRgb.replace('1)', isDarkMode ? '0.25)' : '0.2)')}`); // Darker middle blend
  gradient.addColorStop(1, `${colorRgb.replace('1)', isDarkMode ? '0.4)' : '0.35)')}`); // Much more visible at top
  
  return gradient;
}

// Common chart options that can be shared between charts
export function getCommonChartOptions(
  isDarkMode: boolean, 
  tooltipCallbacks: any = {}
): ChartOptions {
  const colors = getChartThemeColors(isDarkMode);
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          display: true,
          color: colors.gridColor,
        },
        ticks: {
          display: false,
          color: colors.tickColor,
          callback: function(value: number) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value.toString();
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          display: false,
          maxRotation: 0,
          color: colors.tickColor,
          callback: function(value: number, index: number, values: any[]) {
            // Only show a few dates to avoid crowding
            if (values.length <= 5 || index === 0 || index === values.length - 1 || index % Math.ceil(values.length / 5) === 0) {
              return this.getLabelForValue(value);
            }
            return '';
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
        backgroundColor: colors.tooltipBgColor,
        titleColor: colors.tooltipTextColor,
        bodyColor: colors.tooltipTextColor,
        borderColor: colors.tooltipBorderColor,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        ...tooltipCallbacks
      }
    },
    animation: {
      duration: 300, // Reduced animation duration for better performance
      easing: 'easeOutQuart'
    },
    elements: {
      point: {
        radius: 2,
        hoverRadius: 5,
        borderWidth: 1.5
      },
      line: {
        tension: 0.3 // Smoother curves
      }
    }
  };
}

// Calculate significant change points for any numeric data series
export function calculateSignificantChanges<T>(
  data: T[], 
  valueKey: keyof T, 
  dateKey: keyof T = 'date' as keyof T, 
  threshold = 0.01
): Array<{x: any, y: number, change: number}> {
  if (!data || data.length < 2) return [];
  
  const points = [];
  data.forEach((entry, index) => {
    if (index === 0) return; // Skip first entry
    
    const prevEntry = data[index - 1];
    const currentValue = Number(entry[valueKey]);
    const prevValue = Number(prevEntry[valueKey]);
    const change = currentValue - prevValue;
    
    // If there's a significant change based on threshold
    if (Math.abs(change) > prevValue * threshold) {
      points.push({
        x: entry[dateKey],
        y: currentValue,
        change: change
      });
    }
  });
  
  return points;
} 