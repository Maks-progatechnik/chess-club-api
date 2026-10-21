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

interface ISwingState {
  deficit: number
}

type Promotion = 'q' | 'r' | 'b' | 'n'

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

export function materialSwing(moveList: string | null, winner: 'white' | 'black'): IMaterialSwing | null {
  if (!moveList || moveList.length < 2 || moveList.length % 2 !== 0) {
    return null
  }

  const chess = new Chess()
  const state: ISwingState = { deficit: 0 }
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
    noteSwing(chess, state, winnerColor, opponentColor)
  }

  return state
}

export function materialSwingFromSans(moves: string[], winner: 'white' | 'black'): IMaterialSwing | null {
  const chess = new Chess()
  const state: ISwingState = { deficit: 0 }
  const winnerColor = winner === 'white' ? 'w' : 'b'
  const opponentColor = winner === 'white' ? 'b' : 'w'

  for (const move of moves) {
    const played = chess.move(move)
    if (!played) {
      return null
    }
    noteSwing(chess, state, winnerColor, opponentColor)
  }

  return state
}

function noteSwing(chess: Chess, state: ISwingState, winner: Color, opponent: Color): void {
  const balance = material(chess, winner) - material(chess, opponent)
  if (balance < state.deficit) {
    state.deficit = balance
  }
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
