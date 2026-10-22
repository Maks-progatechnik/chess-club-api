import { clerkMiddleware, getAuth } from '@clerk/hono'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { getMyAccount, listAccounts, saveMyAccount } from './accounts'
import { addDummy, claimDummy, deleteDummy, listDummies } from './dummies'
import { readBoard } from './board'
import { addDrawGame, listDraws, saveDraw } from './draws'
import { generateNextRound } from './next-round'
import { listMyGames } from './my-games'
import { getPlayer } from './players'
import { readAutumnBoard } from './autumn'
import { sortMembers, toMember } from './members'

const app = new Hono()

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY,
)

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
]

app.use(
  '*',
  cors({
    origin: allowedOrigins,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

if (clerkConfigured) {
  app.use(
    '*',
    clerkMiddleware({
      authorizedParties: allowedOrigins,
    }),
  )
}

app.get('/', (c) => {
  return c.json({ ok: true })
})

app.get('/me', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const user = await c.get('clerk').users.getUser(userId)
  return c.json(toMember(user))
})

app.get('/members', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { data } = await c.get('clerk').users.getUserList({ limit: 100 })
  return c.json({ members: sortMembers(data.map(toMember), userId) })
})

app.get('/accounts', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ accounts: await listAccounts() })
})

app.get('/accounts/me', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ account: await getMyAccount(userId) })
})

app.put('/accounts/me', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Send name and surname.' }, 400)
  }

  const result = await saveMyAccount(userId, body)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.account)
})

app.get('/accounts/me/games', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const account = await getMyAccount(userId)
  if (!account) {
    return c.json({ games: [] })
  }

  return c.json({ games: await listMyGames(account) })
})

app.get('/players/:name', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const player = await getPlayer(c.req.param('name'))
  if (!player) {
    return c.json({ error: 'That player is not in the club.' }, 404)
  }

  return c.json({ player })
})

app.get('/dummies', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ dummies: await listDummies(userId) })
})

app.post('/dummies', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Name is required.' }, 400)
  }

  const result = await addDummy(body)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.dummy, 201)
})

app.post('/dummies/claim', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Choose a player.' }, 400)
  }

  const result = await claimDummy(userId, body)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.dummy)
})

app.delete('/dummies', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Choose a player.' }, 400)
  }

  const result = await deleteDummy(body)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json({ name: result.name })
})

app.get('/board', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json(await readBoard())
})

app.get('/draws', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ draws: await listDraws() })
})

app.post('/draws', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Send beginner and advanced pairs.' }, 400)
  }

  const result = await saveDraw(body)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.draw, 201)
})

app.post('/draws/next', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const round = await readRound(c)
  if (round === null) {
    return c.json({ error: 'Send the round number.' }, 400)
  }

  const result = await generateNextRound(round)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.draw, 201)
})

app.post('/draws/:id/games', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const drawId = Number(c.req.param('id'))
  if (!Number.isInteger(drawId)) {
    return c.json({ error: 'That draw was not found.' }, 400)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Send the match and a Chess.com game link.' }, 400)
  }

  const result = await addDrawGame(drawId, body)
  if (!result.ok) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.draw)
})

app.get('/tournaments/autumn-2026', async (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json(await readAutumnBoard())
})

async function readRound(c: Context): Promise<number | null> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return null
  }
  if (!isRecord(body) || typeof body.round !== 'number') {
    return null
  }
  return body.round
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const port = Number(process.env.PORT ?? 3000)

export default {
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
  idleTimeout: 60,
}
