<script lang="ts">
import { page } from "$app/stores";
import { onMount } from "svelte";
import { 
  createChart, 
  type IChartApi, 
  type Time,
  type HistogramData,
  type CandlestickData
} from 'lightweight-charts';
import { fetchChartData, tokens, type CandleData } from "$lib/services/indexer/api";
import { poolStore } from "$lib/services/pools";

const tokenAddress = $page.params.id;
let chartContainer: HTMLElement;
let chart: IChartApi;

$: token = $tokens?.find(t => t.address === tokenAddress);
$: console.log('token:', token);

$: biggestPool = $poolStore?.pools?.filter(p => p.address_0 === tokenAddress)
  .sort((a, b) => b.tvl - a.tvl)[0];
$: console.log('biggestPool:', biggestPool);

interface FormattedCandle extends Omit<CandleData, 'time'> {
  time: Time;
}

const cleanup = () => {
  window.removeEventListener('resize', handleResize);
  if (chart) {
    chart.remove();
  }
};

const initChart = async () => {
  if (!biggestPool || !chartContainer) return;
  
  // Destroy existing chart if it exists
  if (chart) {
    chart.remove();
  }

  chart = createChart(chartContainer, {
    layout: {
      background: { color: 'transparent' },
      textColor: '#d1d5db',
    },
    grid: {
      vertLines: { color: '#334155' },
      horzLines: { color: '#334155' },
    },
    width: chartContainer.clientWidth,
    height: 400,
  });

  const candlestickSeries = chart.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderVisible: false,
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
  });

  const volumeSeries = chart.addHistogramSeries({
    color: '#60a5fa',
    priceFormat: {
      type: 'volume',
    },
    priceScaleId: '',
  });

  // Set the volume series position
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  });

  const endTimestamp = Date.now();
  const startTimestamp = endTimestamp - (7 * 24 * 60 * 60 * 1000);
  
  try {
    const candleData = await fetchChartData(
      Number(biggestPool.pool_id),
      startTimestamp,
      endTimestamp,
      'D'
    );
    console.log(candleData);

    const formattedCandleData: CandlestickData<Time>[] = candleData.map((candle) => ({
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      time: Math.floor(candle.time / 1000) as Time
    }));

    candlestickSeries.setData(formattedCandleData);
    
    const volumeData: HistogramData<Time>[] = candleData.map((candle) => ({
      time: Math.floor(candle.time / 1000) as Time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#22c55e80' : '#ef444480'
    }));
    
    volumeSeries.setData(volumeData);
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
  }
};

const handleResize = () => {
  if (chart && chartContainer) {
    chart.applyOptions({
      width: chartContainer.clientWidth,
    });
  }
};

// Watch for changes in biggestPool and chartContainer
$: if (biggestPool && chartContainer) {
  initChart();
}

onMount(() => {
  window.addEventListener('resize', handleResize);
  return cleanup;
});
</script>

<div class="p-4">
  <h1 class="text-2xl font-bold text-white mb-6">{token?.name} ({token?.symbol})</h1>
  
  {#if token && biggestPool}
    <div class="bg-slate-800 rounded-lg p-4">
      <div 
        bind:this={chartContainer} 
        class="w-full h-[400px]"
      />
    </div>
  {:else}
    <div class="text-white">Loading...</div>
  {/if}
</div>

<style>
  :global(.tv-lightweight-charts) {
    font-family: inherit !important;
  }
</style>
