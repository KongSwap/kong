import { FastifyPluginAsync } from "fastify";
import { CanisterService } from "../services/canisterService";

interface PoolRouteOptions {
  canisterService: CanisterService;
}

const poolRoutes: FastifyPluginAsync<PoolRouteOptions> = async (
  fastify,
  opts
) => {
  // Fetch and store pools
  fastify.post('/sync', async (request, reply) => {
    try {
      await opts.canisterService.fetchAndStorePools();
      return { message: 'Pools synced successfully' };
    } catch (error) {
      console.error('Error syncing pools:', error);
      return reply.status(500).send({ error: 'Failed to sync pools' });
    }
  });

  // Get all pools
  fastify.get('/', async (request, reply) => {
    try {
      const pools = await opts.canisterService.getPools();
      return pools;
    } catch (error) {
      console.error('Error fetching pools:', error);
      return reply.status(500).send({ error: 'Failed to fetch pools' });
    }
  });

  // Get pool by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const poolId = parseInt(id);
      const pool = await opts.canisterService.getPoolById(poolId);
      if (!pool) {
        return reply.status(404).send({ error: 'Pool not found' });
      }
      return pool;
    } catch (error) {
      console.error('Error fetching pool:', error);
      return reply.status(500).send({ error: 'Failed to fetch pool' });
    }
  });
};

export default poolRoutes;
