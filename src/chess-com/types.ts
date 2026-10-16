export const CHESS_COM_PROVIDER = 'chess.com'
export const CHESS_COM_PARSER_VERSION = '1'

export type ChessGameStatus = 'finished' | 'ongoing' | 'unknown'

export type ChessGameResult = 'white_win' | 'black_win' | 'draw' | 'unknown'

export type ChessColor = 'white' | 'black'

export type ChessTimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily'

export type ChessTermination =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'abandonment'
  | 'stalemate'
  | 'agreement'
  | 'repetition'
  | 'insufficient'
  | 'aborted'
  | 'fifty_move'
  | 'other'
  | 'unknown'

export interface IChessComCallbackPlayer {
  uuid?: string
  id?: number
  username?: string
  color?: string
  rating?: number
  countryId?: number
  countryName?: string
  isComputer?: boolean
  avatarUrl?: string
}

export interface IChessComCallbackGame {
  id?: number
  uuid?: string
  colorOfWinner?: string
  isLiveGame?: boolean
  isFinished?: boolean
  isRated?: boolean
  isCheckmate?: boolean
  isStalemate?: boolean
  plyCount?: number
  ratingChangeWhite?: number
  ratingChangeBlack?: number
  gameEndReason?: string
  resultMessage?: string
  endTime?: number
  type?: string
  typeName?: string
  moveList?: string
  moveTimestamps?: string
  baseTime1?: number
  timeIncrement1?: number
  timeControl?: {
    baseMs?: number
    incrementMs?: number
  }
  pgnHeaders?: Record<string, string | number>
}

export interface IChessComCallbackResponse {
  game?: IChessComCallbackGame
  players?: {
    top?: IChessComCallbackPlayer
    bottom?: IChessComCallbackPlayer
  }
}

export interface IParsedParticipant {
  color: ChessColor
  username: string
  externalId: string | null
  externalUuid: string | null
  countryName: string | null
  isComputer: boolean | null
  rating: number | null
  ratingChange: number | null
  ratingAfter: number | null
}

export interface IParsedChessGame {
  provider: typeof CHESS_COM_PROVIDER
  externalId: string
  externalUuid: string | null
  url: string | null
  status: ChessGameStatus
  pace: 'live' | null
  result: ChessGameResult
  winnerColor: ChessColor | null
  termination: ChessTermination
  terminationRaw: string | null
  terminationDetail: string | null
  rated: boolean | null
  variant: string | null
  variantName: string | null
  timeClass: ChessTimeClass | null
  initialSeconds: number | null
  incrementSeconds: number | null
  timeControlRaw: string | null
  startedAt: string | null
  endedAt: string | null
  plyCount: number | null
  eco: string | null
  openingName: string | null
  startingFen: string | null
  pgn: string | null
  encodedMoveList: string | null
  moveTimestamps: string | null
  white: IParsedParticipant
  black: IParsedParticipant
}

export type IParseChessGameResult = { ok: true; game: IParsedChessGame } | { ok: false; error: string }
