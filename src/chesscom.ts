const CHESS_COM = 'https://api.chess.com'
const USER_AGENT = 'ChessClubApp/1.0 (autumn registration)'
const CACHE_MS = 10 * 60 * 1000
const ERROR_CACHE_MS = 30 * 1000
const LOOKUP_LIMIT = 4

export interface IChessAccount {
  username: string
  profileName: string | null
  url: string | null
  rapid: number | null
  blitz: number | null
  bullet: number | null
  games: number
}

export type ChessLookup =
  | { status: 'ok'; account: IChessAccount }
  | { status: 'missing' }
  | { status: 'unavailable' }

interface ICacheEntry {
  at: number
  value: ChessLookup
}

interface IChessHttpResult {
  status: number
  body: unknown
}

interface ILooseRecord {
  [key: string]: unknown
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'yi',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  ы: 'y',
  э: 'e',
  ё: 'e',
  ъ: '',
}

const cache = new Map<string, ICacheEntry>()

export async function lookupChessAccounts(usernames: string[]): Promise<Map<string, ChessLookup>> {
  const wanted = [...new Set(usernames.map((username) => username.toLowerCase()))]
  const found = new Map<string, ChessLookup>()
  const pending: string[] = []
  const now = Date.now()

  for (const username of wanted) {
    const hit = cache.get(username)
    const fresh = hit !== undefined && now - hit.at < cacheLifetime(hit.value)
    if (hit && fresh) {
      found.set(username, hit.value)
    } else {
      pending.push(username)
    }
  }

  await runPool(pending, LOOKUP_LIMIT, async (username) => {
    const value = await lookupOne(username)
    cache.set(username, { at: Date.now(), value })
    found.set(username, value)
  })

  return found
}

export function wrongAccountMessage(
  participant: string,
  username: string,
  profileName: string | null,
): string | null {
  const profile = nameTokens(profileName ?? '')
  if (profile.length === 0) {
    return null
  }

  const person = nameTokens(participant)
  if (person.length === 0) {
    return null
  }

  const surname = person[person.length - 1] ?? ''
  const profileSurname = profile[profile.length - 1] ?? ''
  const bothHaveSurnames = person.length >= 2 && profile.length >= 2
  const matches = bothHaveSurnames
    ? tokensMatch(surname, profileSurname) || usernameHasToken(username, surname)
    : person.some((token) => profile.some((other) => tokensMatch(token, other)))

  if (matches) {
    return null
  }

  return `Wrong account. Chess.com calls this user ${profileName}.`
}

async function lookupOne(username: string): Promise<ChessLookup> {
  const [playerResponse, statsResponse] = await Promise.all([
    chessGet(`/pub/player/${encodeURIComponent(username)}`),
    chessGet(`/pub/player/${encodeURIComponent(username)}/stats`),
  ])

  if (playerResponse.status === 404) {
    return { status: 'missing' }
  }

  const player = asRecord(playerResponse.body)
  if (playerResponse.status !== 200 || !player) {
    return { status: 'unavailable' }
  }

  const stats = asRecord(statsResponse.body)
  return {
    status: 'ok',
    account: {
      username: readString(player.username) ?? username,
      profileName: readString(player.name),
      url: readString(player.url),
      rapid: readRating(stats?.chess_rapid),
      blitz: readRating(stats?.chess_blitz),
      bullet: readRating(stats?.chess_bullet),
      games:
        readGames(stats?.chess_rapid) + readGames(stats?.chess_blitz) + readGames(stats?.chess_bullet),
    },
  }
}

async function chessGet(path: string): Promise<IChessHttpResult> {
  try {
    const response = await fetch(`${CHESS_COM}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return { status: response.status, body: null }
    }

    return { status: response.status, body: await response.json() }
  } catch {
    return { status: 0, body: null }
  }
}

function cacheLifetime(value: ChessLookup): number {
  return value.status === 'unavailable' ? ERROR_CACHE_MS : CACHE_MS
}

function readRating(value: unknown): number | null {
  const block = asRecord(value)
  const last = asRecord(block?.last)
  const rating = last?.rating
  return typeof rating === 'number' ? rating : null
}

function readGames(value: unknown): number {
  const record = asRecord(asRecord(value)?.record)
  if (!record) {
    return 0
  }
  return counted(record.win) + counted(record.loss) + counted(record.draw)
}

function counted(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asRecord(value: unknown): ILooseRecord | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  return value as ILooseRecord
}

function nameTokens(value: string): string[] {
  return foldName(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
}

function usernameHasToken(username: string, token: string): boolean {
  if (token.length < 4) {
    return false
  }
  return foldName(username).replace(/[^a-z0-9]/g, '').includes(token)
}

function tokensMatch(left: string, right: string): boolean {
  if (left === right) {
    return true
  }
  const short = left.length <= right.length ? left : right
  const long = left.length <= right.length ? right : left
  return short.length >= 4 && long.startsWith(short)
}

function foldName(value: string): string {
  const plain = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  let folded = ''
  for (const char of plain) {
    folded += CYRILLIC_TO_LATIN[char] ?? char
  }
  return folded
}

async function runPool(
  items: string[],
  limit: number,
  task: (item: string) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return
  }

  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      if (current) {
        await task(current)
      }
    }
  })

  await Promise.all(workers)
}
