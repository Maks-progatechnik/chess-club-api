import { describe, expect, test } from 'bun:test'
import { clubNamesFrom } from './club-names'

describe('club names', () => {
  test('a linked sheet name shows as the member', () => {
    const club = clubNamesFrom(
      [{ name: 'Markiian', surname: 'Mytiuk', chessCom: null, signupName: 'Mark' }],
      [{ name: 'Mark', username: null }],
    )

    expect(club.canonical('Mark')).toBe('Markiian Mytiuk')
    expect(club.canonical('Markiian Mytiuk')).toBe('Markiian Mytiuk')
    expect(club.same('Mark', 'Markiian Mytiuk')).toBe(true)
    expect(club.members).toBe(1)
  })

  test('chess.com names follow the member, including a sheet username', () => {
    const club = clubNamesFrom(
      [{ name: 'Markiian', surname: 'Mytiuk', chessCom: 'markiian', signupName: 'Mark' }],
      [{ name: 'Mark', username: 'oldmark' }],
    )

    expect(club.chessAliases.get('oldmark')).toBe('Markiian Mytiuk')
    expect(club.chessAliases.get('markiian')).toBe('Markiian Mytiuk')
  })

  test('a sheet row with no member stays under its own name', () => {
    const club = clubNamesFrom([], [{ name: 'Mark', username: 'oldmark' }])

    expect(club.canonical('Mark')).toBe('Mark')
    expect(club.chessAliases.get('oldmark')).toBe('Mark')
    expect(club.members).toBe(0)
  })
})
