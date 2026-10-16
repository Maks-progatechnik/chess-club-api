import { CHESS_COM_PROVIDER } from './types'
import type {
  ChessColor,
  ChessGameResult,
  ChessGameStatus,
  ChessTermination,
  ChessTimeClass,
  IParsedChessGame,
  IParsedParticipant,
  IParseChessGameResult,
} from './types'

interface ILooseRecord {
  [key: string]: unknown
}

interface IClock {
  initialSeconds: number | null
  incrementSeconds: number | null
  timeClass: ChessTimeClass | null
  raw: string | null
}

interface ISeat {
  color: ChessColor
  username: string | null
  externalId: string | null
  externalUuid: string | null
  countryName: string | null
  isComputer: boolean | null
  rating: number | null
  ratingChange: number | null
}

const TERMINATION_NAMES: Record<string, ChessTermination> = {
  checkmate: 'checkmate',
  checkmated: 'checkmate',
  resignation: 'resignation',
  resigned: 'resignation',
  timeout: 'timeout',
  time: 'timeout',
  outoftime: 'timeout',
  abandonment: 'abandonment',
  abandoned: 'abandonment',
  stalemate: 'stalemate',
  agreement: 'agreement',
  agreed: 'agreement',
  repetition: 'repetition',
  insufficient: 'insufficient',
  aborted: 'aborted',
  abort: 'aborted',
  fiftymove: 'fifty_move',
  '50move': 'fifty_move',
}

export function parseChessComGame(body: unknown): IParseChessGameResult {
  const root = asRecord(body)
  const game = asRecord(root?.game)
  if (!game) {
    return { ok: false, error: 'Chess.com response has no game object.' }
  }

  const externalId = readExternalId(game.id)
  if (!externalId) {
    return { ok: false, error: 'Chess.com game id is missing.' }
  }

  const headers = asRecord(game.pgnHeaders) ?? {}
  const seats = readSeats(root, game, headers)
  if (!seats.white.username || !seats.black.username) {
    return { ok: false, error: 'Chess.com game is missing a white or black username.' }
  }
  if (seats.white.externalId && seats.white.externalId === seats.black.externalId) {
    return { ok: false, error: 'Chess.com game lists the same player on both sides.' }
  }

  const clock = readClock(readText(headers.TimeControl), readInteger(asRecord(game.timeControl)?.baseMs))
  const outcome = readOutcome(readText(headers.Result), readText(game.colorOfWinner))
  const pace = game.isLiveGame === true ? 'live' : null
  const status = readStatus(game.isFinished)

  const parsed: IParsedChessGame = {
    provider: CHESS_COM_PROVIDER,
    externalId,
    externalUuid: readText(game.uuid),
    url: pace === 'live' ? `https://www.chess.com/game/live/${externalId}` : null,
    status,
    pace,
    result: outcome.result,
    winnerColor: outcome.winnerColor,
    termination: readTermination(readText(game.gameEndReason), game.isCheckmate, game.isStalemate),
    terminationRaw: readText(game.gameEndReason),
    terminationDetail: readText(game.resultMessage),
    rated: readBoolean(game.isRated),
    variant: readText(game.type)?.toLowerCase() ?? null,
    variantName: readText(game.typeName),
    timeClass: clock.timeClass,
    initialSeconds: clock.initialSeconds,
    incrementSeconds: clock.incrementSeconds,
    timeControlRaw: clock.raw,
    startedAt: readStartedAt(headers),
    endedAt: readEndedAt(game.endTime),
    plyCount: readPlyCount(game.plyCount),
    eco: readEco(headers.ECO),
    openingName: null,
    startingFen: readFen(headers.FEN),
    pgn: null,
    encodedMoveList: readText(game.moveList),
    moveTimestamps: readText(game.moveTimestamps),
    white: toParticipant(seats.white),
    black: toParticipant(seats.black),
  }

  return { ok: true, game: parsed }
}

function readSeats(
  root: ILooseRecord | null,
  game: ILooseRecord,
  headers: ILooseRecord,
): { white: ISeat; black: ISeat } {
  const players = asRecord(root?.players)
  const listed = [asRecord(players?.top), asRecord(players?.bottom)].filter((player) => player !== null)
  const whitePlayer = listed.find((player) => readText(player.color)?.toLowerCase() === 'white') ?? null
  const blackPlayer = listed.find((player) => readText(player.color)?.toLowerCase() === 'black') ?? null

  return {
    white: readSeat('white', whitePlayer, readText(headers.White), readInteger(headers.WhiteElo), readInteger(game.ratingChangeWhite)),
    black: readSeat('black', blackPlayer, readText(headers.Black), readInteger(headers.BlackElo), readInteger(game.ratingChangeBlack)),
  }
}

function readSeat(
  color: ChessColor,
  player: ILooseRecord | null,
  headerName: string | null,
  headerRating: number | null,
  ratingChange: number | null,
): ISeat {
  const profileRating = readInteger(player?.rating)
  return {
    color,
    username: headerName ?? readText(player?.username),
    externalId: readExternalId(player?.id),
    externalUuid: readText(player?.uuid),
    countryName: readText(player?.countryName),
    isComputer: readBoolean(player?.isComputer),
    rating: headerRating ?? profileRating,
    ratingChange,
  }
}

function toParticipant(seat: ISeat): IParsedParticipant {
  const username = seat.username ?? ''
  return {
    color: seat.color,
    username,
    externalId: seat.externalId,
    externalUuid: seat.externalUuid,
    countryName: seat.countryName,
    isComputer: seat.isComputer,
    rating: seat.rating,
    ratingChange: seat.ratingChange,
    ratingAfter: seat.rating !== null && seat.ratingChange !== null ? seat.rating + seat.ratingChange : null,
  }
}

function readOutcome(
  result: string | null,
  colorOfWinner: string | null,
): { result: ChessGameResult; winnerColor: ChessColor | null } {
  if (result === '1-0') {
    return { result: 'white_win', winnerColor: 'white' }
  }
  if (result === '0-1') {
    return { result: 'black_win', winnerColor: 'black' }
  }
  if (result === '1/2-1/2') {
    return { result: 'draw', winnerColor: null }
  }
  if (colorOfWinner === 'white' || colorOfWinner === 'black') {
    return { result: colorOfWinner === 'white' ? 'white_win' : 'black_win', winnerColor: colorOfWinner }
  }
  return { result: 'unknown', winnerColor: null }
}

function readStatus(isFinished: unknown): ChessGameStatus {
  if (isFinished === true) {
    return 'finished'
  }
  if (isFinished === false) {
    return 'ongoing'
  }
  return 'unknown'
}

function readTermination(reason: string | null, isCheckmate: unknown, isStalemate: unknown): ChessTermination {
  if (reason) {
    const known = TERMINATION_NAMES[reason.toLowerCase().replace(/[\s_-]/g, '')]
    if (known) {
      return known
    }
    return 'other'
  }
  if (isCheckmate === true) {
    return 'checkmate'
  }
  if (isStalemate === true) {
    return 'stalemate'
  }
  return 'unknown'
}

function readClock(raw: string | null, baseMs: number | null): IClock {
  if (raw) {
    const daily = raw.match(/^1\/(\d+)$/)
    if (daily) {
      return { initialSeconds: null, incrementSeconds: null, timeClass: 'daily', raw }
    }
    const clock = raw.match(/^(\d+)(?:\+(\d+))?$/)
    if (clock?.[1]) {
      const initialSeconds = Number(clock[1])
      const incrementSeconds = clock[2] ? Number(clock[2]) : 0
      return {
        initialSeconds,
        incrementSeconds,
        timeClass: timeClassFor(initialSeconds, incrementSeconds),
        raw,
      }
    }
  }

  if (baseMs !== null && baseMs >= 0 && baseMs % 1000 === 0) {
    const initialSeconds = baseMs / 1000
    return {
      initialSeconds,
      incrementSeconds: null,
      timeClass: null,
      raw,
    }
  }

  return { initialSeconds: null, incrementSeconds: null, timeClass: null, raw }
}

function timeClassFor(initialSeconds: number, incrementSeconds: number): ChessTimeClass {
  const estimated = initialSeconds + 40 * incrementSeconds
  if (estimated < 180) {
    return 'bullet'
  }
  if (estimated < 600) {
    return 'blitz'
  }
  return 'rapid'
}

function readStartedAt(headers: ILooseRecord): string | null {
  return readUtcStamp(readText(headers.UTCDate), readText(headers.UTCTime))
}

function readUtcStamp(date: string | null, time: string | null): string | null {
  if (!date || !time) {
    return null
  }
  const match = date.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  const clock = time.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match || !clock) {
    return null
  }
  const stamp = new Date(`${match[1]}-${match[2]}-${match[3]}T${clock[1]}:${clock[2]}:${clock[3]}Z`)
  return Number.isNaN(stamp.getTime()) ? null : stamp.toISOString()
}

function readEndedAt(value: unknown): string | null {
  const seconds = readInteger(value)
  if (seconds === null || seconds < 946684800 || seconds > 4102444800) {
    return null
  }
  return new Date(seconds * 1000).toISOString()
}

function readPlyCount(value: unknown): number | null {
  const count = readInteger(value)
  if (count === null || count < 0) {
    return null
  }
  return count
}

function readEco(value: unknown): string | null {
  const text = readText(value)?.toUpperCase() ?? null
  if (!text || !/^[A-E]\d{2}$/.test(text)) {
    return null
  }
  return text
}

function readFen(value: unknown): string | null {
  const fen = readText(value)
  if (!fen) {
    return null
  }
  const fields = fen.split(' ')
  return fields.length >= 6 ? fen : null
}

function readExternalId(value: unknown): string | null {
  const id = readInteger(value)
  if (id === null || id <= 0) {
    return null
  }
  return String(id)
}

function readInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value !== 'string') {
    return null
  }
  const text = value.trim()
  return text || null
}

function asRecord(value: unknown): ILooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as ILooseRecord
}
