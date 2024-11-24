# Kong Web2

A Fastify API with Prisma and PostgreSQL.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up your PostgreSQL database and update the DATABASE_URL in `.env` if needed.

3. Initialize Prisma:
```bash
npx prisma generate
```

4. Run migrations (after adding models):
```bash
npx prisma migrate dev
```

## Development

Run the development server:
```bash
pnpm run dev
```

## Build

Build for production:
```bash
pnpm run build
```

Run in production:
```bash
pnpm start
```

## API Endpoints

- `GET /health` - Health check endpoint
