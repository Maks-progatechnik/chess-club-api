import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import * as schema from './schema'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a Postgres connection string.')
}

const migrationClient = postgres(databaseUrl, { max: 1 })
await migrate(drizzle(migrationClient), {
  migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
})
await migrationClient.end()

const queryClient = postgres(databaseUrl)
export const db = drizzle(queryClient, { schema })
