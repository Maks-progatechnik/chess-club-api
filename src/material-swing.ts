import { decode } from '@savi2w/chess-tcn'
import { Chess } from 'chess.js'
import type { Color, Square } from 'chess.js'

export interface IMaterialSwing {
  deficit: number
}

interface ITcnStep {
  from?: string
  to?: string
  promotion?: string
}

export interface ISwingStep {
  balance: number
  captured: boolean
  to: string
}

interface IReplayMove {
  captured?: string
  to: string
}

type Promotion = 'q' | 'r' | 'b' | 'n'

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

export function materialSwing(moveList: string | null, winner: 'white' | 'black'): IMaterialSwing | null {
  if (!moveList || moveList.length < 2 || moveList.length % 2 !== 0) {
    return null
  }

  const chess = new Chess()
  const steps: ISwingStep[] = []
  const winnerColor = winner === 'white' ? 'w' : 'b'
  const opponentColor = winner === 'white' ? 'b' : 'w'

  for (let index = 0; index < moveList.length; index += 2) {
    const step = decode(moveList.slice(index, index + 2)) as ITcnStep
    const from = squareOf(step.from)
    const to = squareOf(step.to)
    if (!from || !to) {
      return null
    }
    const played = chess.move({
      from,
      to,
      promotion: promotionOf(step.promotion),
    })
    if (!played) {
      return null
    }
    remember(steps, chess, winnerColor, opponentColor, played)
  }

  return { deficit: settledMaterialDeficit(steps) }
}

export function materialSwingFromSans(moves: string[], winner: 'white' | 'black'): IMaterialSwing | null {
  const chess = new Chess()
  const steps: ISwingStep[] = []
  const winnerColor = winner === 'white' ? 'w' : 'b'
  const opponentColor = winner === 'white' ? 'b' : 'w'

  for (const move of moves) {
    const played = chess.move(move)
    if (!played) {
      return null
    }
    remember(steps, chess, winnerColor, opponentColor, played)
  }

  return { deficit: settledMaterialDeficit(steps) }
}

export function settledMaterialDeficit(steps: ISwingStep[]): number {
  let deficit = 0
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]
    const next = steps[index + 1]
    if (!step) {
      continue
    }
    if (next && step.captured && next.captured && next.to === step.to) {
      continue
    }
    if (step.balance < deficit) {
      deficit = step.balance
    }
  }
  return deficit
}

function remember(steps: ISwingStep[], chess: Chess, winner: Color, opponent: Color, played: IReplayMove): void {
  steps.push({
    balance: material(chess, winner) - material(chess, opponent),
    captured: Boolean(played.captured),
    to: played.to,
  })
}

function material(chess: Chess, color: Color): number {
  let total = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== color || piece.type === 'k') {
        continue
      }
      total += PIECE_VALUE[piece.type] ?? 0
    }
  }
  return total
}

function squareOf(value: string | undefined): Square | null {
  if (!value || !/^[a-h][1-8]$/.test(value)) {
    return null
  }
  return value as Square
}

function promotionOf(value: string | undefined): Promotion | undefined {
  if (value === 'q' || value === 'r' || value === 'b' || value === 'n') {
    return value
  }
  return undefined
}
