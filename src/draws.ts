import { desc } from 'drizzle-orm'
import { db } from './db/client'
import { draws } from './db/schema'

interface IPairing {
  white: string
  black: string | null
}

interface IDrawResult {
  beginner: IPairing[]
  advanced: IPairing[]
}

export interface ISavedDraw {
  id: number
  createdAt: string
  result: IDrawResult
}

interface IDrawRow {
  id: number
  createdAt: Date
  result: unknown
}

export type SaveDrawResult =
  | { ok: true; draw: ISavedDraw }
  | { ok: false; status: 400; error: string }

export async function listDraws(): Promise<ISavedDraw[]> {
  const rows = await db.select().from(draws).orderBy(desc(draws.createdAt))
  return rows.flatMap((row) => {
    const draw = toSavedDraw(row)
    return draw ? [draw] : []
  })
}

export async function saveDraw(body: unknown): Promise<SaveDrawResult> {
  const result = parseDrawResult(body)
  if (!result) {
    return { ok: false, status: 400, error: 'Send beginner and advanced pairs.' }
  }

  const [row] = await db.insert(draws).values({ result }).returning()
  if (!row) {
    return { ok: false, status: 400, error: 'Could not save this draw.' }
  }

  const draw = toSavedDraw(row)
  if (!draw) {
    return { ok: false, status: 400, error: 'Could not save this draw.' }
  }
  return { ok: true, draw }
}

function parseDrawResult(body: unknown): IDrawResult | null {
  if (!isRecord(body)) {
    return null
  }
  const beginner = parsePairs(body.beginner)
  const advanced = parsePairs(body.advanced)
  if (!beginner || !advanced) {
    return null
  }
  return { beginner, advanced }
}

function parsePairs(value: unknown): IPairing[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const pairs: IPairing[] = []
  for (const item of value) {
    const pair = parsePair(item)
    if (!pair) {
      return null
    }
    pairs.push(pair)
  }
  return pairs
}

function parsePair(value: unknown): IPairing | null {
  if (!isRecord(value) || typeof value.white !== 'string' || !value.white.trim()) {
    return null
  }
  if (value.black !== null && typeof value.black !== 'string') {
    return null
  }
  return {
    white: value.white.trim(),
    black: typeof value.black === 'string' ? value.black.trim() || null : null,
  }
}

function toSavedDraw(row: IDrawRow): ISavedDraw | null {
  const result = parseDrawResult(row.result)
  if (!result) {
    return null
  }
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    result,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
