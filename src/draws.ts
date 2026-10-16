import { desc, eq } from 'drizzle-orm'
import { chessGameUrl } from './chess-game'
import { db } from './db/client'
import { draws } from './db/schema'

interface IPairing {
  white: string
  black: string | null
  games: string[]
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
  | { ok: false; status: 400 | 409; error: string }

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

interface IGameRequest {
  group: 'beginner' | 'advanced'
  white: string
  black: string
  url: string
}

export async function addDrawGame(drawId: number, body: unknown): Promise<SaveDrawResult> {
  const request = parseGameRequest(body)
  if (request === 'invalid-url') {
    return { ok: false, status: 400, error: 'Paste a Chess.com game link.' }
  }
  if (!request) {
    return { ok: false, status: 400, error: 'Send the match and a Chess.com game link.' }
  }

  const [row] = await db.select().from(draws).where(eq(draws.id, drawId)).limit(1)
  if (!row) {
    return { ok: false, status: 400, error: 'That draw was not found.' }
  }

  const result = parseDrawResult(row.result)
  if (!result) {
    return { ok: false, status: 400, error: 'That draw was not found.' }
  }

  const pairs = request.group === 'beginner' ? result.beginner : result.advanced
  const pair = pairs.find((item) => samePlayer(item.white, request.white) && samePlayer(item.black, request.black))
  if (!pair?.black) {
    return { ok: false, status: 400, error: 'That match is not in this draw.' }
  }
  if (pair.games.includes(request.url)) {
    return { ok: false, status: 409, error: 'That game is already on this match.' }
  }

  pair.games.push(request.url)
  const [updated] = await db.update(draws).set({ result }).where(eq(draws.id, drawId)).returning()
  if (!updated) {
    return { ok: false, status: 400, error: 'Could not save this game.' }
  }

  const draw = toSavedDraw(updated)
  if (!draw) {
    return { ok: false, status: 400, error: 'Could not save this game.' }
  }
  return { ok: true, draw }
}

function parseGameRequest(body: unknown): IGameRequest | 'invalid-url' | null {
  if (!isRecord(body) || (body.group !== 'beginner' && body.group !== 'advanced')) {
    return null
  }
  if (typeof body.white !== 'string' || typeof body.black !== 'string' || typeof body.url !== 'string') {
    return null
  }
  const white = body.white.trim()
  const black = body.black.trim()
  if (!white || !black) {
    return null
  }
  const url = chessGameUrl(body.url)
  if (!url) {
    return 'invalid-url'
  }
  return { group: body.group, white, black, url }
}

function samePlayer(left: string | null, right: string | null): boolean {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase()
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
  const games = parseGames(value.games)
  if (!games) {
    return null
  }
  return {
    white: value.white.trim(),
    black: typeof value.black === 'string' ? value.black.trim() || null : null,
    games,
  }
}

function parseGames(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    return null
  }
  const games: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      return null
    }
    const url = chessGameUrl(item)
    if (!url) {
      return null
    }
    games.push(url)
  }
  return games
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
