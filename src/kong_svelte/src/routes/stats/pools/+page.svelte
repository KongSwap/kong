<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { createChart } from "lightweight-charts";

  let lpId;
  let poolData = {};

  onMount(async () => {
    lpId = $page.url.searchParams.get("id");
    const candlestickContainer = document.getElementById("candlestick-chart");
    if (candlestickContainer) {
      const baseChartOptions = {
        width: candlestickContainer.clientWidth,
        height: 800,
        layout: {
          background: {
            type: "solid",
            color: "#6C351A", // Background color
          },
          textColor: "#FFFFFF", // White text for labels
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        grid: {
          vertLines: {
            color: "#FFFFFF1A",
          },
          horzLines: {
            color: "#FFFFFF1A",
          },
        },
        crosshair: {
          mode: 0,
        },
        priceScale: {
          borderColor: "#FFFFFF33",
          textColor: "#FFFFFF",
          visible: true,
        },
        timeScale: {
          borderColor: "#FFFFFF33",
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (time, tickMarkType, locale) => {
            const date = new Date(time * 1000);
            return date.toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            });
          },
        },
      };

      // Initialize Candlestick Chart
      const candlestickChart = createChart(candlestickContainer, { ...baseChartOptions, height: 400 });
      const candlestickSeries = candlestickChart.addCandlestickSeries({
        upColor: "#4CAF50",
        downColor: "#F44336",
        borderVisible: false,
        wickUpColor: "#4CAF50",
        wickDownColor: "#F44336",
      });

      const candlestickData = [
        { open: 10, high: 10.63, low: 9.49, close: 9.55, time: 1642425322 },
        { open: 9.55, high: 10.30, low: 9.42, close: 9.94, time: 1642511722 },
        { open: 9.94, high: 10.17, low: 9.92, close: 9.78, time: 1642598122 },
        { open: 9.78, high: 10.59, low: 9.18, close: 9.51, time: 1642684522 },
        { open: 9.51, high: 10.46, low: 9.10, close: 10.17, time: 1642770922 },
        { open: 10.17, high: 10.96, low: 10.16, close: 10.47, time: 1642857322 },
        { open: 10.47, high: 11.39, low: 10.40, close: 10.81, time: 1642943722 },
        { open: 10.81, high: 11.60, low: 10.30, close: 10.75, time: 1643030122 },
        { open: 10.75, high: 11.60, low: 10.49, close: 10.93, time: 1643116522 },
        { open: 10.93, high: 11.53, low: 10.76, close: 10.96, time: 1643202922 },
        { open: 10.96, high: 11.53, low: 10.76, close: 10.96, time: 1643289322 },
        { open: 10.96, high: 11.53, low: 10.76, close: 10.96, time: 1643375722 },
        { open: 10.96, high: 11.53, low: 10.76, close: 10.96, time: 1643462122 },
        { open: 10.96, high: 11.53, low: 10.76, close: 10.96, time: 1643548522 },
        { open: 10.96, high: 11.53, low: 10.76, close: 10.96, time: 1643634922 },
        { open: 10.96, high: 11.53, low: 10.76, close: 10.96, time: 1643721322 },

      ];

      candlestickSeries.setData(candlestickData);
      candlestickChart.timeScale().fitContent();

      // Synchronize Time Scales
      const syncCharts = () => {
        const candlestickWidth = candlestickContainer.clientWidth;
        candlestickChart.applyOptions({ width: candlestickWidth });
      };

      window.addEventListener("resize", syncCharts);
      syncCharts();

      // Cleanup on component unmount
      return () => {
        window.removeEventListener("resize", syncCharts);
        candlestickChart.remove();
      };
    }
  });
</script>

<div class="mt-32 flex flex-col items-center">
  <h1 class="text-3xl font-bold font-alumni">Pool: {lpId}</h1>
  <div class="flex justify-center px-2 w-full">
    <div id="candlestick-chart" style="width: 100%; height: 800px;"></div>
  </div>
</div>
