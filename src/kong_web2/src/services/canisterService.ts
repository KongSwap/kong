import { Actor, HttpAgent } from "@dfinity/agent";
import { PrismaClient, Prisma } from "@prisma/client";
import cron from "node-cron";
import { canisterId, idlFactory } from "../idl/kong_backend";
import { TokenService } from "./TokenService";
import { PoolService } from "./PoolService";
import { TransactionService } from "./TransactionService";
import { ICanisterActor } from "./types";

const prisma = new PrismaClient();

type TransactionType = "AddPool" | "AddLiquidity" | "RemoveLiquidity" | "Swap";

export class CanisterService implements ICanisterActor {
  private agent: HttpAgent;
  public actor: any;
  private isRunning: boolean = false;
  private tokenService: TokenService;
  private poolService: PoolService;
  private transactionService: TransactionService;

  constructor(actor?: any, prismaClient?: PrismaClient) {
    this.agent = new HttpAgent();
    if (actor) {
      this.actor = actor;
    } else {
      this.actor = Actor.createActor(idlFactory as any, {
        agent: new HttpAgent(),
        canisterId: "2ipq2-uqaaa-aaaar-qailq-cai",
      });
    }
    const db = prismaClient || prisma;
    this.tokenService = new TokenService(this, db);
    this.poolService = new PoolService(this, db);
    this.transactionService = new TransactionService(this, db);
  }

  async fetchAndStoreTokens() {
    await this.tokenService.fetchAndStoreTokens();
  }

  async fetchAndStorePools() {
    await this.poolService.fetchAndStorePools();
  }

  async fetchAndStoreTransactions() {
    await this.transactionService.fetchAndStoreTransactions();
  }

  async getTransactions(limit?: number, offset?: number) {
    return this.transactionService.getTransactions(limit, offset);
  }

  async getTransactionById(txId: string) {
    return this.transactionService.getTransactionById(txId);
  }

  async getTokens() {
    return this.tokenService.getTokens();
  }

  async getTokenById(tokenId: number) {
    return this.tokenService.getTokenById(tokenId);
  }

  async getPools() {
    return this.poolService.getPools();
  }

  async getPoolById(poolId: number) {
    return this.poolService.getPoolById(poolId);
  }

  startCronJobs() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run every minute
    cron.schedule("* * * * *", async () => {
      console.log("Running cron job to fetch data...");
      await this.fetchAndStoreTokens();
      await this.fetchAndStorePools();
      await this.fetchAndStoreTransactions();
    });
  }

  stopCronJobs() {
    this.isRunning = false;
  }
}

export class CanisterServiceImpl implements ICanisterActor {
  private tokenService: TokenService;
  private poolService: PoolService;
  private transactionService: TransactionService;

  constructor(
    private readonly canisterActor: ICanisterActor,
    private readonly prisma: PrismaClient
  ) {
    this.tokenService = new TokenService(canisterActor, prisma);
    this.poolService = new PoolService(canisterActor, prisma);
    this.transactionService = new TransactionService(canisterActor, prisma);
  }

  get actor() {
    return this.canisterActor.actor;
  }

  async getTokens() {
    return this.tokenService.getTokens();
  }

  async getTokenById(tokenId: number) {
    return this.tokenService.getTokenById(tokenId);
  }

  async getPools() {
    return this.poolService.getPools();
  }

  async getPoolById(poolId: number) {
    return this.poolService.getPoolById(poolId);
  }

  async getTransactions(page: number, limit: number) {
    return this.transactionService.getTransactions(page, limit);
  }

  async getTransactionById(transactionId: string) {
    return this.transactionService.getTransactionById(transactionId);
  }

  async fetchAndStoreTransactions() {
    return this.transactionService.fetchAndStoreTransactions();
  }

  async fetchAndStoreTokens() {
    return this.tokenService.fetchAndStoreTokens();
  }

  async fetchAndStorePools() {
    return this.poolService.fetchAndStorePools();
  }
}
