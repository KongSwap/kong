<script lang="ts">
  import { switchLocale } from "$lib/stores/localeStore";
  import { t } from "$lib/locales/translations";
  import { backendService } from "$lib/services/backendService";
  import { onMount } from "svelte";
  import { isEqual } from "lodash-es";
  import { browser } from "$app/environment";

  let options = {
    chart: {
      height: "150px",
      type: "line",
      toolbar: {
        show: false,
      },
    },
    colors: ["#51a31f"],
    series: [
      {
        name: "sales",
        data: [30, 40, 35, 50, 49, 60, 70, 91, 125],
      },
    ],
    grid: {
    show: false
},
    yaxis: {
      show: false,
      labels: {
        show: false,
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    xaxis: {
      categories: [1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999],
      show: false,
      labels: {
        show: false,
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
  };

  type PoolsTotals = {
    totalTvl: number | string;
    totalVolume: number | string;
    totalFees: number | string;
  };

  let tokens: any = null;
  let clouds = [];
  let poolsInfo = [];
  let poolsTotals: PoolsTotals = {
    totalTvl: 0,
    totalVolume: 0,
    totalFees: 0,
  };
  let previousPoolBalances = null;

  let wobbleClass = "wobble";
  let chartLib;

  onMount(async () => {
    switchLocale("en");
    let { chart } = await import("svelte-apexcharts");
    chartLib = chart;
    try {
      tokens = await backendService.getTokens();
      await updatePoolBalances();
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }

    clouds = Array.from({ length: 20 }, (_, i) => ({
      src: `/backgrounds/cloud${(i % 4) + 1}.webp`,
      top: `${Math.random() * 85}%`,
      left: Math.random() > 0.5 ? "-20%" : "120%",
      animationDuration: `${200 + Math.random() * 1200}s`,
      delay: `-${Math.random() * 1000}s`,
      direction: Math.random() > 0.5 ? 1 : -1,
      size: 0.7 + Math.random() * 1.3,
    }));

    setTimeout(() => {
      wobbleClass = "";
    }, 400);
  });

  async function updatePoolBalances() {
    try {
      const liquidity_pool_balances_response = await backendService.getPools();
      const liquidity_pool_balances =
        (liquidity_pool_balances_response.Ok &&
          liquidity_pool_balances_response.Ok.pools) ||
        [];

      if (!isEqual(previousPoolBalances, liquidity_pool_balances)) {
        poolsInfo = liquidity_pool_balances;
        previousPoolBalances = liquidity_pool_balances;
        const decimals = 6;

        const formatBigInt = (value: bigint | number) => {
          if (typeof value === "bigint") {
            const dividedValue = Number(value) / 10 ** decimals;
            return dividedValue.toFixed(0);
          }
          return value;
        };

        poolsTotals.totalTvl = formatBigInt(
          liquidity_pool_balances_response.Ok.total_tvl || 0,
        );
        poolsTotals.totalVolume = formatBigInt(
          liquidity_pool_balances_response.Ok.total_24h_volume || 0,
        );
        poolsTotals.totalFees = formatBigInt(
          liquidity_pool_balances_response.Ok.total_24h_lp_fee || 0,
        );
      }

      if (liquidity_pool_balances_response.hasOwnProperty("Err")) {
        console.error(liquidity_pool_balances_response.Err);
      }
    } catch (error) {
      console.error("Error fetching pool balances, retrying...", error);
      setTimeout(updatePoolBalances, 2000);
    }
  }

  const formatNumberCustom = (number, maxDecimals) => {
    const parts = number.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (maxDecimals > 0) {
      const decimalPart = (parts[1] || "")
        .padEnd(maxDecimals, "0")
        .substring(0, maxDecimals);
      return `${integerPart}.${decimalPart}`;
    } else {
      return integerPart;
    }
  };

  const getTokenDecimals = (symbol) => {
    return 6;
  };

  $: if (poolsInfo.length > 0 && tokens) {
    poolsInfo = poolsInfo.map((pool) => {
      const balance = Number(pool.balance || 0);
      const decimals1 = getTokenDecimals(pool.symbol_1);

      const apy = formatNumberCustom(Number(pool.rolling_24h_apy || 0), 2);
      const roll24hVolume = formatNumberCustom(
        Number(pool.rolling_24h_volume || 0) / 10 ** decimals1,
        0,
      );
      const tvl = formatNumberCustom(balance / 10 ** decimals1, 0);

      return {
        ...pool,
        apy,
        roll24hVolume,
        tvl,
      };
    });
  }
</script>

<div class="floating-clouds w-screen h-screen overflow-hidden z-[1]">
  {#each clouds as cloud}
    <img
      src={cloud.src}
      alt="Cloud"
      class="cloud"
      style="
        top: {cloud.top}; 
        left: {cloud.left}; 
        animation-duration: {cloud.animationDuration}; 
        animation-delay: {cloud.delay}; 
        animation-direction: {cloud.direction === 1 ? 'normal' : 'reverse'};
        transform: scale({cloud.size});
      "
    />
  {/each}
</div>

<main class="flex flex-col min-h-screen bg-sky-100 relative pt-28">
  <div
    class="mt-8 z-20 flex justify-center w-11/12 max-w-5xl mx-auto font-alumni"
  >
    <div
      class="w-full sign flex items-center justify-center wood-border z-30 text-sm md:text-lg pt-2 gap-x-4 px-2"
    >
      {#if chartLib}
      <div class="flex flex-col">
        <h2 class="text text-3xl font-semibold text-amber-900 uppercase">Total Value Locked</h2>
        <div use:chartLib={options} class="py-4" />
      </div>
      <div class="flex flex-col">
        <h2 class="text text-3xl font-semibold text-amber-900 uppercase">24HR Volume</h2>
        <div use:chartLib={options} class="py-4" />
      </div>
      <div class="flex flex-col">
        <h2 class="text text-3xl font-semibold text-amber-900 uppercase">Total Value Locked</h2>
        <div use:chartLib={options} class="py-4" />
      </div>
      {/if}
      <!-- <ul class="text-left text-3xl">
        <h2 class="text-center text-3xl font-semibold text-black uppercase">
          Totals
        </h2>
        <li>
          {$t("stats.totalTvl")}: ${formatNumberCustom(poolsTotals.totalTvl, 2)}
        </li>
        <li>
          {$t("stats.24hVolume")}: ${formatNumberCustom(
            poolsTotals.totalVolume,
            2,
          )}
        </li>
        <li>
          {$t("stats.24hFees")}: ${formatNumberCustom(poolsTotals.totalFees, 2)}
        </li>
      </ul> -->
    </div>
  </div>
  <div class="flex-grow z-10 mb-32">
    <!-- Pool Overview Section -->
    <div
      class="bg-k-light-blue bg-opacity-40 border-[5px] border-black p-0.5 w-11/12 max-w-5xl mx-auto mt-6"
    >
      <div class="inner-border p-4 w-full h-full">
        <h2
          class="text-center font-black text-3xl text-white mb-4 text-outline-2"
        >
          {$t("stats.overviewOfKongPools")}
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-black font-alumni">
            <thead>
              <tr class="border-b-4 border-black text-3xl uppercase">
                <th class="p-2 uppercase text-left">{$t("stats.poolName")}</th>
                <th class="p-2 text-right">{$t("stats.price")}</th>
                <th class="p-2 text-right">{$t("stats.tvl")}</th>
                <th class="p-2 text-right">{$t("stats.24hVolume")}</th>
                <th class="p-2 text-right">{$t("stats.apy")}</th>
                <th class="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {#each poolsInfo as pool}
                <tr class="border-b-2 border-black text-3xl">
                  <td class="p-2 uppercase font-bold"
                    >{pool.symbol_0}/{pool.symbol_1}</td
                  >
                  <td class="p-2 text-right"
                    >${formatNumberCustom(pool.price, 2)}</td
                  >
                  <td class="p-2 text-right">${pool.tvl}</td>
                  <td class="p-2 text-right">${pool.roll24hVolume}</td>
                  <td class="p-2 text-right">{pool.apy}%</td>
                  <td class="p-2">
                    <div class="flex justify-center gap-2">
                      <button
                        class="bg-green-500 hover:bg-green-700 text-black font-bold py-1 px-4 rounded-full border-2 border-black"
                      >
                        {$t("stats.swap")}
                      </button>
                      <button
                        class="bg-yellow-500 hover:bg-yellow-700 text-black font-bold py-1 px-4 rounded-full border-2 border-black"
                      >
                        {$t("stats.addLiquidity")}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Total Summary -->
  <div class="w-full font-alumni z-[2]">
    <div
      class="absolute bottom-[15.2rem] left-[3rem] rounded-lg p-4 w-56 mx-auto mt-6 z-20 text-2xl {wobbleClass} hidden md:block"
    >
      <h3 class="text-center text-3xl font-semibold text-black uppercase">
        {$t("stats.totalStats")}
      </h3>
      <ul class="text-left">
        <li>
          {$t("stats.totalTvl")}: ${formatNumberCustom(poolsTotals.totalTvl, 2)}
        </li>
        <li>
          {$t("stats.24hVolume")}: ${formatNumberCustom(
            poolsTotals.totalVolume,
            2,
          )}
        </li>
        <li>
          {$t("stats.24hFees")}: ${formatNumberCustom(poolsTotals.totalFees, 2)}
        </li>
      </ul>
    </div>
    <img
      src="/backgrounds/grass_post.webp"
      alt="Sign Post"
      class="absolute bottom-[3.5rem] left-0 z-10 {wobbleClass} hidden md:block"
    />
    <div
      style="background-image:url('/backgrounds/grass.webp'); background-repeat: repeat-x; background-size: 100% 100%;"
      class="w-full min-h-[80px] max-h-[80px]"
    ></div>
  </div>
</main>

<style>
  .font-alumni {
    font-family: "Alumni Sans", sans-serif;
  }

  main {
    background-color: #5bb2cf;
    background-size: cover;
    background-position: center;
  }

  .inner-border {
    box-shadow: inset 0 0 0 2px white;
  }

  .floating-clouds {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  .cloud {
    position: absolute;
    animation-name: float;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  @keyframes float {
    from {
      transform: translateX(-200vw);
    }
    to {
      transform: translateX(200vw);
    }
  }

  @keyframes wobble {
    0% {
      transform: translateX(0%);
    }
    15% {
      transform: rotate(-1deg);
    }
    30% {
      transform: rotate(1deg);
    }
    45% {
      transform: rotate(-1deg);
    }
    60% {
      transform: rotate(1deg);
    }
    75% {
      transform: rotate(-1deg);
    }
    100% {
      transform: translateX(0%);
    }
  }

  .wobble {
    animation: wobble 0.8s ease-in-out;
  }
  .wood-border {
    background: url("/stats/papyrus_texture3.webp") repeat center center fixed;
    border: 10px solid transparent; /* Ensure the border is transparent to show the image */
    border-image-source: url("/stats/concrete_texture2.jpg");
    border-image-slice: 30; /* Use a small slice value to utilize the full height of the image */
    border-image-width: 8px; /* Match the border width */
    border-image-repeat: repeat; /* Ensure the image repeats along the border */
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f2ecdb; /* Background color of the content area */
    color: #333; /* Text color, adjust as necessary */
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); /* Optional shadow for depth */
  }

  /* Placeholder for content */
  .wood-border p {
    margin: 0;
    padding: 20px;
  }
</style>
