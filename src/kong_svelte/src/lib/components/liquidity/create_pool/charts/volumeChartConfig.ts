import type { ChartConfiguration } from 'chart.js';

export function getVolumeChartConfig(): ChartConfiguration {
  return {
    type: 'bar',
    data: {
      labels: ['7d', '6d', '5d', '4d', '3d', '2d', '1d'],
      datasets: [{
        label: 'Volume',
        data: [30, 25, 35, 45, 40, 50, 45],
        backgroundColor: '#4F46E530',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          border: {
            display: false
          },
          grid: {
            display: false
          },
          ticks: {
            display: false
          }
        },
        y: {
          border: {
            display: false
          },
          grid: {
            color: '#27272A'
          },
          ticks: {
            display: false
          }
        }
      }
    }
  };
} 