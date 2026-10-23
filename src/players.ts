import { listAccounts } from './accounts'
import type { IAccount } from './accounts'
import { readClubNames } from './club-names'
import { listPlayerGames } from './my-games'
import type { IMyGame } from './my-games'
import { readSignups } from './registrations'

export interface IPlayer {
  name: string
  chessCom: string | null
  elo: number | null
  level: string | null
  timeControl: string | null
  games: IMyGame[]
}

export async function getPlayer(rawName: string): Promise<IPlayer | null> {
  const needle = rawName.replace(/\s+/g, ' ').trim()
  if (!needle) {
    return null
  }

  const [signups, roster, club] = await Promise.all([readSignups(), listAccounts(), readClubNames()])
  const display = club.canonical(needle)
  const account = roster.find((row) => club.same(fullName(row), display)) ?? null
  const signup = signups.find((row) => club.same(row.name, display)) ?? null
  if (!signup && !account) {
    return null
  }

  const name = account ? fullName(account) : display
  const names = uniqueNames([name, signup?.name, account?.signupName, needle])

  return {
    name,
    chessCom: account?.chessCom ?? signup?.username ?? null,
    elo: account?.elo ?? null,
    level: signup?.level ?? null,
    timeControl: signup?.timeControl ?? null,
    games: await listPlayerGames({ names, chessCom: account?.chessCom ?? signup?.username ?? null }),
  }
}

function fullName(account: IAccount): string {
  return `${account.name} ${account.surname}`.trim()
}

function uniqueNames(values: Array<string | null | undefined>): string[] {
  const names: string[] = []
  for (const value of values) {
    const name = value?.replace(/\s+/g, ' ').trim()
    if (!name || names.some((item) => sameName(item, name))) {
      continue
    }
    names.push(name)
  }
  return names
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}
