import fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { Actor } from '@dfinity/agent';
import { CanisterService } from './services/canisterService.js';
import { registerRoutes } from './routes/index.js';

const server = fastify();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Initialize services
const actor = {} as Actor; // Replace with actual actor initialization
const canisterService = new CanisterService(actor, prisma);

// Run tasks function
const runTasks = async () => {
  try {
    console.log('Running scheduled tasks...');
    await Promise.all([
      canisterService.fetchAndStoreTransactions(),
      canisterService.fetchAndStoreTokens(),
      canisterService.fetchAndStorePools()
    ]);
    console.log('Scheduled tasks completed successfully');
  } catch (error) {
    console.error('Error in scheduled tasks:', error);
  }
};

// Run immediately on startup
runTasks();

// Then run every 30 seconds
setInterval(runTasks, 30 * 1000);

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Configure CORS
server.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// Register routes
server.register(registerRoutes, { canisterService });

// Start server
const start = async () => {
  try {
    await server.listen({ port: Number(port), host: '0.0.0.0' });
    console.log(`Server is running on http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
