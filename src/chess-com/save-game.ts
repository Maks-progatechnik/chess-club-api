import { sql } from 'drizzle-orm'
import { chessGamePlayers, chessGames, externalPlayers } from '../db/schema'
import { db } from '../db/client'
import { CHESS_COM_PARSER_VERSION } from './types'
import type { IParsedChessGame, IParsedParticipant } from './types'

interface ISaveParsedGameInput {
  game: IParsedChessGame
  source: unknown
}

export type ISaveParsedGameResult = { ok: true; gameId: number } | { ok: false; error: string }

type Database = typeof db
type InsertWriter = Pick<Database, 'insert'>

export async function saveParsedGame(input: ISaveParsedGameInput): Promise<ISaveParsedGameResult> {
  const { game, source } = input
  if (!game.white.externalId || !game.black.externalId) {
    return { ok: false, error: 'Cannot store a game until both Chess.com player ids are present.' }
  }

  const gameId = await db.transaction(async (tx) => {
    const whiteId = await upsertPlayer(tx, game.white)
    const blackId = await upsertPlayer(tx, game.black)
    const storedId = await upsertGame(tx, game, source)
    await upsertSeat(tx, storedId, whiteId, game.white)
    await upsertSeat(tx, storedId, blackId, game.black)
    return storedId
  })

  return { ok: true, gameId }
}

async function upsertPlayer(tx: InsertWriter, seat: IParsedParticipant): Promise<number> {
  const externalId = seat.externalId
  if (!externalId) {
    throw new Error('Chess.com player id is missing.')
  }

  const [row] = await tx
    .insert(externalPlayers)
    .values({
      provider: 'chess.com',
      externalId,
      externalUuid: seat.externalUuid,
      username: seat.username,
      countryName: seat.countryName,
      isComputer: seat.isComputer,
    })
    .onConflictDoUpdate({
      target: [externalPlayers.provider, externalPlayers.externalId],
      set: {
        username: sql`excluded.username`,
        externalUuid: sql`coalesce(excluded.external_uuid, ${externalPlayers.externalUuid})`,
        countryName: sql`coalesce(excluded.country_name, ${externalPlayers.countryName})`,
        isComputer: sql`coalesce(excluded.is_computer, ${externalPlayers.isComputer})`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: externalPlayers.id })

  if (!row) {
    throw new Error('Could not store the Chess.com player.')
  }
  return row.id
}

async function upsertGame(tx: InsertWriter, game: IParsedChessGame, source: unknown): Promise<number> {
  const values = {
    provider: game.provider,
    externalId: game.externalId,
    externalUuid: game.externalUuid,
    url: game.url,
    status: game.status,
    pace: game.pace,
    result: game.result,
    winnerColor: game.winnerColor,
    termination: game.termination,
    terminationRaw: game.terminationRaw,
    terminationDetail: game.terminationDetail,
    rated: game.rated,
    variant: game.variant,
    variantName: game.variantName,
    timeClass: game.timeClass,
    initialSeconds: game.initialSeconds,
    incrementSeconds: game.incrementSeconds,
    timeControlRaw: game.timeControlRaw,
    startedAt: game.startedAt ? new Date(game.startedAt) : null,
    endedAt: game.endedAt ? new Date(game.endedAt) : null,
    plyCount: game.plyCount,
    eco: game.eco,
    openingName: game.openingName,
    startingFen: game.startingFen,
    pgn: game.pgn,
    encodedMoveList: game.encodedMoveList,
    moveTimestamps: game.moveTimestamps,
    sourcePayload: source,
    parserVersion: CHESS_COM_PARSER_VERSION,
    updatedAt: new Date(),
  }

  const [row] = await tx
    .insert(chessGames)
    .values(values)
    .onConflictDoUpdate({
      target: [chessGames.provider, chessGames.externalId],
      set: values,
    })
    .returning({ id: chessGames.id })

  if (!row) {
    throw new Error('Could not store the Chess.com game.')
  }
  return row.id
}

async function upsertSeat(tx: InsertWriter, gameId: number, externalPlayerId: number, seat: IParsedParticipant): Promise<void> {
  await tx
    .insert(chessGamePlayers)
    .values({
      gameId,
      externalPlayerId,
      color: seat.color,
      username: seat.username,
      rating: seat.rating,
      ratingChange: seat.ratingChange,
      ratingAfter: seat.ratingAfter,
    })
    .onConflictDoUpdate({
      target: [chessGamePlayers.gameId, chessGamePlayers.color],
      set: {
        externalPlayerId,
        username: seat.username,
        rating: seat.rating,
        ratingChange: seat.ratingChange,
        ratingAfter: seat.ratingAfter,
      },
    })
}
