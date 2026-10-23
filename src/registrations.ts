import { db } from './db/client'
import { signups } from './db/schema'

export interface ISignup {
  name: string
  respondent: string
  level: string | null
  username: string | null
  timeControl: string | null
}

export async function readSignups(): Promise<ISignup[]> {
  const rows = await db.select().from(signups).orderBy(signups.id)
  return rows.map(toSignup)
}

function toSignup(row: typeof signups.$inferSelect): ISignup {
  return {
    name: row.name,
    respondent: row.respondent,
    level: row.level,
    username: row.username,
    timeControl: row.timeControl,
  }
}
