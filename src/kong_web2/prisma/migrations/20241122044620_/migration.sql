/*
  Warnings:

  - Added the required column `tx_id` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "tx_id" DECIMAL(65,0) NOT NULL;
