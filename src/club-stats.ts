import type { IBoardDraw } from './match-score'

export interface IOpeningCount {
  name: string
  games: number
  whiteWins: number
  blackWins: number
  draws: number
}

export interface IClubStats {
  members: number
  games: number
  whiteWins: number
  blackWins: number
  draws: number
  openings: IOpeningCount[]
}

export function statsFrom(draws: IBoardDraw[], members: number): IClubStats {
  let games = 0
  let whiteWins = 0
  let blackWins = 0
  let drawn = 0
  const openings = new Map<string, IOpeningCount>()

  for (const draw of draws) {
    for (const pair of draw.pairs) {
      for (const game of pair.games) {
        if (game.outcome === 'unknown') {
          continue
        }
        games += 1
        if (game.outcome === 'white') {
          whiteWins += 1
        }
        if (game.outcome === 'black') {
          blackWins += 1
        }
        if (game.outcome === 'draw') {
          drawn += 1
        }
        if (game.opening) {
          recordOpening(openings, game.opening, game.outcome)
        }
      }
    }
  }

  return {
    members,
    games,
    whiteWins,
    blackWins,
    draws: drawn,
    openings: [...openings.values()].sort(byUsage),
  }
}

function recordOpening(openings: Map<string, IOpeningCount>, name: string, outcome: 'white' | 'black' | 'draw'): void {
  const key = name.trim().toLowerCase()
  const existing = openings.get(key)
  const row = existing ?? { name: name.trim(), games: 0, whiteWins: 0, blackWins: 0, draws: 0 }
  row.games += 1
  if (outcome === 'white') {
    row.whiteWins += 1
  }
  if (outcome === 'black') {
    row.blackWins += 1
  }
  if (outcome === 'draw') {
    row.draws += 1
  }
  openings.set(key, row)
}

function byUsage(left: IOpeningCount, right: IOpeningCount): number {
  return right.games - left.games || left.name.localeCompare(right.name)
}
