import { isNotNull, sql } from 'drizzle-orm'
import { linkMySignup, markSignup } from './accounts'
import { db } from './db/client'
import { accounts } from './db/schema'
import { addSignup, readSignups, removeSignup } from './registrations'
import type { ISignup } from './registrations'

export interface IDummyUser {
  name: string
  level: string | null
  chessCom: string | null
  timeControl: string | null
  claimed: boolean
  mine: boolean
}

interface IClaim {
  clerkUserId: string
  signupName: string
}

interface ILooseRecord {
  [key: string]: unknown
}

export type DummyResult =
  | { ok: true; dummy: IDummyUser }
  | { ok: false; status: 400 | 409; error: string }

export type DeleteDummyResult =
  | { ok: true; name: string }
  | { ok: false; status: 400; error: string }

export async function listDummies(clerkUserId: string): Promise<IDummyUser[]> {
  await linkMySignup(clerkUserId)
  const [rows, claims] = await Promise.all([readSignups(), listClaims()])
  return rows.map((row) => toDummy(row, ownerOf(claims, row.name), clerkUserId))
}

export async function addDummy(body: unknown): Promise<DummyResult> {
  const parsed = parseAdd(body)
  if (!parsed) {
    return { ok: false, status: 400, error: 'Name is required.' }
  }

  const added = await addSignup(parsed.name)
  if (!added.ok) {
    return { ok: false, status: 409, error: added.error }
  }

  return {
    ok: true,
    dummy: toDummy(added.signup, null, ''),
  }
}

export async function claimDummy(clerkUserId: string, body: unknown): Promise<DummyResult> {
  const name = readName(asRecord(body)?.name)
  if (!name) {
    return { ok: false, status: 400, error: 'Choose a player.' }
  }

  const rows = await readSignups()
  const row = rows.find((item) => item.name.toLowerCase() === name.toLowerCase())
  if (!row) {
    return { ok: false, status: 400, error: 'That player is not on the signup sheet.' }
  }

  const marked = await markSignup(clerkUserId, row.name)
  if (!marked.ok) {
    return marked
  }

  return { ok: true, dummy: toDummy(row, clerkUserId, clerkUserId) }
}

export async function deleteDummy(body: unknown): Promise<DeleteDummyResult> {
  const name = readName(asRecord(body)?.name)
  if (!name) {
    return { ok: false, status: 400, error: 'Choose a player.' }
  }

  const removed = await removeSignup(name)
  if (!removed.ok) {
    return { ok: false, status: 400, error: removed.error }
  }

  await db
    .update(accounts)
    .set({ signupName: null })
    .where(sql`lower(${accounts.signupName}) = ${name.toLowerCase()}`)

  return { ok: true, name }
}

async function listClaims(): Promise<IClaim[]> {
  const rows = await db
    .select({ clerkUserId: accounts.clerkUserId, signupName: accounts.signupName })
    .from(accounts)
    .where(isNotNull(accounts.signupName))

  return rows.flatMap((row) => (row.signupName ? [{ clerkUserId: row.clerkUserId, signupName: row.signupName }] : []))
}

function ownerOf(claims: IClaim[], name: string): string | null {
  const claim = claims.find((item) => item.signupName.toLowerCase() === name.toLowerCase())
  return claim?.clerkUserId ?? null
}

function toDummy(row: ISignup, owner: string | null, clerkUserId: string): IDummyUser {
  return {
    name: row.name,
    level: row.level,
    chessCom: row.username,
    timeControl: row.timeControl,
    claimed: Boolean(owner),
    mine: owner === clerkUserId,
  }
}

function parseAdd(body: unknown): { name: string } | null {
  const record = asRecord(body)
  if (!record) {
    return null
  }
  const name = readName(record.name)
  if (!name) {
    return null
  }
  return { name }
}

function readName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const name = value.replace(/\s+/g, ' ').trim()
  return name || null
}

function asRecord(value: unknown): ILooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as ILooseRecord
}
