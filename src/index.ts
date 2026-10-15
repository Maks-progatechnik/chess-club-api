import { clerkMiddleware, getAuth } from '@clerk/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
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
    allowMethods: ['GET', 'OPTIONS'],
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

export default app
