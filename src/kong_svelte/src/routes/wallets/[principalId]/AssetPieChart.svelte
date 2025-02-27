<script lang="ts">
  import { 
    Chart,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    DoughnutController
  } from 'chart.js';
  
  // Only register what we need for the doughnut chart
  Chart.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    DoughnutController
  );

  import { onDestroy } from "svelte";
  import { getChartColors } from '$lib/components/portfolio/chartConfig';
  import { processPortfolioData, createChartData } from '$lib/components/portfolio/portfolioDataProcessor';
  import { userTokens } from '$lib/stores/userTokens';
  import { currentUserBalancesStore } from "$lib/services/tokens/tokenStore";
  import { walletPoolListStore } from '$lib/stores/walletPoolListStore';
  import { derived } from 'svelte/store';

  const liveWalletPools = derived(walletPoolListStore, s => s.processedPools);

  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let currentData: any = null;

  // Export the refresh function
  export const refresh = () => {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    if (canvas) {
      initChart(canvas, portfolioData);
    }
  };

  // Debounce helper
  function debounce(fn: Function, ms: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function safeSerialize(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  // Chart initialization and cleanup
  const initChart = debounce((canvas: HTMLCanvasElement, data: any) => {
    if (!canvas || !data?.datasets?.[0]?.data?.length) {
      return;
    }

    if (chart) {
      chart.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    
    chart = new Chart(canvas, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#CBD5E1' : '#1E293B',
              font: {
                family: "'Exo 2', sans-serif",
                size: 12
              }
            }
          }
        }
      }
    });
  }, 150);

  $: portfolioData = (() => {
    const tokens = $userTokens.tokens;
    const balances = $currentUserBalancesStore;
    const walletPools = $liveWalletPools;
    
    const dataKey = safeSerialize({ 
      tokens: tokens.map(t => t.canister_id),
      balances: Object.keys(balances),
      walletPools: walletPools.map(p => `${p.address_0}-${p.address_1}`)
    });
    
    if (currentData?.key === dataKey) {
      return currentData.data;
    }

    const { topPositions, otherPositions } = processPortfolioData(tokens, balances, walletPools);
    const { colors, getBorderColors } = getChartColors();
    const borderColors = getBorderColors(colors);
    const chartData = createChartData(topPositions, otherPositions, colors, borderColors);
    currentData = { key: dataKey, data: chartData };
    return chartData;
  })();

  // Add reactive statement to update chart when data or canvas changes
  $: if (canvas && portfolioData?.datasets?.[0]?.data?.length) {
    initChart(canvas, portfolioData);
  }

  // Enhanced cleanup
  onDestroy(() => {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  });
</script>

<div class="w-[90%] mx-auto aspect-square">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  canvas {
    width: 100% !important;
    height: 100% !important;
  }
</style>
