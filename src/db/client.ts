import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import * as schema from './schema'

function postgresOptions(databaseUrl: string, max: number) {
  const host = new URL(databaseUrl).hostname
  const local = host === 'localhost' || host === '127.0.0.1'

  return {
    max,
    connect_timeout: 10,
    ...(local ? {} : { ssl: 'require' as const }),
  }
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a Postgres connection string.')
}

const migrationClient = postgres(databaseUrl, postgresOptions(databaseUrl, 1))
await migrate(drizzle(migrationClient), {
  migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
})
await migrationClient.end()

const queryClient = postgres(databaseUrl, postgresOptions(databaseUrl, 10))
export const db = drizzle(queryClient, { schema })
