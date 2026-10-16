import { count, sql } from 'drizzle-orm'
import { readAutumnRegistrations } from './autumn'
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

export async function createAccount(body: unknown): Promise<CreateAccountResult> {
  const parsed = parseCreateAccount(body)
  if (!parsed.ok) {
    return parsed
  }

  try {
    const [row] = await db
      .insert(accounts)
      .values({
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

export async function seedAccountsIfEmpty(): Promise<void> {
  const [row] = await db.select({ total: count() }).from(accounts)
  if (!row || row.total > 0) {
    return
  }

  const registrations = await readAutumnRegistrations()
  if (registrations.length === 0) {
    return
  }

  await db.insert(accounts).values(
    registrations.map((registration) => {
      const person = splitName(registration.name)
      return {
        name: person.name,
        surname: person.surname,
        chessCom: registration.username,
        elo: INITIAL_ELO,
      }
    }),
  )
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

function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const surname = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  const name = parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] ?? '')
  return { name, surname: surname || name }
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
