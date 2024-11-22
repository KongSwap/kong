import { FastifyInstance } from 'fastify';
import { CanisterService } from '../services/canisterService.js';
import { tokenRoutes } from './tokenRoutes.js';
import poolRoutes from './poolRoutes.js';
import { transactionRoutes } from './transactionRoutes.js';

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
