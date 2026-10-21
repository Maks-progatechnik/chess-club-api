import { decode } from '@savi2w/chess-tcn'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { ECO } from 'chess-openings'

interface ITcnStep {
  from?: string
  to?: string
  promotion?: string
}

type Promotion = 'q' | 'r' | 'b' | 'n'

const book = new ECO()

export function openingName(moveList: string | null, ecoCode: string | null): string | null {
  if (!moveList || moveList.length < 2 || moveList.length % 2 !== 0) {
    return null
  }

  const chess = new Chess()
  const code = ecoCode?.trim().toUpperCase() ?? null
  let named: string | null = null
  let namedForCode: string | null = null

  for (let index = 0; index < moveList.length; index += 2) {
    const step = decode(moveList.slice(index, index + 2)) as ITcnStep
    const from = squareOf(step.from)
    const to = squareOf(step.to)
    if (!from || !to) {
      break
    }
    const played = chess.move({
      from,
      to,
      promotion: promotionOf(step.promotion),
    })
    if (!played) {
      break
    }
    const entry = book.lookupSync(chess.fen())
    if (!entry?.name) {
      continue
    }
    named = entry.name
    if (code && entry.code?.toUpperCase() === code) {
      namedForCode = entry.name
    }
  }

  return namedForCode ?? named
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
