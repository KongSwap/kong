import { PrismaClient } from "@prisma/client";
import { ICanisterActor, PoolData } from "./types";
import { convertBigIntsToStrings } from "./utils";

export class PoolService {
  private prisma: PrismaClient;

  constructor(
    private readonly canisterActor: ICanisterActor,
    prisma: PrismaClient
  ) {
    this.prisma = prisma;
  }

  async fetchAndStorePools() {
    try {
      const result = await this.canisterActor.actor.pools([]);
      console.log("Pools result:", result);
      if ("Ok" in result) {
        const pools = result.Ok.pools;

        for (const pool of pools) {
          console.log("Processing pool:", pool);
          await this.upsertPool(pool);
        }
      }
    } catch (error) {
      console.error("Error fetching pools:", error);
      throw error;
    }
  }

  async getPools() {
    try {
      return await this.prisma.pool.findMany({
        orderBy: {
          poolId: 'asc'
        }
      });
    } catch (error) {
      console.error("Error getting pools:", error);
      throw error;
    }
  }

  async getPoolById(poolId: number) {
    try {
      return await this.prisma.pool.findUnique({
        where: { poolId }
      });
    } catch (error) {
      console.error("Error getting pool:", error);
      throw error;
    }
  }

  private async upsertPool(poolData: PoolData) {
    const convertedData = convertBigIntsToStrings(poolData);
    
    await this.prisma.pool.upsert({
      where: {
        poolId: poolData.pool_id,
      },
      update: {
        name: convertedData.name,
        symbol: convertedData.symbol,
        balance: convertedData.balance,
        chain0: convertedData.chain_0,
        symbol0: convertedData.symbol_0,
        address0: convertedData.address_0,
        balance0: convertedData.balance_0,
        lpFee0: convertedData.lp_fee_0,
        chain1: convertedData.chain_1,
        symbol1: convertedData.symbol_1,
        address1: convertedData.address_1,
        balance1: convertedData.balance_1,
        lpFee1: convertedData.lp_fee_1,
        price: convertedData.price,
        lpFeeBps: convertedData.lp_fee_bps,
        rolling24hVolume: convertedData.rolling_24h_volume,
        rolling24hLpFee: convertedData.rolling_24h_lp_fee,
        rolling24hNumSwaps: parseInt(convertedData.rolling_24h_num_swaps.toString()),
        rolling24hApy: convertedData.rolling_24h_apy,
        lpTokenSymbol: convertedData.lp_token_symbol,
        lpTokenSupply: convertedData.lp_token_supply,
        totalVolume: convertedData.total_volume,
        totalLpFee: convertedData.total_lp_fee,
        onKong: convertedData.on_kong,
      },
      create: {
        poolId: convertedData.pool_id,
        name: convertedData.name,
        symbol: convertedData.symbol,
        balance: convertedData.balance,
        chain0: convertedData.chain_0,
        symbol0: convertedData.symbol_0,
        address0: convertedData.address_0,
        balance0: convertedData.balance_0,
        lpFee0: convertedData.lp_fee_0,
        chain1: convertedData.chain_1,
        symbol1: convertedData.symbol_1,
        address1: convertedData.address_1,
        balance1: convertedData.balance_1,
        lpFee1: convertedData.lp_fee_1,
        price: convertedData.price,
        lpFeeBps: convertedData.lp_fee_bps,
        rolling24hVolume: convertedData.rolling_24h_volume,
        rolling24hLpFee: convertedData.rolling_24h_lp_fee,
        rolling24hNumSwaps: parseInt(convertedData.rolling_24h_num_swaps.toString()),
        rolling24hApy: convertedData.rolling_24h_apy,
        lpTokenSymbol: convertedData.lp_token_symbol,
        lpTokenSupply: convertedData.lp_token_supply,
        totalVolume: convertedData.total_volume,
        totalLpFee: convertedData.total_lp_fee,
        onKong: convertedData.on_kong,
      },
    });
  }
}
