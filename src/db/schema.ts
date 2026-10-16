import { sql } from 'drizzle-orm'
import { integer, pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core'

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    name: text('name').notNull(),
    surname: text('surname').notNull(),
    chessCom: text('chess_com'),
    elo: integer('elo').notNull().default(1200),
  },
  (table) => [uniqueIndex('accounts_chess_com').on(sql`lower(${table.chessCom})`)],
)
