import type { GameOutcome, IBoardDraw } from './match-score'

export const DOMESTIC_START = 1200
export const DOMESTIC_K = 32

export interface IClubGameRow {
  url: string
  white: string
  black: string
  outcome: GameOutcome
  winnerName: string | null
  playedAt: string | null
  opening: string | null
  round: number
}

export interface IGameStanding {
  name: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  elo: number
}

interface IRating {
  name: string
  rating: number
}

interface IGameBucket {
  name: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
}

export function gamesFrom(draws: IBoardDraw[]): IClubGameRow[] {
  const games: IClubGameRow[] = []
  const seen = new Set<string>()
  const chronological = [...draws].sort((left, right) => left.round - right.round || left.id - right.id)

  for (const draw of chronological) {
    for (const pair of draw.pairs) {
      if (!pair.black) {
        continue
      }
      for (const game of pair.games) {
        if (seen.has(game.url)) {
          continue
        }
        seen.add(game.url)
        games.push({
          url: game.url,
          white: pair.white,
          black: pair.black,
          outcome: game.outcome,
          winnerName: game.winnerName,
          playedAt: game.playedAt,
          opening: game.opening,
          round: draw.round,
        })
      }
    }
  }

  games.sort(byPlayed)
  return games
}

export function gameStandingsFrom(games: IClubGameRow[]): IGameStanding[] {
  const buckets = new Map<string, IGameBucket>()
  const ratings = new Map<string, IRating>()

  for (const game of games) {
    if (game.outcome !== 'white' && game.outcome !== 'black' && game.outcome !== 'draw') {
      continue
    }
    const whiteScore = game.outcome === 'white' ? 1 : game.outcome === 'draw' ? 0.5 : 0
    const blackScore = game.outcome === 'black' ? 1 : game.outcome === 'draw' ? 0.5 : 0
    const white = ensureRating(ratings, game.white)
    const black = ensureRating(ratings, game.black)
    const whiteRating = white.rating
    const blackRating = black.rating
    white.rating = whiteRating + DOMESTIC_K * (whiteScore - expectedScore(whiteRating, blackRating))
    black.rating = blackRating + DOMESTIC_K * (blackScore - expectedScore(blackRating, whiteRating))
    recordResult(buckets, game.white, whiteScore)
    recordResult(buckets, game.black, blackScore)
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      elo: Math.round(ratings.get(nameKey(bucket.name))?.rating ?? DOMESTIC_START),
    }))
    .sort(byStanding)
}

function recordResult(buckets: Map<string, IGameBucket>, name: string, score: number): void {
  const bucket = ensureBucket(buckets, name)
  bucket.played += 1
  bucket.points += score
  if (score === 1) {
    bucket.wins += 1
  } else if (score === 0.5) {
    bucket.draws += 1
  } else {
    bucket.losses += 1
  }
}

function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400))
}

function ensureRating(ratings: Map<string, IRating>, name: string): IRating {
  const key = nameKey(name)
  const existing = ratings.get(key)
  if (existing) {
    return existing
  }
  const created: IRating = { name: name.trim(), rating: DOMESTIC_START }
  ratings.set(key, created)
  return created
}

function ensureBucket(buckets: Map<string, IGameBucket>, name: string): IGameBucket {
  const key = nameKey(name)
  const existing = buckets.get(key)
  if (existing) {
    return existing
  }
  const created: IGameBucket = { name: name.trim(), points: 0, played: 0, wins: 0, draws: 0, losses: 0 }
  buckets.set(key, created)
  return created
}

function byStanding(left: IGameStanding, right: IGameStanding): number {
  return right.points - left.points || right.wins - left.wins || right.elo - left.elo || left.name.localeCompare(right.name)
}

function byPlayed(left: IClubGameRow, right: IClubGameRow): number {
  if (left.playedAt && right.playedAt && left.playedAt !== right.playedAt) {
    return left.playedAt.localeCompare(right.playedAt)
  }
  if (left.playedAt && !right.playedAt) {
    return -1
  }
  if (!left.playedAt && right.playedAt) {
    return 1
  }
  return left.url.localeCompare(right.url)
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}
