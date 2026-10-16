import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from './db/client'
import { accounts } from './db/schema'
import { readSignups, type ISignup } from './registrations'

export const INITIAL_ELO = 1200

export interface IAccount {
  id: number
  name: string
  surname: string
  chessCom: string | null
  elo: number
  signupName: string | null
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
  signupName: string | null
}

export type CreateAccountResult =
  | { ok: true; account: IAccount }
  | { ok: false; status: 400 | 409; error: string }

export type MarkSignupResult = { ok: true } | { ok: false; status: 400 | 409; error: string }

export async function listAccounts(): Promise<IAccount[]> {
  const rows = await db
    .select()
    .from(accounts)
    .orderBy(sql`lower(${accounts.surname})`, sql`lower(${accounts.name})`)

  return rows.map(toAccount)
}

export async function getMyAccount(clerkUserId: string): Promise<IAccount | null> {
  await linkMySignup(clerkUserId)
  return findAccount(clerkUserId)
}

async function findAccount(clerkUserId: string): Promise<IAccount | null> {
  const [row] = await db.select().from(accounts).where(eq(accounts.clerkUserId, clerkUserId)).limit(1)
  return row ? toAccount(row) : null
}

export async function linkMySignup(clerkUserId: string): Promise<void> {
  const [current] = await db
    .select({
      name: accounts.name,
      surname: accounts.surname,
      chessCom: accounts.chessCom,
      signupName: accounts.signupName,
    })
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId))
    .limit(1)

  if (!current || current.signupName) {
    return
  }

  const [signups, claimed] = await Promise.all([
    readSignups(),
    db.select({ signupName: accounts.signupName }).from(accounts).where(isNotNull(accounts.signupName)),
  ])
  const taken = new Set(
    claimed.flatMap((row) => (row.signupName ? [row.signupName.toLowerCase()] : [])),
  )
  const match = matchSignup(current, signups, taken)
  if (!match) {
    return
  }

  try {
    await db
      .update(accounts)
      .set({ signupName: match })
      .where(and(eq(accounts.clerkUserId, clerkUserId), isNull(accounts.signupName)))
  } catch (error) {
    if (!constraintName(error)) {
      throw error
    }
  }
}

export async function saveMyAccount(clerkUserId: string, body: unknown): Promise<CreateAccountResult> {
  const parsed = parseCreateAccount(body)
  if (!parsed.ok) {
    return parsed
  }

  const current = await findAccount(clerkUserId)

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
    } else {
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
    }
  } catch (error) {
    if (isUniqueChessCom(error)) {
      return { ok: false, status: 409, error: 'That Chess.com account is already saved.' }
    }
    throw error
  }

  await linkMySignup(clerkUserId)
  const saved = await findAccount(clerkUserId)
  if (!saved) {
    return { ok: false, status: 400, error: 'Could not save this account.' }
  }
  return { ok: true, account: saved }
}

export async function markSignup(clerkUserId: string, signupName: string): Promise<MarkSignupResult> {
  const [current] = await db
    .select({ signupName: accounts.signupName })
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId))
    .limit(1)

  if (!current) {
    return { ok: false, status: 400, error: 'Save your account first.' }
  }

  if (current.signupName?.toLowerCase() === signupName.toLowerCase()) {
    return { ok: true }
  }

  if (current.signupName) {
    return { ok: false, status: 409, error: 'You already marked a different player.' }
  }

  try {
    const updated = await db
      .update(accounts)
      .set({ signupName })
      .where(eq(accounts.clerkUserId, clerkUserId))
      .returning({ id: accounts.id })

    if (!updated.length) {
      return { ok: false, status: 400, error: 'Save your account first.' }
    }
    return { ok: true }
  } catch (error) {
    if (constraintName(error)) {
      return { ok: false, status: 409, error: 'Someone already marked that player.' }
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
    signupName: row.signupName,
  }
}

interface ISignupMatch {
  name: string
  surname: string
  chessCom: string | null
}

function matchSignup(account: ISignupMatch, signups: ISignup[], taken: Set<string>): string | null {
  const chessCom = account.chessCom?.toLowerCase()
  if (chessCom) {
    const byUsername = signups.find((row) => row.username?.toLowerCase() === chessCom)
    if (byUsername) {
      return taken.has(byUsername.name.toLowerCase()) ? null : byUsername.name
    }
  }

  const fullName = `${account.name} ${account.surname}`.replace(/\s+/g, ' ').trim().toLowerCase()
  const byName = signups.find((row) => row.name.toLowerCase() === fullName)
  if (!byName || taken.has(byName.name.toLowerCase())) {
    return null
  }
  return byName.name
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
  const name = constraintName(error)
  return name !== null && name !== 'accounts_signup_name'
}

function constraintName(error: unknown): string | null {
  let current: unknown = error
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return null
    }
    const record = current as ILooseRecord
    if (record.code === '23505') {
      if (typeof record.constraint_name === 'string') {
        return record.constraint_name
      }
      if (typeof record.constraint === 'string') {
        return record.constraint
      }
      return 'unique'
    }
    current = record.cause
  }
  return null
}
