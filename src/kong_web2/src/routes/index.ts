import { FastifyInstance } from 'fastify';
import { CanisterService } from '../services/canisterService';
import { tokenRoutes } from './tokenRoutes';
import { poolRoutes } from './poolRoutes';
import { transactionRoutes } from './transactionRoutes';

export async function registerRoutes(fastify: FastifyInstance, opts: { canisterService: CanisterService }) {
  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Register resource-specific routes
  await fastify.register(tokenRoutes, {
    prefix: '/tokens',
    canisterService: opts.canisterService
  });

  await fastify.register(poolRoutes, {
    prefix: '/pools',
    canisterService: opts.canisterService
  });

  await fastify.register(transactionRoutes, {
    prefix: '/transactions',
    canisterService: opts.canisterService
  });
}
