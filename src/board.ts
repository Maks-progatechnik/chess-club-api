import { achievementsFrom } from './achievements'
import type { IAchievements } from './achievements'
import { statsFrom } from './club-stats'
import type { IClubStats } from './club-stats'
import { gameStandingsFrom, gamesFrom } from './game-table'
import type { IClubGameRow, IGameStanding } from './game-table'
import { listDraws } from './draws'
import type { ISavedDraw } from './draws'
import { lookupChessGame } from './chess-game-lookup'
import type { IChessGameDetails } from './chess-game-lookup'
import { readClubNames } from './club-names'
import type { IClubNames } from './club-names'
import { scorePair, standingsFrom } from './match-score'
import type { IBoardDraw, IClubBoard, IScoreGameInput, IScorePairInput } from './match-score'

export type { IBoardDraw, IBoardGame, IBoardPair, IClubBoard, IStanding } from './match-score'
export type { IAchievements, IRecordMark } from './achievements'
export type { IClubStats, IOpeningCount } from './club-stats'
export type { IClubGameRow, IGameStanding } from './game-table'

interface IBoardResponse extends IClubBoard {
  achievements: IAchievements
  stats: IClubStats
  games: IClubGameRow[]
  gameStandings: IGameStanding[]
}

const LOOKUP_LIMIT = 4

interface ISourcePair {
  white: string
  black: string | null
  games: string[]
  across?: boolean
  skipped?: boolean
}

export async function readBoard(): Promise<IBoardResponse> {
  const [draws, club] = await Promise.all([listDraws(), readClubNames()])
  const urls = uniqueUrls(draws)
  const lookedUp = await lookupAll(urls)
  const chronological = [...draws].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id)
  const scored = chronological.map((draw, index) => scoreDraw(draw, index + 1, lookedUp, club))
  const standings = standingsFrom(scored)
  const games = gamesFrom(scored)

  return {
    draws: [...scored].reverse(),
    standings,
    achievements: achievementsFrom(scored, standings),
    stats: statsFrom(scored, club.members),
    games,
    gameStandings: gameStandingsFrom(games),
  }
}

function scoreDraw(
  draw: ISavedDraw,
  round: number,
  lookedUp: Map<string, IChessGameDetails | null>,
  club: IClubNames,
): IBoardDraw {
  const pairs = draw.result.pairs.map((pair) => toPairInput(pair, lookedUp, club))

  return {
    id: draw.id,
    createdAt: draw.createdAt,
    round,
    pairs: pairs.map((pair) => scorePair(pair, club.chessAliases)),
  }
}

function toPairInput(
  pair: ISourcePair,
  lookedUp: Map<string, IChessGameDetails | null>,
  club: IClubNames,
): IScorePairInput {
  return {
    white: club.canonical(pair.white),
    black: pair.black ? club.canonical(pair.black) : null,
    across: pair.across === true,
    skipped: pair.skipped === true,
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
    const pairs = draw.result.pairs
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
