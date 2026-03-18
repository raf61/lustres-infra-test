import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function withConnectionLimit(databaseUrl: string, connectionLimit: string) {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.set('connection_limit', connectionLimit)
    url.searchParams.set('pool_timeout', '20') // Tempo máximo de espera por conexão no pool
    return url.toString()
  } catch {
    // Se for um formato não suportado por URL(), não mexe.
    return databaseUrl
  }
}

const databaseUrl = process.env.DATABASE_URL
const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT
const datasourceUrl =
  databaseUrl && connectionLimit ? withConnectionLimit(databaseUrl, connectionLimit) : databaseUrl

// 1. Criar o cliente base (sem extensões ainda) para configurar logs
const basePrisma = new PrismaClient({
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  log: process.env.NODE_ENV === 'development' ? [{ emit: 'event', level: 'query' }, 'error'] : ['error']
})

// 2. Logs de performance em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  (basePrisma as any).$on('query', (e: any) => {
    if (e.duration > 100) { // Loga apenas queries lentas (>100ms)
      console.log(`⏱️ Prisma Query (${e.duration}ms): ${e.query.substring(0, 150)}...`)
    }
  })
}

/**
 * 3. CAMADA DE RESILIÊNCIA (RETRY LOGIC)
 * Se o Prisma falhar por "Connection Limit" ou "Pool Timeout", ele não deve desistir.
 * Esta extensão captura erros de pool e tenta novamente com um pequeno delay.
 */
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            return await query(args);
          } catch (error: any) {
            // Códigos de erro de conexão e pool (P2024, P2028, etc)
            const isConnectionError =
              error.code === 'P2024' || // Connection pool timeout
              error.code === 'P2028' || // Transaction session expired
              error.message?.includes('connection') ||
              error.message?.includes('Pool');

            if (isConnectionError && retries < maxRetries - 1) {
              retries++;
              const delay = Math.pow(2, retries) * 200; // 400ms, 800ms...
              console.warn(`[Prisma Resilience] ⚠️ Erro de conexão detectado (${error.code || 'POOL_LIMIT'}). Tentativa ${retries}/${maxRetries}. Retentando em ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }

            // Se não for erro de conexão ou excedeu retentativas, lança o erro
            throw error;
          }
        }
      }
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;