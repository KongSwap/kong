<script lang="ts">
  import { t } from '$lib/locales/translations';
  import { backendService } from '$lib/services/backendService';
  import WalletConnection from '$lib/components/WalletConnection.svelte';
  import { onMount } from 'svelte';
  import { isEqual } from 'lodash-es';

  let tokens: any = null;
  let clouds = []
  let poolsInfo = []; // To store pools information
  let poolsTotals = {
    totalTvl: 0,
    totalVolume: 0,
    totalFees: 0,
  };
  let previousPoolBalances = null;

  onMount(async () => {
    try {
      tokens = await backendService.getTokens();
      await updatePoolBalances();
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }

    clouds = Array.from({ length: 20 }, (_, i) => ({
      src: `/backgrounds/cloud${(i % 4) + 1}.webp`, // Cycle through 4 cloud images
      top: `${Math.random() * 85}%`, // Random vertical position
      left: `${Math.random() * 100}%`, // Random horizontal position
      animationDuration: `${70 + Math.random() * 60}s`, // Random duration between 60s and 120s
      delay: `-${Math.random() * 60}s`, // Random negative delay up to 60s
      direction: Math.random() > 0.5 ? 1 : -1, // Random direction: 1 for right, -1 for left
      size: 0.9 + Math.random() * 1 // Random size between 0.5 and 1.5
    }));
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
          if (typeof value === 'bigint') {
            const dividedValue = Number(value) / 10 ** decimals;
            return dividedValue.toFixed(0);
          }
          return value;
        };

        poolsTotals = {
          totalTvl: formatBigInt(
            liquidity_pool_balances_response.Ok.total_tvl || 0
          ),
          totalVolume: formatBigInt(
            liquidity_pool_balances_response.Ok.total_24h_volume || 0
          ),
          totalFees: formatBigInt(
            liquidity_pool_balances_response.Ok.total_24h_lp_fee || 0
          ),
        };
      }

      if (liquidity_pool_balances_response.hasOwnProperty('Err')) {
        console.error(liquidity_pool_balances_response.Err);
      }
    } catch (error) {
      console.error('Error fetching pool balances, retrying...', error);
      setTimeout(updatePoolBalances, 2000);
    }
  }

  const formatNumberCustom = (number, maxDecimals) => {
    const parts = number.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (maxDecimals > 0) {
      const decimalPart = (parts[1] || "").padEnd(maxDecimals, '0').substring(0, maxDecimals);
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
      const roll24hVolume = formatNumberCustom(Number(pool.rolling_24h_volume || 0) / 10 ** decimals1, 0);
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

<div class="floating-clouds w-screen h-screen overflow-hidden">
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
      "
    />
  {/each}
</div>

<main class="flex flex-col items-center bg-sky-100 min-h-screen p-4">
  <!-- Page Title -->
  <h1 class="text-6xl font-bold font-alumni text-yellow-500 mt-8 mb-4 z-10">
    Kong {$t('stats.stats')}
  </h1>

  <!-- Pool Overview Section -->
  <div class="bg-k-light-blue border-[5px] border-black p-0.5 w-11/12 max-w-5xl mt-6 z-10">
    <div class="inner-border p-10 w-full">
      <h2 class="text-center text-2xl font-bold text-white mb-4 text-outline-2">
        ** {$t('stats.overviewOfKongPools')} **
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full text-black">
          <thead>
            <tr class="border-b-4 border-black">
              <th class="p-2 uppercase text-left">{$t('stats.poolName')}</th>
              <th class="p-2 text-right">{$t('stats.tvl')}</th>
              <th class="p-2 text-right">{$t('stats.24hVolume')}</th>
              <th class="p-2 text-right">{$t('stats.apy')}</th>
              <th class="p-2">{$t('stats.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each poolsInfo as pool}
              <tr class="border-b-2 border-black">
                <td class="p-2 uppercase font-bold">{pool.symbol_0}/{pool.symbol_1}</td>
                <td class="p-2 text-right">${pool.tvl}</td>
                <td class="p-2 text-right">${pool.roll24hVolume}</td>
                <td class="p-2 text-right">{pool.apy}%</td>
                <td class="p-2">
                  <div class="flex justify-center gap-2">
                    <button class="bg-green-500 hover:bg-green-700 text-black font-bold py-1 px-4 rounded-full border-2 border-black">
                      {$t('stats.swap')}
                    </button>
                    <button class="bg-yellow-500 hover:bg-yellow-700 text-black font-bold py-1 px-4 rounded-full border-2 border-black">
                      {$t('stats.addLiquidity')}
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

  <!-- Total Summary -->
  <div class="bg-white border-4 border-black rounded-lg p-4 w-56 mt-6 z-10">
    <h3 class="text-center text-xl font-bold text-black mb-2">{$t('stats.totalStats')}</h3>
    <p>{$t('stats.totalTvl')}: ${formatNumberCustom(poolsTotals.totalTvl, 2)}</p>
    <p>{$t('stats.24hVolume')}: ${formatNumberCustom(poolsTotals.totalVolume, 2)}</p>
    <p>{$t('stats.24hFees')}: ${formatNumberCustom(poolsTotals.totalFees, 2)}</p>
  </div>

  <!-- Kong Character Image -->
  <div class="absolute bottom-0 right-0 z-10">
    <img src="/backgrounds/grass.png" alt="Kong Character" class="w-full">
  </div>
</main>

<style>
  .font-alumni {
    font-family: 'Alumni Sans', sans-serif;
  }

  main {
    background-color: #5BB2CF;
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
    pointer-events: none; /* Ensure clouds don't interfere with user interactions */
  }

  .cloud {
    position: absolute;
    animation-name: float;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  @keyframes float {
    from {
      transform: translateX(-50%);
    
    }
    to {
      transform: translateX(200%);
    }
  }
</style>
