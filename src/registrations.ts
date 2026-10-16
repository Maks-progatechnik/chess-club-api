import { sql } from 'drizzle-orm'
import { db } from './db/client'
import { signups } from './db/schema'

export interface ISignup {
  name: string
  respondent: string
  level: string
  username: string | null
  timeControl: string | null
}

export type AddSignupResult = { ok: true; signup: ISignup } | { ok: false; error: string }
export type RemoveSignupResult = { ok: true } | { ok: false; error: string }

interface ILooseRecord {
  [key: string]: unknown
}

export async function readSignups(): Promise<ISignup[]> {
  const rows = await db.select().from(signups).orderBy(signups.id)
  return rows.map(toSignup)
}

export async function addSignup(name: string, level: string): Promise<AddSignupResult> {
  try {
    const [row] = await db
      .insert(signups)
      .values({
        name,
        respondent: name,
        level: levelLabel(level),
        username: null,
        timeControl: null,
      })
      .returning()

    if (!row) {
      return { ok: false, error: 'Could not add this player.' }
    }

    return { ok: true, signup: toSignup(row) }
  } catch (error) {
    if (isSignupNameTaken(error)) {
      return { ok: false, error: `${name} is already on the signup sheet.` }
    }
    throw error
  }
}

export async function removeSignup(name: string): Promise<RemoveSignupResult> {
  const deleted = await db
    .delete(signups)
    .where(sql`lower(${signups.name}) = ${name.toLowerCase()}`)
    .returning({ id: signups.id })

  if (!deleted.length) {
    return { ok: false, error: 'That player is not on the signup sheet.' }
  }

  return { ok: true }
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

function levelLabel(level: string): string {
  return level.trim().toLowerCase() === 'advanced' ? 'Advanced' : 'Beginner'
}

function isSignupNameTaken(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false
    }
    const record = current as ILooseRecord
    if (record.code === '23505') {
      return true
    }
    current = record.cause
  }
  return false
}
