import { lookupChessAccounts, wrongAccountMessage } from './chesscom'
import type { ChessLookup, IChessAccount } from './chesscom'

export const ADVANCED_RATING = 800

export interface IRegistration {
  name: string
  level: string
  username: string | null
  timeControl: string | null
}

export type RatingMode = 'rapid' | 'blitz' | 'bullet'
export type PlayerLevel = 'beginner' | 'advanced'

export interface IAutumnPlayer {
  name: string
  username: string | null
  timeControl: string | null
  profileName: string | null
  profileUrl: string | null
  rating: number | null
  ratingMode: RatingMode | null
  rapid: number | null
  blitz: number | null
  bullet: number | null
  games: number | null
  preference: PlayerLevel
  unavailable: boolean
  flag: string | null
}

export interface IAutumnBoard {
  title: string
  advancedAt: number
  advanced: IAutumnPlayer[]
  beginner: IAutumnPlayer[]
  flagged: IAutumnPlayer[]
}

interface IBestRating {
  rating: number
  mode: RatingMode
}

export async function readAutumnRegistrations(): Promise<IRegistration[]> {
  const file = Bun.file(new URL('./data/autumn-2026.csv', import.meta.url))
  const rows = parseCsv(await file.text())
  const [header, ...records] = rows
  if (!header) {
    return []
  }

  const columns = Object.fromEntries(header.map((name, index) => [name.trim(), index]))

  return records.map((record) => ({
    name: field(record, columns, 'Participant'),
    level: field(record, columns, 'Chess level'),
    username: optionalField(record, columns, 'Chess.com username'),
    timeControl: optionalField(record, columns, 'Preferred time control'),
  }))
}

export async function readAutumnBoard(): Promise<IAutumnBoard> {
  const registrations = await readAutumnRegistrations()
  const usernames = registrations.flatMap((registration) =>
    registration.username ? [registration.username] : [],
  )
  const accounts = await lookupChessAccounts(usernames)
  const advanced: IAutumnPlayer[] = []
  const beginner: IAutumnPlayer[] = []
  const flagged: IAutumnPlayer[] = []

  for (const registration of registrations) {
    const player = toPlayer(registration, accounts)
    if (player.flag) {
      flagged.push(player)
    } else if (player.rating !== null && player.rating >= ADVANCED_RATING) {
      advanced.push(player)
    } else {
      beginner.push(player)
    }
  }

  advanced.sort(byStrength)
  beginner.sort(byStrength)
  flagged.sort((left, right) => left.name.localeCompare(right.name))

  return {
    title: 'Autumn 2026',
    advancedAt: ADVANCED_RATING,
    advanced,
    beginner,
    flagged,
  }
}

function toPlayer(registration: IRegistration, accounts: Map<string, ChessLookup>): IAutumnPlayer {
  const username = registration.username
  const lookup = username ? accounts.get(username.toLowerCase()) : undefined
  const account = lookup?.status === 'ok' ? lookup.account : null
  const best = account ? bestRating(account) : null
  const missingUsername = !username
  const missingAccount = lookup?.status === 'missing'
  const mismatch = account
    ? wrongAccountMessage(registration.name, account.username, account.profileName)
    : null

  let flag: string | null = null
  if (missingUsername) {
    flag = 'Wrong account. No Chess.com username was given.'
  } else if (missingAccount) {
    flag = `Wrong account. Chess.com has no user named ${username}.`
  } else if (mismatch) {
    flag = mismatch
  }

  return {
    name: registration.name,
    username,
    timeControl: registration.timeControl,
    profileName: account?.profileName ?? null,
    profileUrl: account?.url ?? (username ? `https://www.chess.com/member/${encodeURIComponent(username)}` : null),
    rating: flag ? null : (best?.rating ?? null),
    ratingMode: flag ? null : (best?.mode ?? null),
    rapid: flag ? null : (account?.rapid ?? null),
    blitz: flag ? null : (account?.blitz ?? null),
    bullet: flag ? null : (account?.bullet ?? null),
    games: account?.games ?? null,
    preference: readPreference(registration.level),
    unavailable: !flag && lookup?.status === 'unavailable',
    flag,
  }
}

function readPreference(level: string): PlayerLevel {
  return level.trim().toLowerCase() === 'advanced' ? 'advanced' : 'beginner'
}

function bestRating(account: IChessAccount): IBestRating | null {
  const modes: Array<{ mode: RatingMode; rating: number | null }> = [
    { mode: 'rapid', rating: account.rapid },
    { mode: 'blitz', rating: account.blitz },
    { mode: 'bullet', rating: account.bullet },
  ]
  let best: IBestRating | null = null

  for (const entry of modes) {
    if (entry.rating === null) {
      continue
    }
    if (!best || entry.rating > best.rating) {
      best = { rating: entry.rating, mode: entry.mode }
    }
  }

  return best
}

function byStrength(left: IAutumnPlayer, right: IAutumnPlayer): number {
  const ratingGap = (right.rating ?? -1) - (left.rating ?? -1)
  if (ratingGap !== 0) {
    return ratingGap
  }
  return left.name.localeCompare(right.name)
}

function field(record: string[], columns: Record<string, number>, name: string): string {
  return clean(record[columns[name] ?? -1] ?? '')
}

function optionalField(
  record: string[],
  columns: Record<string, number>,
  name: string,
): string | null {
  const value = field(record, columns, name)
  return value || null
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(cell)
      if (row.some((value) => value.trim())) {
        rows.push(row)
      }
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    if (row.some((value) => value.trim())) {
      rows.push(row)
    }
  }

  return rows
}
