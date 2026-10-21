import { achievementsFrom } from './achievements'
import type { IAchievements } from './achievements'
import { statsFrom } from './club-stats'
import type { IClubStats } from './club-stats'
import { listDraws } from './draws'
import type { ISavedDraw } from './draws'
import { lookupChessGame } from './chess-game-lookup'
import type { IChessGameDetails } from './chess-game-lookup'
import { db } from './db/client'
import { accounts } from './db/schema'
import { aliasMap, scorePair, standingsFrom } from './match-score'
import type { IBoardDraw, IClubBoard, IScoreAlias, IScoreGameInput, IScorePairInput } from './match-score'
import { readSignups } from './registrations'

export type { IBoardDraw, IBoardGame, IBoardPair, IClubBoard, IStanding } from './match-score'
export type { IAchievements, IRecordMark } from './achievements'
export type { IClubStats, IOpeningCount } from './club-stats'

interface IBoardResponse extends IClubBoard {
  achievements: IAchievements
  stats: IClubStats
}

const LOOKUP_LIMIT = 4

interface ISourcePair {
  white: string
  black: string | null
  games: string[]
  across?: boolean
}

export async function readBoard(): Promise<IBoardResponse> {
  const [draws, club] = await Promise.all([listDraws(), loadAliases()])
  const urls = uniqueUrls(draws)
  const lookedUp = await lookupAll(urls)
  const chronological = [...draws].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id)
  const scored = chronological.map((draw, index) => scoreDraw(draw, index + 1, lookedUp, club.aliases))
  const standings = standingsFrom(scored)

  return {
    draws: [...scored].reverse(),
    standings,
    achievements: achievementsFrom(scored, standings),
    stats: statsFrom(scored, club.members),
  }
}

interface IClubAliases {
  aliases: Map<string, string>
  members: number
}

async function loadAliases(): Promise<IClubAliases> {
  const [signups, claimed] = await Promise.all([
    readSignups(),
    db
      .select({
        name: accounts.name,
        surname: accounts.surname,
        chessCom: accounts.chessCom,
        signupName: accounts.signupName,
      })
      .from(accounts),
  ])

  const rows: IScoreAlias[] = []
  for (const signup of signups) {
    if (signup.username) {
      rows.push({ username: signup.username, name: signup.name })
    }
  }
  for (const account of claimed) {
    if (!account.chessCom) {
      continue
    }
    const name = account.signupName?.trim() || `${account.name} ${account.surname}`.trim()
    rows.push({ username: account.chessCom, name })
  }
  return { aliases: aliasMap(rows), members: signups.length }
}

function scoreDraw(
  draw: ISavedDraw,
  round: number,
  lookedUp: Map<string, IChessGameDetails | null>,
  aliases: Map<string, string>,
): IBoardDraw {
  const pairs = [
    ...draw.result.beginner.map((pair) => toPairInput(pair, 'beginner', lookedUp)),
    ...draw.result.advanced.map((pair) => toPairInput(pair, 'advanced', lookedUp)),
  ]

  return {
    id: draw.id,
    createdAt: draw.createdAt,
    round,
    pairs: pairs.map((pair) => scorePair(pair, aliases)),
  }
}

function toPairInput(
  pair: ISourcePair,
  group: 'beginner' | 'advanced',
  lookedUp: Map<string, IChessGameDetails | null>,
): IScorePairInput {
  return {
    group,
    white: pair.white,
    black: pair.black,
    across: pair.across === true,
    games: pair.games.map((url) => toKnownGame(url, lookedUp.get(url) ?? null)),
  }
}

function toKnownGame(url: string, details: IChessGameDetails | null): IScoreGameInput {
  if (!details) {
    return {
      url,
      winner: null,
      whiteUsername: null,
      blackUsername: null,
      result: null,
      summary: null,
      playedAt: null,
      moveList: null,
      opening: null,
    }
  }

  return {
    url: details.url,
    winner: details.winner,
    whiteUsername: details.white,
    blackUsername: details.black,
    result: details.result,
    summary: details.resultMessage,
    playedAt: details.playedAt,
    moveList: details.moveList,
    opening: details.opening,
  }
}

function uniqueUrls(draws: ISavedDraw[]): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const draw of draws) {
    const pairs = [...draw.result.beginner, ...draw.result.advanced]
    for (const pair of pairs) {
      for (const url of pair.games) {
        if (seen.has(url)) {
          continue
        }
        seen.add(url)
        urls.push(url)
      }
    }
  }
  return urls
}

async function lookupAll(urls: string[]): Promise<Map<string, IChessGameDetails | null>> {
  const lookedUp = new Map<string, IChessGameDetails | null>()
  let index = 0
  const workers = Array.from({ length: Math.min(LOOKUP_LIMIT, urls.length) }, async () => {
    while (index < urls.length) {
      const current = index
      index += 1
      const url = urls[current]
      if (url) {
        lookedUp.set(url, await lookupChessGame(url))
      }
    }
  })
  await Promise.all(workers)
  return lookedUp
}
