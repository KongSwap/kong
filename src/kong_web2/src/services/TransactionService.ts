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
        const transactions = result.Ok;

        for (const tx of transactions) {
          console.log("Processing transaction:", tx);
          if (!tx.Swap) continue; // Skip non-swap transactions for now
          
          const txId = tx.Swap.tx_id.toString(); // Convert BigInt to string for Prisma Decimal
          const existingTx = await this.prisma.transaction.findUnique({
            where: { txId },
          });

          if (existingTx) {
            console.log(`Skipping existing transaction with tx_id: ${txId}`);
            continue;
          }

          const txType = this.determineTransactionType(tx);
          await this.storeSingleTransaction(tx, txType);
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
      
      // Get transactions with pagination
      const transactions = await this.prisma.transaction.findMany({
        take: Math.min(limit, 1000), // Cap at 1000 to prevent overload
        skip: offset,
        orderBy: {
          timestamp: 'desc'
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
