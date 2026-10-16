import { clerkMiddleware, getAuth } from '@clerk/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getMyAccount, listAccounts, saveMyAccount } from './accounts'
import { readAutumnBoard } from './autumn'
import { sortMembers, toMember } from './members'

const app = new Hono()

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY,
)

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  }),
)

if (clerkConfigured) {
  app.use(
    '*',
    clerkMiddleware({
      authorizedParties: ['http://localhost:5173', 'http://localhost:5174'],
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

export default app
