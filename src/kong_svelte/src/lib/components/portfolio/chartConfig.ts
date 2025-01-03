export const getChartColors = () => ({
  colors: [
    'rgba(37, 99, 235, 0.9)',     // Primary blue
    'rgba(5, 150, 105, 0.9)',     // Green
    'rgba(220, 38, 38, 0.9)',     // Red
    'rgba(234, 179, 8, 0.9)',     // Yellow
    'rgba(147, 51, 234, 0.9)',    // Purple
    'rgba(75, 85, 99, 0.9)',      // Gray (for Others)
  ],
  getBorderColors: (colors: string[]) => colors.map(color => color.replace('0.9', '1'))
});

export const getChartOptions = (isDark: boolean) => ({
  responsive: true,
  animation: { duration: 350 },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: isDark ? '#CBD5E1' : '#1E293B',
        padding: 20,
        font: {
          family: "'Exo 2', sans-serif",
          size: 12,
          weight: '600'
        },
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      titleColor: 'white',
      bodyColor: 'white',
      borderWidth: 0,
      bodyFont: {
        family: "'Exo 2', sans-serif",
        weight: '500'
      },
      titleFont: {
        family: "'Exo 2', sans-serif",
        weight: '600'
      },
      padding: 12,
      cornerRadius: 4,
      callbacks: {
        label: function(context: any) {
          const value = context.raw as number;
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${context.label}: $${value.toLocaleString('en-US', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} (${percentage}%)`;
        }
      }
    }
  }
});

export const getHistoricalChartOptions = (isDark: boolean) => ({
  // ... existing chart options
  scales: {
    x: {
      type: 'time',
      time: {
        unit: 'day'
      },
      grid: {
        display: false
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }
    }
  }
}); 