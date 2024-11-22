import { PrismaClient } from "@prisma/client";
import { ICanisterActor, TokenData } from "./types.js";
import { convertBigIntsToStrings } from "./utils.js";

export class TokenService {
  private prisma: PrismaClient;

  constructor(
    private readonly canisterActor: ICanisterActor,
    prisma: PrismaClient
  ) {
    this.prisma = prisma;
  }

  async fetchAndStoreTokens() {
    try {
      const result = await this.canisterActor.actor.tokens(['all']);
      console.log("Tokens result:", result);
      if ("Ok" in result) {
        const tokens = result.Ok;

        for (const token of tokens) {
          const type = "LP" in token ? "LP" : "IC";
          const tokenData = type === "LP" ? token.LP : token.IC;
          
          if (tokenData) {
            await this.upsertToken(type, tokenData);
          } else {
            console.warn("Received token without LP or IC data:", token);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }
  }

  async getTokens() {
    try {
      return await this.prisma.token.findMany({
        orderBy: {
          tokenId: 'asc'
        }
      });
    } catch (error) {
      console.error("Error getting tokens:", error);
      throw error;
    }
  }

  async getTokenById(tokenId: number) {
    try {
      return await this.prisma.token.findFirst({
        where: { tokenId }
      });
    } catch (error) {
      console.error("Error getting token:", error);
      throw error;
    }
  }

  private async upsertToken(type: string, tokenData: TokenData) {
    const convertedData = convertBigIntsToStrings(tokenData);
    
    await this.prisma.token.upsert({
      where: {
        tokenId_type: {
          tokenId: tokenData.token_id,
          type: type,
        },
      },
      update: {
        poolSymbol: convertedData.pool_symbol,
        name: convertedData.name,
        chain: convertedData.chain,
        symbol: convertedData.symbol,
        token: convertedData.token,
        onKong: convertedData.on_kong,
        ...(type === "LP"
          ? {
              poolIdOf: convertedData.pool_id_of,
              address: convertedData.address,
              decimals: convertedData.decimals,
              fee: convertedData.fee,
              totalSupply: convertedData.total_supply,
            }
          : {
              canisterId: convertedData.canister_id,
              icrc1: convertedData.icrc1,
              icrc2: convertedData.icrc2,
              icrc3: convertedData.icrc3,
            }),
      },
      create: {
        tokenId: convertedData.token_id,
        type: type,
        poolSymbol: convertedData.pool_symbol,
        name: convertedData.name,
        chain: convertedData.chain,
        symbol: convertedData.symbol,
        token: convertedData.token,
        onKong: convertedData.on_kong,
        ...(type === "LP"
          ? {
              poolIdOf: convertedData.pool_id_of,
              address: convertedData.address,
              decimals: convertedData.decimals,
              fee: convertedData.fee,
              totalSupply: convertedData.total_supply,
            }
          : {
              canisterId: convertedData.canister_id,
              icrc1: convertedData.icrc1,
              icrc2: convertedData.icrc2,
              icrc3: convertedData.icrc3,
            }),
      },
    });
  }
}
