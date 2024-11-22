import fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { Actor } from '@dfinity/agent';
import { CanisterService } from './services/canisterService.js';
import { registerRoutes } from './routes/index.js';
import cron from 'node-cron';

const server = fastify();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Initialize services
const actor = {} as Actor; // Replace with actual actor initialization
const canisterService = new CanisterService(actor, prisma);

// Schedule periodic tasks
cron.schedule('*/1 * * * *', async () => {
  try {
    console.log('Running scheduled tasks...');
    await canisterService.fetchAndStoreTransactions();
    await canisterService.fetchAndStoreTokens();
    await canisterService.fetchAndStorePools();
    console.log('Scheduled tasks completed successfully');
  } catch (error) {
    console.error('Error in scheduled tasks:', error);
  }
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const start = async () => {
  try {
    // Register plugins
    await server.register(cors, {
      origin: true // Allow all origins in development
    });

    // Register routes
    await server.register(registerRoutes, { canisterService });

    // Start listening
    await server.listen({ port: Number(port), host: '0.0.0.0' });
    console.log(`Server is running on http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
