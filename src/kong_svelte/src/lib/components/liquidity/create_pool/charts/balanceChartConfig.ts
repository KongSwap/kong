import type { ChartConfiguration } from 'chart.js';

export function getBalanceChartConfig(token0: any, token1: any): ChartConfiguration {
  return {
    type: 'line',
    data: {
      labels: ['', '', '', '', '', '', ''],
      datasets: [
        {
          data: [65, 59, 80, 81, 56, 55, 40],
          borderColor: '#00cc81', // kong-success
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#00cc81',
          fill: false
        },
        {
          data: [28, 48, 40, 19, 86, 27, 90],
          borderColor: '#3B82F6', // kong-primary
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#3B82F6',
          fill: false
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
              return ` ${token0 && token1 ? 
                `${context.datasetIndex === 0 ? token0.symbol : token1.symbol}: ${value}` : 
                `Value: ${value}`}`;
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
            offset: false
          }
        }
      }
    }
  };
} 