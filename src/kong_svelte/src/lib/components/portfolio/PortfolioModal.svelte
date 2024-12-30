<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
  import { onMount } from "svelte";
  import { portfolioValue, tokenStore } from "$lib/services/tokens/tokenStore";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { liveUserPools } from "$lib/services/pools/poolStore";

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  export let isOpen = false;
  export let onClose = () => {};
  
  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let currentData: any = null;

  function handleRefresh() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    updateChart();
  }

  // Helper function to safely serialize data including BigInts
  function safeSerialize(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint'
        ? value.toString()
        : value
    );
  }

  // Calculate portfolio data from actual token balances and pool positions
  $: portfolioData = (() => {
    const tokens = $liveTokens;
    const balances = $tokenStore.balances;
    const userPools = $liveUserPools;
    
    // Only do expensive operations if data has changed
    const dataKey = safeSerialize({ 
      tokens: tokens.map(t => t.canister_id),
      balances: Object.keys(balances),
      userPools: userPools.map(p => p.canister_id)
    });
    
    if (currentData?.key === dataKey) {
      return currentData.data;
    }
    
    
    // Process token balances
    const tokenData = tokens
      .filter(token => {
        const balance = balances[token.canister_id]?.in_usd;
        const numBalance = typeof balance === 'bigint' 
          ? Number(balance)
          : Number(balance);
        return balance && balance !== '0' && !isNaN(numBalance);
      })
      .map(token => ({
        label: token.symbol,
        balance: typeof balances[token.canister_id]?.in_usd === 'bigint'
          ? Number(balances[token.canister_id].in_usd)
          : Number(balances[token.canister_id]?.in_usd || 0)
      }));


    // Process pool positions
    const poolData = userPools
      .filter(pool => pool.usd_balance && Number(pool.usd_balance) > 0)
      .map(pool => ({
        label: `${pool.symbol_0}/${pool.symbol_1} LP`,
        balance: Number(pool.usd_balance)
      }));


    // Combine token and pool data
    const combinedData = [...tokenData, ...poolData]
      .sort((a, b) => b.balance - a.balance);

    // Take top 5 positions and group the rest as "Others"
    const topPositions = combinedData.slice(0, 5);
    const otherPositions = combinedData.slice(5);
    
    const otherSum = otherPositions.reduce((sum, item) => sum + item.balance, 0);
    
    const labels = [
      ...topPositions.map(item => item.label),
      ...(otherPositions.length > 0 ? ['Others'] : [])
    ];
    
    const data = [
      ...topPositions.map(item => item.balance),
      ...(otherPositions.length > 0 ? [otherSum] : [])
    ];

    const colors = [
      'rgba(54, 162, 235, 0.8)',   // blue
      'rgba(75, 192, 192, 0.8)',   // teal
      'rgba(255, 99, 132, 0.8)',   // pink
      'rgba(255, 206, 86, 0.8)',   // yellow
      'rgba(153, 102, 255, 0.8)',  // purple
      'rgba(128, 128, 128, 0.8)',  // gray (for Others)
    ];

    const borderColors = colors.map(color => color.replace('0.8', '1'));

    const chartData = {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: borderColors.slice(0, labels.length),
        borderWidth: 1
      }]
    };

    // Cache the calculated data
    currentData = {
      key: dataKey,
      data: chartData
    };

    return chartData;
  })();

  const chartOptions = {
    responsive: true,
    animation: {
      duration: 350
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#CBD5E1',
          padding: 20,
          font: {
            family: "'Exo 2', sans-serif",
            size: 12
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        bodyFont: {
          family: "'Exo 2', sans-serif"
        },
        padding: 12,
        cornerRadius: 4,
        callbacks: {
          label: function(context) {
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
  };

  function updateChart() {
    if (!canvas || !isOpen) return;

    if (chart) {
      chart.destroy();
    }

    chart = new Chart(canvas, {
      type: 'doughnut',
      data: portfolioData,
      options: chartOptions
    });
  }

  $: if (isOpen && canvas) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      updateChart();
    }, 0);
  }

  onMount(() => {
    return () => {
      if (chart) {
        chart.destroy();
        chart = null;
      }
    };
  });
</script>

<style>
  :global(.chart-container) {
    color: rgb(var(--text-primary));
  }
</style>

<Modal
  {isOpen}
  {onClose}
  width="500px"
  height="auto"
  minHeight="400px"
>
  <h2 slot="title" class="text-lg font-medium">Portfolio Distribution</h2>
  
  <div class="p-4 flex flex-col gap-4 j">
    <div class="text-center mb-4">
      <h3 class="text-lg font-medium text-kong-text-primary">Total Value</h3>
      <p class="text-2xl font-bold text-kong-text-primary">${$portfolioValue}</p>
    </div>
    
    <div 
      class="chart-container flex items-center justify-center" 
      style="position: relative; height:300px; width:100%"
    >
      <canvas bind:this={canvas}></canvas>
    </div>

    <div class="flex justify-center mt-2">
      <button
        on:click={handleRefresh}
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-kong-text-primary bg-kong-bg-light rounded-lg hover:bg-opacity-80 transition-colors"
      >
        <svg 
          class="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Refresh
      </button>
    </div>
  </div>
</Modal> 