import { readBoard } from './board'
import { listDraws, saveNextRound } from './draws'
import type { IDrawResult, IPairing, ISavedDraw, SaveDrawResult } from './draws'
import type { BoardGroup, IBoardDraw, IBoardPair, IStanding } from './match-score'
import { readSignups } from './registrations'
import type { ISignup } from './registrations'
import { swissGroups } from './swiss'
import type { ISwissPair, ISwissPlayer } from './swiss'

const ROUND_LIMIT = 4
const ROUND_DEADLINES = ['2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12']
const ROUND_PAIRINGS = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']

interface IHistory {
  whites: number
  blacks: number
  lastColor: 'white' | 'black' | null
  opponents: Set<string>
  hadBye: boolean
  group: BoardGroup | null
}

interface IStoredPair {
  white: string
  black: string | null
  across?: boolean
}

interface IRoundPlan {
  expectedCount: number
  previousId: number
  closed: IDrawResult
  next: IDrawResult
}

type RoundPlanResult = { ok: true; plan: IRoundPlan } | { ok: false; status: 400 | 409; error: string }

export async function generateNextRound(round: number): Promise<SaveDrawResult> {
  const planned = await planNextRound(round)
  if (!planned.ok) {
    return planned
  }

  return saveNextRound({
    expectedCount: planned.plan.expectedCount,
    previousId: planned.plan.previousId,
    previous: planned.plan.closed,
    next: planned.plan.next,
  })
}

async function planNextRound(round: number): Promise<RoundPlanResult> {
  if (!Number.isInteger(round) || round < 2 || round > ROUND_LIMIT) {
    return { ok: false, status: 400, error: 'That round cannot be drawn.' }
  }
  if (!roundIsDue(round)) {
    return { ok: false, status: 400, error: 'That round is not ready to draw yet.' }
  }

  const saved = await listDraws()
  const chronological = [...saved].sort(byCreated)
  if (chronological.length === 0) {
    return { ok: false, status: 400, error: 'Draw round 1 before generating the next round.' }
  }
  if (chronological.length + 1 !== round) {
    return { ok: false, status: 409, error: 'That round is already drawn.' }
  }

  const previous = chronological[chronological.length - 1]
  if (!previous) {
    return { ok: false, status: 400, error: 'Draw round 1 before generating the next round.' }
  }

  const [board, signups] = await Promise.all([readBoard(), readSignups()])
  const scored = board.draws.find((draw) => draw.id === previous.id)
  if (!scored) {
    return { ok: false, status: 400, error: 'The current round was not found.' }
  }

  const players = swissPlayers(board.standings, [...board.draws].reverse(), signups)
  const groups = swissGroups(players)
  const next: IDrawResult = {
    beginner: groups.beginner.map(toStoredPair),
    advanced: groups.advanced.map(toStoredPair),
  }
  const closed = withSkips(previous.result, scored)

  return {
    ok: true,
    plan: {
      expectedCount: chronological.length,
      previousId: previous.id,
      closed,
      next,
    },
  }
}

function swissPlayers(standings: IStanding[], draws: IBoardDraw[], signups: ISignup[]): ISwissPlayer[] {
  const history = new Map<string, IHistory>()
  for (const draw of draws) {
    for (const pair of draw.pairs) {
      notePair(history, pair)
    }
  }

  return standings.map((standing) => toSwissPlayer(standing, history, signups))
}

function notePair(history: Map<string, IHistory>, pair: IBoardPair): void {
  const white = takeHistory(history, pair.white)
  if (!pair.across && white.group === null) {
    white.group = pair.group
  }
  if (!pair.black) {
    white.hadBye = true
    return
  }

  const black = takeHistory(history, pair.black)
  if (!pair.across && black.group === null) {
    black.group = pair.group
  }
  white.whites += 1
  white.lastColor = 'white'
  white.opponents.add(nameKey(pair.black))
  black.blacks += 1
  black.lastColor = 'black'
  black.opponents.add(nameKey(pair.white))
}

function toSwissPlayer(standing: IStanding, history: Map<string, IHistory>, signups: ISignup[]): ISwissPlayer {
  const row = history.get(nameKey(standing.name)) ?? blankHistory()
  return {
    name: standing.name,
    group: row.group ?? signupGroup(signups, standing.name),
    points: standing.points,
    gameWins: standing.gameWins,
    whites: row.whites,
    blacks: row.blacks,
    lastColor: row.lastColor,
    opponents: [...row.opponents],
    hadBye: row.hadBye,
  }
}

function withSkips(result: IDrawResult, scored: IBoardDraw): IDrawResult {
  return {
    beginner: result.beginner.map((pair) => skipPair(pair, scored)),
    advanced: result.advanced.map((pair) => skipPair(pair, scored)),
  }
}

function skipPair(pair: IPairing, scored: IBoardDraw): IPairing {
  if (!pair.black || pair.skipped) {
    return pair
  }
  const match = scored.pairs.find((item) => same(item.white, pair.white) && same(item.black, pair.black))
  if (!match || !unfinished(match)) {
    return pair
  }
  return { ...pair, skipped: true }
}

function unfinished(pair: IBoardPair): boolean {
  if (pair.status === 'open') {
    return true
  }
  if (pair.status !== 'playing') {
    return false
  }
  return pair.games.some((game) => game.outcome !== 'unknown')
}

function toStoredPair(pair: ISwissPair): IPairing {
  const stored: IStoredPair = { white: pair.white, black: pair.black }
  if (pair.across) {
    stored.across = true
  }
  return { ...stored, games: [] }
}

function signupGroup(signups: ISignup[], name: string): BoardGroup {
  const signup = signups.find((row) => same(row.name, name))
  return signup?.level?.trim().toLowerCase() === 'advanced' ? 'advanced' : 'beginner'
}

function takeHistory(history: Map<string, IHistory>, name: string): IHistory {
  const key = nameKey(name)
  const existing = history.get(key)
  if (existing) {
    return existing
  }
  const created = blankHistory()
  history.set(key, created)
  return created
}

function blankHistory(): IHistory {
  return {
    whites: 0,
    blacks: 0,
    lastColor: null,
    opponents: new Set<string>(),
    hadBye: false,
    group: null,
  }
}

function roundIsDue(round: number, today = new Date()): boolean {
  const previousDeadline = ROUND_DEADLINES[round - 2]
  const pairing = ROUND_PAIRINGS[round - 1]
  if (!previousDeadline || !pairing) {
    return false
  }
  const key = dayKey(today)
  return key >= previousDeadline || key >= pairing
}

function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function byCreated(left: ISavedDraw, right: ISavedDraw): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id - right.id
}

function same(left: string | null, right: string | null): boolean {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase()
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}
