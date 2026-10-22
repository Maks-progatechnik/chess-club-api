import type { BoardGroup } from './match-score'

export interface ISwissPlayer {
  name: string
  group: BoardGroup
  points: number
  gameWins: number
  whites: number
  blacks: number
  lastColor: 'white' | 'black' | null
  opponents: string[]
  hadBye: boolean
}

export interface ISwissPair {
  white: string
  black: string | null
  across?: boolean
}

export interface ISwissGroups {
  beginner: ISwissPair[]
  advanced: ISwissPair[]
}

interface IGroupPairs {
  pairs: ISwissPair[]
  bye: ISwissPlayer | null
}

export function swissGroups(players: ISwissPlayer[]): ISwissGroups {
  const beginner = pairGroup(players.filter((player) => player.group === 'beginner'))
  const advanced = pairGroup(players.filter((player) => player.group === 'advanced'))
  const across = acrossBye(beginner.bye, advanced.bye)

  return {
    beginner: across ? beginner.pairs : withBye(beginner),
    advanced: across ? [...advanced.pairs, across] : withBye(advanced),
  }
}

function pairGroup(players: ISwissPlayer[]): IGroupPairs {
  const ranked = [...players].sort(byRank)
  const bye = takeBye(ranked)
  const rest = bye ? ranked.filter((player) => nameKey(player.name) !== nameKey(bye.name)) : ranked
  const used = new Set<string>()
  const pairs: ISwissPair[] = []

  for (const player of rest) {
    const key = nameKey(player.name)
    if (used.has(key)) {
      continue
    }
    const opponent = findOpponent(player, rest, used)
    if (!opponent) {
      continue
    }
    used.add(key)
    used.add(nameKey(opponent.name))
    const white = chooseWhite(player, opponent)
    const black = white === player ? opponent : player
    pairs.push({ white: white.name, black: black.name })
  }

  return { pairs, bye }
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

function acrossBye(beginner: ISwissPlayer | null, advanced: ISwissPlayer | null): ISwissPair | null {
  if (!beginner || !advanced || hasPlayed(beginner, advanced)) {
    return null
  }
  const white = chooseWhite(advanced, beginner)
  const black = white === advanced ? beginner : advanced
  return { white: white.name, black: black.name, across: true }
}

function withBye(group: IGroupPairs): ISwissPair[] {
  if (!group.bye) {
    return group.pairs
  }
  return [...group.pairs, { white: group.bye.name, black: null }]
}

function hasPlayed(left: ISwissPlayer, right: ISwissPlayer): boolean {
  const key = nameKey(right.name)
  return left.opponents.some((name) => nameKey(name) === key)
}

function byRank(left: ISwissPlayer, right: ISwissPlayer): number {
  return right.points - left.points || right.gameWins - left.gameWins || left.name.localeCompare(right.name)
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}
