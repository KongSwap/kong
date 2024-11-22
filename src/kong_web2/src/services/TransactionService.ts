import { PrismaClient } from "@prisma/client";
import { ICanisterActor, TransactionType } from "./types.js";
import { convertBigIntsToStrings } from "./utils.js";

export class TransactionService {
  private prisma: PrismaClient;

  constructor(
    private readonly canisterActor: ICanisterActor,
    prisma: PrismaClient
  ) {
    this.prisma = prisma;
  }

  async fetchAndStoreTransactions() {
    try {
      const result = await this.canisterActor.actor.txs([false]);
      console.log("Transactions result:", result);
      if ("Ok" in result) {
        // Sort transactions by txId ascending so oldest are processed first
        const transactions = result.Ok.sort((a: any, b: any) => {
          return parseInt(a.Swap.tx_id) - parseInt(b.Swap.tx_id);  // Sort ascending
        });

        // Clear existing transactions to reset IDs
        await this.prisma.transaction.deleteMany({});

        for (const tx of transactions) {
          console.log("Processing transaction:", tx);
          if (!tx.Swap) continue; // Skip non-swap transactions for now
          
          const txId = tx.Swap.tx_id.toString(); // Convert BigInt to string for Prisma Decimal
          await this.storeSingleTransaction(tx, "Swap");
        }
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }

  private determineTransactionType(tx: any): TransactionType {
    if (tx.Swap) return "Swap";
    if (tx.AddLiquidity) return "AddLiquidity";
    if (tx.RemoveLiquidity) return "RemoveLiquidity";
    if (tx.AddPool) return "AddPool";
    throw new Error("Unknown transaction type");
  }

  private async storeSingleTransaction(tx: any, type: TransactionType) {
    const data = tx[type]; // Get the specific transaction data based on type
    const convertedData = convertBigIntsToStrings(data);
    
    await this.prisma.transaction.create({
      data: {
        txId: convertedData.tx_id,
        type,
        poolId: null, // We'll need to add pool lookup logic later
        timestamp: new Date(Number(convertedData.ts) / 1_000_000), // Convert nanoseconds to milliseconds
      },
    });
  }

  async getTransactions(limit: number = 10, offset: number = 0) {
    try {
      // Get total count for pagination
      const total = await this.prisma.transaction.count();
      
      // Get transactions with pagination and convert txId to number for correct sorting
      const transactions = await this.prisma.transaction.findMany({
        take: Math.min(limit, 1000), // Cap at 1000 to prevent overload
        skip: offset,
        orderBy: {
          id: 'desc'
        }
      });


      return {
        total,
        transactions
      };
    } catch (error) {
      console.error("Error getting transactions:", error);
      throw error;
    }
  }

  async getTransactionById(txId: string) {
    try {
      return await this.prisma.transaction.findUnique({
        where: { txId },
      });
    } catch (error) {
      console.error("Error getting transaction:", error);
      throw error;
    }
  }
}
