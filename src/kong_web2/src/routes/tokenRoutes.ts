import { FastifyInstance } from 'fastify';
import { CanisterService } from '../services/canisterService';

export async function tokenRoutes(fastify: FastifyInstance, opts: { canisterService: CanisterService }) {
  // Fetch and store tokens
  fastify.post('/sync', async (request, reply) => {
    try {
      await opts.canisterService.fetchAndStoreTokens();
      return { message: 'Tokens synced successfully' };
    } catch (error) {
      console.error('Error syncing tokens:', error);
      return reply.status(500).send({ error: 'Failed to sync tokens' });
    }
  });

  // Get all tokens
  fastify.get('/', async (request, reply) => {
    try {
      const tokens = await opts.canisterService.getTokens();
      return tokens;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return reply.status(500).send({ error: 'Failed to fetch tokens' });
    }
  });

  // Get token by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const tokenId = parseInt(id);
      const token = await opts.canisterService.getTokenById(tokenId);
      if (!token) {
        return reply.status(404).send({ error: 'Token not found' });
      }
      return token;
    } catch (error) {
      console.error('Error fetching token:', error);
      return reply.status(500).send({ error: 'Failed to fetch token' });
    }
  });
}
