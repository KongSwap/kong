import { kongDB } from "$lib/services/db";
import { fetchChartData } from "$lib/services/indexer/api";
import { poolStore } from "$lib/services/pools";
import { get } from "svelte/store";
import { CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";

export async function calculate24hPriceChange(token: FE.Token): Promise<number> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const twoDaysAgo = now - (2 * 24 * 60 * 60); // 2 days ago to ensure we have enough data
    
    const pools = get(poolStore).pools.filter(pool => 
      pool.address_0 === token.canister_id || pool.address_1 === token.canister_id
    );
    
    if (pools.length === 0) return 0;

    // Use Promise.all to handle multiple async operations
    const priceChanges = await Promise.all(pools.map(async (pool) => {
      const token0 = await kongDB.tokens.get(pool.address_0);
      const token1 = await kongDB.tokens.get(pool.address_1);
      
      if (!token0 || !token1) return 0;
      
      if (token1.address === CKUSDT_CANISTER_ID) {
        const chartData = await fetchChartData(
          Number(token1.token_id),
          Number(token0.token_id),
          twoDaysAgo,
          now,
          "1D"
        );
        
        if (!chartData?.length || chartData.length < 2) return 0;
        
        const sortedData = chartData.sort((a, b) => 
          new Date(a.candle_start).getTime() - new Date(b.candle_start).getTime()
        );
        
        const currentPrice = Number(token.metrics.price);
        const previousPrice = Number(sortedData[0]?.close_price || 0);

        console.log("PRICE DATA", {
          currentPrice,
          previousPrice
        });
        
        if (previousPrice === 0) return 0;
        
        return ((currentPrice - previousPrice) / previousPrice) * 100;
      } else {
        try {
          const now = Math.floor(Date.now() / 1000);  
          const yesterday = now - (1 * 24 * 60 * 60); // 2 days ago

          const chartData = await fetchChartData(
            Number(token1.token_id), 
            Number(token0.token_id), 
            yesterday,
            now, 
            "1D"
          );

          console.log("TOKENS", {
            token0,
            token1
          });
  
          if(!chartData?.length) return 0;
  
          const todaysCandle = chartData.sort((a, b) => 
            new Date(a.candle_start).getTime() - new Date(b.candle_start).getTime()
          )[0];

          console.log("TODAYS CANDLE", todaysCandle);
  

          const todaysPrice = Number(todaysCandle.close_price) * Number(token1.metrics.price);
          const yesterdayPrice = Number(await calculateYesterdaysWeightedPrice(token1));

          console.log("CALC TODAYS PRICE", todaysPrice);
          console.log("CALC YESTERDAY PRICE", yesterdayPrice);
          console.log("CALC PRICE CHANGE", ((todaysPrice) / yesterdayPrice) * 100);
          
          return ((todaysPrice - yesterdayPrice) / yesterdayPrice) * 100;
        } catch (error) {
          console.error("Error calculating price change:", error);
          return 0;
        }
      }
    }));

    // Calculate weighted average of all valid price changes
    const validChanges = priceChanges.filter(change => change !== 0);
    return validChanges.length > 0
      ? Number((validChanges.reduce((a, b) => a + b, 0) / validChanges.length).toFixed(2))
      : 0;
      
  } catch (error) {
    console.error("Error calculating 24h price change:", error);
    return 0;
  }
}

export const calculateYesterdaysWeightedPrice = async (token: FE.Token): Promise<number> => {
   const pools = get(poolStore).pools.filter(pool => 
     pool.address_0 === token.canister_id || pool.address_1 === token.canister_id
   );
   
   if(pools.length === 0) return 0;
   
   const now = Math.floor(Date.now() / 1000);
   const yesterday = now - (2 * 24 * 60 * 60); // 2 days ago

   // Use Promise.all to handle multiple async operations
   const prices = await Promise.all(pools.map(async (pool) => {
    const token0 = await kongDB.tokens.get(pool.address_0);
    const token1 = await kongDB.tokens.get(pool.address_1);

    if(!token0 || !token1) return 0;

    if(token1.address === CKUSDT_CANISTER_ID) {
      const chartData = await fetchChartData(
        Number(token0.token_id), 
        Number(token1.token_id), 
        yesterday,
        now, 
        "1D"
      );
      
      if(!chartData?.length) return 0;
      
      const yesterdaysCandle = chartData.sort((a, b) => 
        new Date(a.candle_start).getTime() - new Date(b.candle_start).getTime()
      )[0];
      
      return Number(yesterdaysCandle?.close_price || 0);
    } else {
      try {
        const chartData = await fetchChartData(
          Number(token1.token_id), 
          Number(token0.token_id), 
          yesterday,
          now, 
          "1D"
        );

        if(!chartData?.length) return 0;

        const yesterdaysCandle = chartData.sort((a, b) => 
          new Date(a.candle_start).getTime() - new Date(b.candle_start).getTime()
        )[0];

        const token1YesterdayUsdData = await fetchChartData(
          Number(token1.token_id), 
          Number(1), 
          yesterday,
          now, 
          "1D"
        );

        if(!token1YesterdayUsdData?.length || !yesterdaysCandle) return 0;

        const otherTokenPriceUsd = token1YesterdayUsdData.sort((a, b) => 
          new Date(a.candle_start).getTime() - new Date(b.candle_start).getTime()
        )[0]?.close_price || 0;

        return Number(yesterdaysCandle.close_price) * Number(otherTokenPriceUsd);
      } catch (error) {
        console.error("Error calculating price:", error);
        return 0;
      }
    }
   }));

   // Return the average of all valid prices
   const validPrices = prices.filter(price => price > 0);
   return validPrices.length > 0 
     ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length 
     : 0;
}