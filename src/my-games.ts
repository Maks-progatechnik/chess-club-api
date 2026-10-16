import type { IAccount } from './accounts'
import { lookupChessGame } from './chess-game-lookup'
import type { IChessGameDetails } from './chess-game-lookup'
import { listDraws } from './draws'

export interface IMyGame {
  url: string
  opponent: string
  color: 'white' | 'black'
  outcome: 'win' | 'loss' | 'draw' | 'unknown'
  summary: string
  white: string
  black: string
  whiteRating: number | null
  blackRating: number | null
  whiteChange: number | null
  blackChange: number | null
  timeControl: string | null
  opening: string | null
  playedAt: string | null
  yours: boolean
}

interface IListedGame {
  url: string
  opponent: string
  color: 'white' | 'black'
  fallbackAt: string
}

const LOOKUP_LIMIT = 4

export interface IGameSubject {
  names: string[]
  chessCom: string | null
}

export async function listMyGames(account: IAccount): Promise<IMyGame[]> {
  return listPlayerGames({ names: playerNames(account), chessCom: account.chessCom })
}

export async function listPlayerGames(subject: IGameSubject): Promise<IMyGame[]> {
  const listed = await listedGames(subject.names)
  const games = await mapPool(listed, LOOKUP_LIMIT, (game) => describeGame(subject, game))
  return games.sort((left, right) => (right.playedAt ?? '').localeCompare(left.playedAt ?? ''))
}

async function listedGames(names: string[]): Promise<IListedGame[]> {
  const draws = await listDraws()
  const listed: IListedGame[] = []
  const seen = new Set<string>()

  for (const draw of draws) {
    const pairs = [...draw.result.beginner, ...draw.result.advanced]
    for (const pair of pairs) {
      if (!pair.black) {
        continue
      }
      const color = colorInPair(names, pair.white, pair.black)
      if (!color) {
        continue
      }
      const opponent = color === 'white' ? pair.black : pair.white
      for (const url of pair.games) {
        const key = `${url.toLowerCase()}|${opponent.toLowerCase()}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        listed.push({ url, opponent, color, fallbackAt: draw.createdAt })
      }
    }
  }

  return listed
}

async function describeGame(subject: IGameSubject, listed: IListedGame): Promise<IMyGame> {
  const details = await lookupChessGame(listed.url)
  if (!details) {
    return {
      url: listed.url,
      opponent: listed.opponent,
      color: listed.color,
      outcome: 'unknown',
      summary: 'Chess.com did not return this game.',
      white: '',
      black: '',
      whiteRating: null,
      blackRating: null,
      whiteChange: null,
      blackChange: null,
      timeControl: null,
      opening: null,
      playedAt: listed.fallbackAt,
      yours: false,
    }
  }

  const color = sideFor(subject.chessCom, listed.color, details)
  const yours = usernameMatches(subject.chessCom, details, color) || !subject.chessCom
  const outcome = yours ? outcomeFor(color, details.winner) : 'unknown'
  return {
    url: details.url,
    opponent: listed.opponent,
    color,
    outcome,
    summary: summaryFor(details, outcome, yours),
    white: details.white,
    black: details.black,
    whiteRating: details.whiteRating,
    blackRating: details.blackRating,
    whiteChange: details.whiteChange,
    blackChange: details.blackChange,
    timeControl: details.timeControl,
    opening: details.opening,
    playedAt: details.playedAt ?? listed.fallbackAt,
    yours,
  }
}

function sideFor(chessCom: string | null, clubColor: 'white' | 'black', details: IChessGameDetails): 'white' | 'black' {
  const username = chessCom?.toLowerCase()
  if (username && details.white.toLowerCase() === username) {
    return 'white'
  }
  if (username && details.black.toLowerCase() === username) {
    return 'black'
  }
  return clubColor
}

function usernameMatches(chessCom: string | null, details: IChessGameDetails, color: 'white' | 'black'): boolean {
  const username = chessCom?.toLowerCase()
  if (!username) {
    return false
  }
  const player = color === 'white' ? details.white : details.black
  return player.toLowerCase() === username
}

function outcomeFor(color: 'white' | 'black', winner: 'white' | 'black' | 'draw' | null): IMyGame['outcome'] {
  if (winner === 'draw') {
    return 'draw'
  }
  if (winner === color) {
    return 'win'
  }
  if (winner) {
    return 'loss'
  }
  return 'unknown'
}

function summaryFor(details: IChessGameDetails, outcome: IMyGame['outcome'], yours: boolean): string {
  const message = details.resultMessage
  if (!yours) {
    return message ?? 'Finished game'
  }
  const reason = message?.match(/ won (by .+|on .+)$/i)?.[1]
  if (outcome === 'win') {
    return reason ? `Won ${reason}` : 'Won'
  }
  if (outcome === 'loss') {
    return reason ? `Lost ${reason}` : 'Lost'
  }
  if (outcome === 'draw') {
    return message ?? 'Draw'
  }
  return message ?? 'Finished game'
}

function playerNames(account: IAccount): string[] {
  const full = `${account.name} ${account.surname}`.trim()
  const names = full ? [full] : []
  if (account.signupName && !names.some((name) => sameName(name, account.signupName ?? ''))) {
    names.push(account.signupName)
  }
  return names
}

function colorInPair(names: string[], white: string, black: string): 'white' | 'black' | null {
  if (names.some((name) => sameName(name, white))) {
    return 'white'
  }
  if (names.some((name) => sameName(name, black))) {
    return 'black'
  }
  return null
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      const item = items[current]
      if (item !== undefined) {
        results[current] = await task(item)
      }
    }
  })
  await Promise.all(workers)
  return results
}
