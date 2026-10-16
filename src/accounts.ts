import { eq, sql } from 'drizzle-orm'
import { db } from './db/client'
import { accounts } from './db/schema'

export const INITIAL_ELO = 1200

export interface IAccount {
  id: number
  name: string
  surname: string
  chessCom: string | null
  elo: number
}

interface ILooseRecord {
  [key: string]: unknown
}

interface ICreateAccount {
  name: string
  surname: string
  chessCom: string | null
}

interface IAccountRow {
  id: number
  clerkUserId: string
  name: string
  surname: string
  chessCom: string | null
  elo: number
}

export type CreateAccountResult =
  | { ok: true; account: IAccount }
  | { ok: false; status: 400 | 409; error: string }

export async function listAccounts(): Promise<IAccount[]> {
  const rows = await db
    .select()
    .from(accounts)
    .orderBy(sql`lower(${accounts.surname})`, sql`lower(${accounts.name})`)

  return rows.map(toAccount)
}

export async function getMyAccount(clerkUserId: string): Promise<IAccount | null> {
  const [row] = await db.select().from(accounts).where(eq(accounts.clerkUserId, clerkUserId)).limit(1)
  return row ? toAccount(row) : null
}

export async function saveMyAccount(clerkUserId: string, body: unknown): Promise<CreateAccountResult> {
  const parsed = parseCreateAccount(body)
  if (!parsed.ok) {
    return parsed
  }

  const current = await getMyAccount(clerkUserId)

  try {
    if (current) {
      const [row] = await db
        .update(accounts)
        .set({
          name: parsed.account.name,
          surname: parsed.account.surname,
          chessCom: parsed.account.chessCom,
        })
        .where(eq(accounts.clerkUserId, clerkUserId))
        .returning()

      if (!row) {
        return { ok: false, status: 400, error: 'Could not save this account.' }
      }
      return { ok: true, account: toAccount(row) }
    }

    const [row] = await db
      .insert(accounts)
      .values({
        clerkUserId,
        name: parsed.account.name,
        surname: parsed.account.surname,
        chessCom: parsed.account.chessCom,
        elo: INITIAL_ELO,
      })
      .returning()

    if (!row) {
      return { ok: false, status: 400, error: 'Could not save this account.' }
    }
    return { ok: true, account: toAccount(row) }
  } catch (error) {
    if (isUniqueChessCom(error)) {
      return { ok: false, status: 409, error: 'That Chess.com account is already saved.' }
    }
    throw error
  }
}

function parseCreateAccount(
  body: unknown,
): { ok: true; account: ICreateAccount } | { ok: false; status: 400; error: string } {
  const record = asRecord(body)
  if (!record) {
    return { ok: false, status: 400, error: 'Send name and surname.' }
  }

  const name = clean(record.name)
  const surname = clean(record.surname)
  if (!name || !surname) {
    return { ok: false, status: 400, error: 'Name and surname are required.' }
  }

  const chessCom = readChessCom(record.chessCom)
  if (chessCom === undefined) {
    return { ok: false, status: 400, error: 'Chess.com account must be a username.' }
  }

  return { ok: true, account: { name, surname, chessCom } }
}

function readChessCom(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const username = value.trim().replace(/^@/, '')
  return username || null
}

function toAccount(row: IAccountRow): IAccount {
  return {
    id: row.id,
    name: row.name,
    surname: row.surname,
    chessCom: row.chessCom,
    elo: row.elo,
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function asRecord(value: unknown): ILooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as ILooseRecord
}

function isUniqueChessCom(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current === 'object' && 'code' in current && current.code === '23505') {
      return true
    }
    current = typeof current === 'object' && 'cause' in current ? current.cause : null
  }
  return false
}
