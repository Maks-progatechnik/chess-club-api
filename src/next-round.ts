import { readBoard } from './board'
import { readClubNames } from './club-names'
import type { IClubNames } from './club-names'
import { listDraws, saveNextRound } from './draws'
import type { IDrawResult, IPairing, ISavedDraw, SaveDrawResult } from './draws'
import type { IBoardDraw, IBoardPair, IStanding } from './match-score'
import { swissPairs } from './swiss'
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

  const [board, club] = await Promise.all([readBoard(), readClubNames()])
  const scored = board.draws.find((draw) => draw.id === previous.id)
  if (!scored) {
    return { ok: false, status: 400, error: 'The current round was not found.' }
  }

  const players = swissPlayers(board.standings, [...board.draws].reverse())
  const next: IDrawResult = {
    pairs: swissPairs(players).map(toStoredPair),
  }
  const closed = withSkips(previous.result, scored, club)

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

function swissPlayers(standings: IStanding[], draws: IBoardDraw[]): ISwissPlayer[] {
  const history = new Map<string, IHistory>()
  for (const draw of draws) {
    for (const pair of draw.pairs) {
      notePair(history, pair)
    }
  }

  return standings.map((standing) => toSwissPlayer(standing, history))
}

function notePair(history: Map<string, IHistory>, pair: IBoardPair): void {
  const white = takeHistory(history, pair.white)
  if (!pair.black) {
    white.hadBye = true
    return
  }

  const black = takeHistory(history, pair.black)
  white.whites += 1
  white.lastColor = 'white'
  white.opponents.add(nameKey(pair.black))
  black.blacks += 1
  black.lastColor = 'black'
  black.opponents.add(nameKey(pair.white))
}

function toSwissPlayer(standing: IStanding, history: Map<string, IHistory>): ISwissPlayer {
  const row = history.get(nameKey(standing.name)) ?? blankHistory()
  return {
    name: standing.name,
    points: standing.points,
    gameWins: standing.gameWins,
    whites: row.whites,
    blacks: row.blacks,
    lastColor: row.lastColor,
    opponents: [...row.opponents],
    hadBye: row.hadBye,
  }
}

function withSkips(result: IDrawResult, scored: IBoardDraw, club: IClubNames): IDrawResult {
  return {
    pairs: result.pairs.map((pair) => skipPair(pair, scored, club)),
  }
}

function skipPair(pair: IPairing, scored: IBoardDraw, club: IClubNames): IPairing {
  if (!pair.black || pair.skipped) {
    return pair
  }
  const match = scored.pairs.find((item) => club.same(item.white, pair.white) && club.same(item.black, pair.black))
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
  return { white: pair.white, black: pair.black, games: [] }
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

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}
