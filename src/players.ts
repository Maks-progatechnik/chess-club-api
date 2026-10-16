import { listAccounts } from './accounts'
import type { IAccount } from './accounts'
import { listPlayerGames } from './my-games'
import type { IMyGame } from './my-games'
import { readSignups } from './registrations'
import type { ISignup } from './registrations'

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

  const [signups, roster] = await Promise.all([readSignups(), listAccounts()])
  const signup = signups.find((row) => sameName(row.name, needle)) ?? null
  const matches = roster.filter((row) => accountMatches(row, needle, signup))
  const claimedName = signup?.name ?? needle
  const account = matches.find((row) => row.signupName && sameName(row.signupName, claimedName)) ?? matches[0] ?? null
  if (!signup && !account) {
    return null
  }

  const name = signup?.name ?? fullName(account)
  const names = uniqueNames([name, signup?.name, account ? fullName(account) : null, account?.signupName])
  const chessCom = account?.chessCom ?? signup?.username ?? null

  return {
    name,
    chessCom,
    elo: account?.elo ?? null,
    level: signup?.level ?? null,
    timeControl: signup?.timeControl ?? null,
    games: await listPlayerGames({ names, chessCom }),
  }
}

function accountMatches(account: IAccount, needle: string, signup: ISignup | null): boolean {
  const full = fullName(account)
  if (sameName(full, needle) || (account.signupName && sameName(account.signupName, needle))) {
    return true
  }
  if (!signup) {
    return false
  }
  return sameName(full, signup.name) || Boolean(account.signupName && sameName(account.signupName, signup.name))
}

function fullName(account: IAccount | null): string {
  if (!account) {
    return ''
  }
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
