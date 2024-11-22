import { FastifyInstance } from 'fastify';
import { CanisterService } from '../services/canisterService';

export async function transactionRoutes(fastify: FastifyInstance, opts: { canisterService: CanisterService }) {
  // Fetch and store transactions
  fastify.post('/sync', async (request, reply) => {
    try {
      await opts.canisterService.fetchAndStoreTransactions();
      return { message: 'Transactions synced successfully' };
    } catch (error) {
      console.error('Error syncing transactions:', error);
      return reply.status(500).send({ error: 'Failed to sync transactions' });
    }
  });

  // Get transactions with pagination
  fastify.get('/', async (request, reply) => {
    const { limit = '10', offset = '0' } = request.query as { limit?: string, offset?: string };
    try {
      const transactions = await opts.canisterService.getTransactions(
        parseInt(limit),
        parseInt(offset)
      );
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return reply.status(500).send({ error: 'Failed to fetch transactions' });
    }
  });

  // Get transaction by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const transaction = await opts.canisterService.getTransactionById(id);
      if (!transaction) {
        return reply.status(404).send({ error: 'Transaction not found' });
      }
      return transaction;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return reply.status(500).send({ error: 'Failed to fetch transaction' });
    }
  });
}
