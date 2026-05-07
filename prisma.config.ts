import { config } from 'dotenv'
// Load .env.local first (Next.js convention), then fall back to .env
config({ path: '.env.local' })
config()
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // DATABASE_URL: pooled connection string (used at runtime via connection pooler)
    // DIRECT_URL:   direct connection string (used by Prisma Migrate — bypasses pooler)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
})
