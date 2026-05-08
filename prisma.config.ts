import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // DIRECT_URL is required for migrations to bypass the Neon pooler.
    // Fallback to DATABASE_URL if DIRECT_URL is not provided (e.g. local dev).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
