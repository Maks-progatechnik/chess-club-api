export interface ISignup {
  name: string
  respondent: string
  level: string
  username: string | null
  timeControl: string | null
}

export type AddSignupResult = { ok: true; signup: ISignup } | { ok: false; error: string }

const signupFile = new URL('./data/autumn-2026.csv', import.meta.url)

let writeQueue: Promise<void> = Promise.resolve()

export async function readSignups(): Promise<ISignup[]> {
  const file = Bun.file(signupFile)
  const rows = parseCsv(await file.text())
  const [header, ...records] = rows
  if (!header) {
    return []
  }

  const columns = Object.fromEntries(header.map((name, index) => [name.trim(), index]))

  return records.flatMap((record) => {
    const name = field(record, columns, 'Participant')
    if (!name) {
      return []
    }
    return [
      {
        name,
        respondent: field(record, columns, 'Respondent') || name,
        level: field(record, columns, 'Chess level') || 'Beginner',
        username: optionalField(record, columns, 'Chess.com username'),
        timeControl: optionalField(record, columns, 'Preferred time control'),
      },
    ]
  })
}

export function addSignup(name: string, level: string): Promise<AddSignupResult> {
  const signup: ISignup = {
    name,
    respondent: name,
    level: levelLabel(level),
    username: null,
    timeControl: null,
  }

  return enqueue(async () => {
    const existing = await readSignups()
    const taken = existing.some((row) => row.name.toLowerCase() === signup.name.toLowerCase())
    if (taken) {
      return { ok: false, error: `${signup.name} is already on the signup sheet.` }
    }

    const file = Bun.file(signupFile)
    const text = await file.text()
    const prefix = text.length === 0 || text.endsWith('\n') ? text : `${text}\n`
    const line = [
      signup.name,
      signup.respondent,
      signup.level,
      '',
      '',
    ]
      .map(escapeCell)
      .join(',')
    await Bun.write(signupFile, `${prefix}${line}\n`)
    return { ok: true, signup }
  })
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function levelLabel(level: string): string {
  return level.trim().toLowerCase() === 'advanced' ? 'Advanced' : 'Beginner'
}

function field(record: string[], columns: Record<string, number>, name: string): string {
  return clean(record[columns[name] ?? -1] ?? '')
}

function optionalField(record: string[], columns: Record<string, number>, name: string): string | null {
  const value = field(record, columns, name)
  return value || null
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(cell)
      if (row.some((value) => value.trim())) {
        rows.push(row)
      }
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    if (row.some((value) => value.trim())) {
      rows.push(row)
    }
  }

  return rows
}
