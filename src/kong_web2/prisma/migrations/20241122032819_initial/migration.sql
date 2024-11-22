-- CreateTable
CREATE TABLE "tokens" (
    "id" SERIAL NOT NULL,
    "token_id" INTEGER NOT NULL,
    "pool_symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "on_kong" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "pool_id_of" INTEGER,
    "address" TEXT,
    "decimals" INTEGER,
    "fee" BIGINT,
    "total_supply" BIGINT,
    "canister_id" TEXT,
    "icrc1" BOOLEAN,
    "icrc2" BOOLEAN,
    "icrc3" BOOLEAN,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" SERIAL NOT NULL,
    "pool_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "chain_0" TEXT NOT NULL,
    "symbol_0" TEXT NOT NULL,
    "address_0" TEXT NOT NULL,
    "balance_0" BIGINT NOT NULL,
    "lp_fee_0" BIGINT NOT NULL,
    "chain_1" TEXT NOT NULL,
    "symbol_1" TEXT NOT NULL,
    "address_1" TEXT NOT NULL,
    "balance_1" BIGINT NOT NULL,
    "lp_fee_1" BIGINT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "lp_fee_bps" INTEGER NOT NULL,
    "rolling_24h_volume" BIGINT NOT NULL,
    "rolling_24h_lp_fee" BIGINT NOT NULL,
    "rolling_24h_num_swaps" INTEGER NOT NULL,
    "rolling_24h_apy" DOUBLE PRECISION NOT NULL,
    "lp_token_symbol" TEXT NOT NULL,
    "lp_token_supply" BIGINT NOT NULL,
    "total_volume" BIGINT NOT NULL,
    "total_lp_fee" BIGINT NOT NULL,
    "on_kong" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "pool_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount0" BIGINT,
    "amount1" BIGINT,
    "shares" BIGINT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_stats" (
    "id" SERIAL NOT NULL,
    "total_tvl" BIGINT NOT NULL,
    "total_24h_volume" BIGINT NOT NULL,
    "total_24h_lp_fee" BIGINT NOT NULL,
    "total_24h_num_swaps" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pools_pool_id_key" ON "pools"("pool_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("pool_id") ON DELETE SET NULL ON UPDATE CASCADE;
