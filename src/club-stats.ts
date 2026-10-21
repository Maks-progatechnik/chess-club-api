import type { IBoardDraw } from './match-score'

export interface IOpeningCount {
  name: string
  games: number
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
  const openings = new Map<string, number>()

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
          openings.set(game.opening, (openings.get(game.opening) ?? 0) + 1)
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
    openings: leadingOpenings(openings),
  }
}

function leadingOpenings(counts: Map<string, number>): IOpeningCount[] {
  let best = 0
  for (const count of counts.values()) {
    if (count > best) {
      best = count
    }
  }
  if (best === 0) {
    return []
  }
  return [...counts.entries()]
    .filter((entry) => entry[1] === best)
    .map(([name, games]) => ({ name, games }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
