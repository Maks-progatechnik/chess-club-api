export interface INameAccount {
  name: string
  surname: string
  chessCom: string | null
  signupName: string | null
}

export interface INameSignup {
  name: string
  username: string | null
}

export interface IClubNames {
  members: number
  chessAliases: Map<string, string>
  canonical: (name: string) => string
  same: (left: string | null, right: string | null) => boolean
}

export async function readClubNames(): Promise<IClubNames> {
  const [{ db }, { accounts }, { readSignups }] = await Promise.all([
    import('./db/client'),
    import('./db/schema'),
    import('./registrations'),
  ])
  const [rows, signups] = await Promise.all([
    db
      .select({
        name: accounts.name,
        surname: accounts.surname,
        chessCom: accounts.chessCom,
        signupName: accounts.signupName,
      })
      .from(accounts),
    readSignups(),
  ])

  return clubNamesFrom(rows, signups)
}

export function clubNamesFrom(accounts: INameAccount[], signups: INameSignup[]): IClubNames {
  const memberByAlias = new Map<string, string>()

  for (const account of accounts) {
    const member = fullName(account.name, account.surname)
    if (!member) {
      continue
    }
    memberByAlias.set(nameKey(member), member)
    const sheet = account.signupName?.trim()
    if (sheet) {
      memberByAlias.set(nameKey(sheet), member)
    }
  }

  function canonical(name: string): string {
    const trimmed = name.trim()
    return memberByAlias.get(nameKey(trimmed)) ?? trimmed
  }

  function same(left: string | null, right: string | null): boolean {
    return canonical(left ?? '') === canonical(right ?? '')
  }

  const chessAliases = new Map<string, string>()
  for (const signup of signups) {
    const username = signup.username?.trim().toLowerCase()
    if (username) {
      chessAliases.set(username, canonical(signup.name))
    }
  }
  for (const account of accounts) {
    const username = account.chessCom?.trim().toLowerCase()
    const member = fullName(account.name, account.surname)
    if (username && member) {
      chessAliases.set(username, member)
    }
  }

  return {
    members: accounts.length,
    chessAliases,
    canonical,
    same,
  }
}

function fullName(name: string, surname: string): string {
  return `${name} ${surname}`.replace(/\s+/g, ' ').trim()
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}
