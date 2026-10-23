export interface ISwissPlayer {
  name: string
  points: number
  gameWins: number
  whites: number
  blacks: number
  lastColor: 'white' | 'black' | null
  opponents: string[]
  hadBye: boolean
}

export interface ISwissSide {
  name: string
  points: number
  gameWins: number
}

export type SwissPairKind = 'same' | 'up' | 'down' | 'bye'

export interface ISwissPair {
  white: string
  black: string | null
  kind: SwissPairKind
  rematch: boolean
  reason: string
  whitePlayer: ISwissSide
  blackPlayer: ISwissSide | null
}

interface IPointBand {
  points: number
  players: ISwissPlayer[]
}

export function swissPairs(players: ISwissPlayer[], random: () => number = Math.random): ISwissPair[] {
  const bands = bandsByPoints(players)
  const pairs: ISwissPair[] = []
  const used = new Set<string>()

  for (let index = 1; index < bands.length; index += 1) {
    const higher = bands[index - 1]
    const band = bands[index]
    if (!higher || !band || band.players.length === 0) {
      continue
    }
    const floor = lowestWins(band.players)
    const climbers = shuffle(
      band.players.filter((player) => player.gameWins > floor),
      random,
    )
    band.players = band.players.filter((player) => player.gameWins <= floor)
    for (const climber of climbers) {
      const opponent = pickOpponent(climber, higher.players, used, random)
      if (!opponent) {
        band.players.push(climber)
        continue
      }
      used.add(nameKey(climber.name))
      used.add(nameKey(opponent.name))
      higher.players = higher.players.filter((player) => nameKey(player.name) !== nameKey(opponent.name))
      pairs.push(explain(opponent, climber, 'up', upReason(climber, opponent, floor)))
    }
  }

  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index]
    const next = bands[index + 1]
    if (!band) {
      continue
    }
    const ranked = shuffle(
      band.players.filter((player) => !used.has(nameKey(player.name))),
      random,
    )
    const waiting: ISwissPlayer[] = []
    const seated = new Set<string>()
    for (const player of ranked) {
      if (seated.has(nameKey(player.name))) {
        continue
      }
      const opponent = findOpponent(player, ranked, seated)
      if (!opponent) {
        waiting.push(player)
        continue
      }
      seated.add(nameKey(player.name))
      seated.add(nameKey(opponent.name))
      used.add(nameKey(player.name))
      used.add(nameKey(opponent.name))
      pairs.push(explain(player, opponent, 'same', sameReason(player, opponent)))
    }

    for (const player of waiting) {
      if (used.has(nameKey(player.name)) || !next) {
        continue
      }
      const opponent = pickOpponent(player, next.players, used, random)
      if (!opponent) {
        next.players.push(player)
        continue
      }
      used.add(nameKey(player.name))
      used.add(nameKey(opponent.name))
      next.players = next.players.filter((item) => nameKey(item.name) !== nameKey(opponent.name))
      pairs.push(explain(player, opponent, 'down', downReason(player, opponent)))
    }

    if (!next) {
      const bye = takeBye(waiting.filter((player) => !used.has(nameKey(player.name))))
      if (bye) {
        pairs.push(explain(bye, null, 'bye', byeReason(bye)))
      }
    }
  }

  return pairs
}

function bandsByPoints(players: ISwissPlayer[]): IPointBand[] {
  const ordered = [...players].sort((left, right) => right.points - left.points || left.name.localeCompare(right.name))
  const bands: IPointBand[] = []
  for (const player of ordered) {
    const band = bands[bands.length - 1]
    if (band && band.points === player.points) {
      band.players.push(player)
      continue
    }
    bands.push({ points: player.points, players: [player] })
  }
  return bands
}

function lowestWins(players: ISwissPlayer[]): number {
  return players.reduce((lowest, player) => Math.min(lowest, player.gameWins), players[0]?.gameWins ?? 0)
}

function pickOpponent(
  player: ISwissPlayer,
  pool: ISwissPlayer[],
  used: Set<string>,
  random: () => number,
): ISwissPlayer | null {
  const free = pool.filter((candidate) => !used.has(nameKey(candidate.name)))
  const fresh = free.filter((candidate) => !hasPlayed(player, candidate))
  const choices = fresh.length > 0 ? fresh : free
  if (choices.length === 0) {
    return null
  }
  const index = Math.floor(random() * choices.length)
  return choices[index] ?? null
}

function explain(left: ISwissPlayer, right: ISwissPlayer | null, kind: SwissPairKind, reason: string): ISwissPair {
  if (!right) {
    return {
      white: left.name,
      black: null,
      kind,
      rematch: false,
      reason,
      whitePlayer: toSide(left),
      blackPlayer: null,
    }
  }
  const white = chooseWhite(left, right)
  const black = white === left ? right : left
  return {
    white: white.name,
    black: black.name,
    kind,
    rematch: hasPlayed(left, right),
    reason: `${reason} ${colorReason(white, black)}`,
    whitePlayer: toSide(white),
    blackPlayer: toSide(black),
  }
}

function toSide(player: ISwissPlayer): ISwissSide {
  return { name: player.name, points: player.points, gameWins: player.gameWins }
}

function upReason(climber: ISwissPlayer, opponent: ISwissPlayer, floor: number): string {
  return `${climber.name} is on ${pointsText(climber.points)} with ${winsText(climber.gameWins)}. Others on that score have ${winsText(floor)}, so ${climber.name} plays a random player on ${pointsText(opponent.points)}.`
}

function sameReason(left: ISwissPlayer, right: ISwissPlayer): string {
  const rematch = hasPlayed(left, right) ? ' They already played, and nobody else on this score was free.' : ''
  return `Both are on ${pointsText(left.points)}, with ${winsText(left.gameWins)} and ${winsText(right.gameWins)}. Same score is drawn at random.${rematch}`
}

function downReason(left: ISwissPlayer, right: ISwissPlayer): string {
  return `${left.name} was left over on ${pointsText(left.points)}. That score had an odd count, so they play a random player on ${pointsText(right.points)}.`
}

function byeReason(player: ISwissPlayer): string {
  if (player.hadBye) {
    return `${player.name} sits out on ${pointsText(player.points)}. Everyone still waiting has already had a bye.`
  }
  return `${player.name} sits out on ${pointsText(player.points)} with ${winsText(player.gameWins)}. The remaining field is odd, and this player has not had a bye.`
}

function colorReason(white: ISwissPlayer, black: ISwissPlayer): string {
  const whiteDue = dueWhite(white)
  const blackDue = dueWhite(black)
  if (whiteDue === true && blackDue !== true) {
    return `${white.name} is White because ${dueCause(white)}.`
  }
  if (whiteDue === blackDue) {
    return `Both are due the same color, so ${white.name} takes White from the draw order.`
  }
  return `${black.name} is due Black, so ${white.name} is White.`
}

function dueCause(player: ISwissPlayer): string {
  if (player.whites < player.blacks) {
    return 'they have played White less often'
  }
  if (player.lastColor === 'black') {
    return 'they had Black last round'
  }
  return 'they have no color yet'
}

function pointsText(points: number): string {
  const shown = Number.isInteger(points) ? String(points) : points.toFixed(1)
  return shown === '1' ? '1 point' : `${shown} points`
}

function winsText(wins: number): string {
  if (wins === 0) {
    return 'no game wins'
  }
  if (wins === 1) {
    return '1 game win'
  }
  return `${wins} game wins`
}

function takeBye(ranked: ISwissPlayer[]): ISwissPlayer | null {
  if (ranked.length % 2 === 0) {
    return null
  }
  for (let index = ranked.length - 1; index >= 0; index -= 1) {
    const player = ranked[index]
    if (player && !player.hadBye) {
      return player
    }
  }
  return ranked[ranked.length - 1] ?? null
}

function findOpponent(player: ISwissPlayer, rest: ISwissPlayer[], used: Set<string>): ISwissPlayer | null {
  const available = rest.filter((candidate) => nameKey(candidate.name) !== nameKey(player.name) && !used.has(nameKey(candidate.name)))
  return available.find((candidate) => !hasPlayed(player, candidate)) ?? available[0] ?? null
}

function chooseWhite(left: ISwissPlayer, right: ISwissPlayer): ISwissPlayer {
  const leftWantsWhite = dueWhite(left)
  const rightWantsWhite = dueWhite(right)
  if (leftWantsWhite === true && rightWantsWhite !== true) {
    return left
  }
  if (rightWantsWhite === true && leftWantsWhite !== true) {
    return right
  }
  if (leftWantsWhite === false && rightWantsWhite !== false) {
    return right
  }
  if (rightWantsWhite === false && leftWantsWhite !== false) {
    return left
  }
  if (leftWantsWhite === false) {
    return right
  }
  return left
}

function dueWhite(player: ISwissPlayer): boolean | null {
  if (player.whites < player.blacks) {
    return true
  }
  if (player.blacks < player.whites) {
    return false
  }
  if (player.lastColor === 'white') {
    return false
  }
  if (player.lastColor === 'black') {
    return true
  }
  return null
}

function hasPlayed(left: ISwissPlayer, right: ISwissPlayer): boolean {
  const key = nameKey(right.name)
  return left.opponents.some((name) => nameKey(name) === key)
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = next[index]
    const other = next[swapIndex]
    if (current === undefined || other === undefined) {
      continue
    }
    next[index] = other
    next[swapIndex] = current
  }
  return next
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}
