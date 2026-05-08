import { PrismaClient } from './generated/prisma'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

// Required for Neon serverless driver in Node.js environments
if (!globalThis.WebSocket) {
  neonConfig.webSocketConstructor = ws
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Ensures the connection string has the recommended connect_timeout for Neon
 * and removes any incompatible parameters.
 */
function prepareConnectionString(url: string) {
  try {
    const u = new URL(url)
    
    // Neon recommends 15s timeout to allow for "scale from zero" cold starts
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '15')
    }
    
    // Remove channel_binding which can cause issues with some drivers/proxies
    u.searchParams.delete('channel_binding')
    
    return u.toString()
  } catch (e) {
    return url
  }
}

function makePrisma() {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL
  
  if (!url) {
    throw new Error('Prisma: DATABASE_URL or DIRECT_URL environment variable is required')
  }

  const connectionString = prepareConnectionString(url)
  
  // Use Neon serverless driver with Prisma adapter
  // In Prisma 7+, PrismaNeon constructor expects PoolConfig, not a Pool instance
  const adapter = new PrismaNeon({ connectionString })
  
  return new PrismaClient({ 
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  })
}

export const prisma = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
  