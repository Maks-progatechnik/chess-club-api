import { describe, expect, test } from 'bun:test'
import { materialSwingFromSans, settledMaterialDeficit } from './material-swing'
import type { ISwingStep } from './material-swing'
import { gameStandingsFrom } from './game-table'
import type { IClubGameRow } from './game-table'
import { swissGroups } from './swiss'
import type { ISwissPlayer } from './swiss'

describe('recovery', () => {
  test('ignores a queen trade that is recaptured on the next move', () => {
    const steps: ISwingStep[] = [
      { balance: -9, captured: true, to: 'd4' },
      { balance: 0, captured: true, to: 'd4' },
    ]
    expect(settledMaterialDeficit(steps)).toBe(0)
  })

  test('keeps the position after an unequal recapture', () => {
    const steps: ISwingStep[] = [
      { balance: -9, captured: true, to: 'd4' },
      { balance: -4, captured: true, to: 'd4' },
    ]
    expect(settledMaterialDeficit(steps)).toBe(-4)
  })

  test('keeps a deficit that is still there on the next move', () => {
    const steps: ISwingStep[] = [
      { balance: -9, captured: true, to: 'd4' },
      { balance: -9, captured: false, to: 'e5' },
    ]
    expect(settledMaterialDeficit(steps)).toBe(-9)
  })

  test('a knight trade in the Ruy does not count as a comeback', () => {
    const swing = materialSwingFromSans(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6'], 'black')
    expect(swing?.deficit).toBe(0)
  })
})

describe('domestic elo', () => {
  test('a win against an equal opponent gains 16 points at K=32', () => {
    const games: IClubGameRow[] = [
      {
        url: 'https://www.chess.com/game/live/1',
        white: 'Ada',
        black: 'Bea',
        outcome: 'white',
        winnerName: 'Ada',
        playedAt: '2026-10-18T12:00:00.000Z',
        opening: null,
        round: 1,
      },
    ]
    const standings = gameStandingsFrom(games)
    const ada = standings.find((row) => row.name === 'Ada')
    const bea = standings.find((row) => row.name === 'Bea')
    expect(ada?.elo).toBe(1216)
    expect(bea?.elo).toBe(1184)
    expect(ada?.points).toBe(1)
    expect(bea?.points).toBe(0)
  })
})

describe('swiss', () => {
  test('pairs the score groups and gives white to the higher player', () => {
    const groups = swissGroups([
      player('Ada', 'advanced', 1),
      player('Bea', 'advanced', 1),
      player('Cid', 'advanced', 0),
      player('Dee', 'advanced', 0),
    ])
    expect(groups.advanced.map(label)).toEqual(['Ada–Bea', 'Cid–Dee'])
    expect(groups.beginner).toEqual([])
  })

  test('avoids a rematch and flips colors', () => {
    const ada = player('Ada', 'advanced', 1)
    ada.whites = 1
    ada.lastColor = 'white'
    ada.opponents = ['bea']
    const bea = player('Bea', 'advanced', 1)
    bea.blacks = 1
    bea.lastColor = 'black'
    bea.opponents = ['ada']
    const cid = player('Cid', 'advanced', 0)
    cid.whites = 1
    cid.lastColor = 'white'
    cid.opponents = ['dee']
    const dee = player('Dee', 'advanced', 0)
    dee.blacks = 1
    dee.lastColor = 'black'
    dee.opponents = ['cid']

    const groups = swissGroups([ada, bea, cid, dee])
    expect(groups.advanced.map(label)).toEqual(['Cid–Ada', 'Bea–Dee'])
  })

  test('the lowest player without a bye sits out an odd group', () => {
    const ada = player('Ada', 'beginner', 1)
    ada.hadBye = true
    const groups = swissGroups([ada, player('Bea', 'beginner', 1), player('Cid', 'beginner', 0)])
    expect(groups.beginner.map(label)).toEqual(['Ada–Bea', 'Cid'])
  })
})

function player(name: string, group: 'beginner' | 'advanced', points: number): ISwissPlayer {
  return {
    name,
    group,
    points,
    gameWins: 0,
    whites: 0,
    blacks: 0,
    lastColor: null,
    opponents: [],
    hadBye: false,
  }
}

function label(pair: { white: string; black: string | null }): string {
  return pair.black ? `${pair.white}–${pair.black}` : pair.white
}
