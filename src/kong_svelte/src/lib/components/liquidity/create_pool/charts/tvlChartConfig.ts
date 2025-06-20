import type { ChartConfiguration } from 'chart.js';

export function getTVLChartConfig(): ChartConfiguration {
  return {
    type: 'bar',
    data: {
      labels: ['', '', '', '', '', '', ''],
      datasets: [
        {
          data: [65, 59, 80, 81, 56, 55, 40],
          backgroundColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return 'rgba(59, 130, 246, 0.9)';
            
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.9)');
            return gradient;
          },
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 32,
          minBarLength: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0
      },
      animation: {
        duration: 750,
        easing: 'easeOutQuart'
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(11, 14, 23, 0.9)', // kong-bg-primary with opacity
          padding: 12,
          titleColor: '#9BA1B0', // kong-text-secondary
          bodyColor: '#FFFFFF', // kong-text-primary
          borderColor: 'rgba(42, 47, 61, 0.5)', // kong-border with opacity
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: (context) => {
              const value = context.parsed.y?.toLocaleString() || '0';
              return ` TVL: $${value}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            offset: false
          },
          ticks: {
            color: '#9BA1B0' // kong-text-secondary
          }
        },
        y: {
          display: false,
          grid: {
            color: 'rgba(42, 47, 61, 0.5)',
            offset: false
          }
        }
      }
    }
  };
} 