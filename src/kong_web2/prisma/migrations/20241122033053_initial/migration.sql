/*
  Warnings:

  - A unique constraint covering the columns `[token_id,type]` on the table `tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_id_type_key" ON "tokens"("token_id", "type");
